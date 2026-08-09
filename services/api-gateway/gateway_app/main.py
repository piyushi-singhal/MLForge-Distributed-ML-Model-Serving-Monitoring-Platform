from fastapi import FastAPI, Request, Response, status
from contextlib import asynccontextmanager
import httpx
import uuid
import logging
import json

from .config import settings

# Setup structured logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("api-gateway")

async_client = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global async_client
    # Startup: Initialize shared HTTPX client
    async_client = httpx.AsyncClient()
    yield
    # Shutdown: Close client
    await async_client.aclose()

app = FastAPI(
    title="MLForge API Gateway",
    description="Unified API entry point and reverse proxy for MLForge microservices",
    version="1.0.0",
    lifespan=lifespan
)

async def reverse_proxy(target_url: str, request: Request) -> Response:
    global async_client
    if async_client is None:
        async_client = httpx.AsyncClient()

    # 1. Propagate / Generate correlation ID (request_id)
    request_id = request.headers.get("x-request-id") or request.headers.get("X-Request-ID")
    if not request_id:
        request_id = f"req_{uuid.uuid4().hex[:12]}"
        
    # Copy headers and inject correlation ID
    headers = dict(request.headers)
    headers["X-Request-ID"] = request_id
    headers["x-request-id"] = request_id
    
    # We must exclude 'host' header to let downstream servers parse correct host
    if "host" in headers:
        del headers["host"]

    # Read body
    body = await request.body()
    
    logger.info(f"Routing request_id={request_id} method={request.method} path={request.url.path} ➔ target={target_url}")
    
    # 2. Forward request downstream
    try:
        resp = await async_client.request(
            method=request.method,
            url=target_url,
            headers=headers,
            content=body,
            params=request.query_params,
            timeout=10.0
        )
        
        # Build gateway response
        headers_out = dict(resp.headers)
        # Inject correlation ID in response headers too
        headers_out["X-Request-ID"] = request_id
        
        # Strip content-encoding like gzip to prevent double encoding or gzip mismatches in gateway
        if "content-encoding" in headers_out:
            del headers_out["content-encoding"]
            
        logger.info(f"Response request_id={request_id} status_code={resp.status_code}")
        return Response(
            content=resp.content,
            status_code=resp.status_code,
            headers=headers_out
        )
    except httpx.RequestError as e:
        logger.error(f"Downstream service unavailable request_id={request_id} error={str(e)}")
        return Response(
            content=json.dumps({
                "error": "SERVICE_UNAVAILABLE",
                "message": f"Connection to microservice failed: {str(e)}",
                "request_id": request_id
            }),
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            media_type="application/json",
            headers={"X-Request-ID": request_id}
        )

# Wildcard route mappings
@app.api_route("/api/auth/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
async def route_auth(path: str, request: Request):
    target = f"{settings.AUTH_SERVICE_URL}/{path}"
    return await reverse_proxy(target, request)

@app.api_route("/api/models/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
async def route_models(path: str, request: Request):
    target = f"{settings.MODEL_SERVICE_URL}/{path}"
    return await reverse_proxy(target, request)

@app.api_route("/api/training/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
async def route_training(path: str, request: Request):
    target = f"{settings.TRAINING_SERVICE_URL}/{path}"
    return await reverse_proxy(target, request)

@app.api_route("/api/predictions/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
async def route_predictions(path: str, request: Request):
    target = f"{settings.PREDICTION_SERVICE_URL}/{path}"
    return await reverse_proxy(target, request)

@app.get("/health", status_code=status.HTTP_200_OK)
def health():
    return {"status": "healthy"}

@app.get("/ready", status_code=status.HTTP_200_OK)
def ready():
    # Gateway is ready immediately if it is alive
    return {"status": "ready"}
