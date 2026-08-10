from fastapi import FastAPI, Request, Response, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import httpx
import uuid
from .logger import setup_logger, set_request_id

from .config import settings

logger = setup_logger("api-gateway")

async_client = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global async_client
    # Startup: Initialize shared HTTPX client with explicit timeouts
    timeout = httpx.Timeout(10.0, connect=2.0)
    async_client = httpx.AsyncClient(timeout=timeout)
    yield
    # Shutdown: Close client
    await async_client.aclose()

from prometheus_fastapi_instrumentator import Instrumentator
import time

app = FastAPI(
    title="MLForge API Gateway",
    description="Unified API entry point and reverse proxy for MLForge microservices",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_REQUEST_SIZE = 50 * 1024 * 1024  # 50 MB

@app.middleware("http")
async def payload_size_limit_middleware(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_REQUEST_SIZE:
        return JSONResponse(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            content={"detail": "Payload too large. Maximum size is 50MB."}
        )
    return await call_next(request)

Instrumentator().instrument(app).expose(app)

@app.middleware("http")
async def structured_logging_middleware(request: Request, call_next):
    start_time = time.time()
    # 1. Propagate / Generate correlation ID (request_id)
    request_id = request.headers.get("x-request-id") or request.headers.get("X-Request-ID")
    if not request_id:
        request_id = f"req_{uuid.uuid4().hex[:12]}"
        
    set_request_id(request_id)
    # Inject it into request state so routes can access it if needed
    request.state.request_id = request_id
    
    response = await call_next(request)
    
    process_time_ms = (time.time() - start_time) * 1000
    if response.status_code < 400:
        logger.info(f"{request.method} {request.url.path} {response.status_code}", extra={"event": "http_request", "latency_ms": round(process_time_ms, 2)})
    elif response.status_code < 500:
        logger.warning(f"{request.method} {request.url.path} {response.status_code}", extra={"event": "http_request", "latency_ms": round(process_time_ms, 2)})
    else:
        logger.error(f"{request.method} {request.url.path} {response.status_code}", extra={"event": "http_request", "latency_ms": round(process_time_ms, 2)})
        
    return response


async def reverse_proxy(target_url: str, request: Request) -> Response:
    global async_client
    if async_client is None:
        timeout = httpx.Timeout(10.0, connect=2.0)
        async_client = httpx.AsyncClient(timeout=timeout)
    request_id = getattr(request.state, "request_id", f"req_{uuid.uuid4().hex[:12]}")
        
    # Copy headers and inject correlation ID
    headers = dict(request.headers)
    headers["X-Request-ID"] = request_id
    headers["x-request-id"] = request_id
    
    # We must exclude 'host' header to let downstream servers parse correct host
    if "host" in headers:
        del headers["host"]

    # Read body
    body = await request.body()
    
    logger.info(f"Routing method={request.method} path={request.url.path} ➔ target={target_url}", extra={"event": "routing_downstream"})
    
    # 2. Forward request downstream with bounded retries & exponential backoff
    import asyncio
    max_attempts = 3
    base_delay = 0.5
    
    for attempt in range(1, max_attempts + 1):
        try:
            resp = await async_client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body,
                params=request.query_params
            )
            
            # If 5xx, we might want to retry
            if resp.status_code >= 500:
                if attempt < max_attempts:
                    logger.warning(f"Downstream returned {resp.status_code}, retrying attempt {attempt}/{max_attempts}...", extra={"event": "downstream_retry"})
                    await asyncio.sleep(base_delay * (2 ** (attempt - 1)))
                    continue
            
            # Build gateway response (Success or 4xx, we don't retry 4xx)
            headers_out = dict(resp.headers)
            # Inject correlation ID in response headers too
            headers_out["X-Request-ID"] = request_id
            
            # Strip content-encoding like gzip to prevent double encoding or gzip mismatches in gateway
            if "content-encoding" in headers_out:
                del headers_out["content-encoding"]
                
            logger.info(f"Downstream Response status_code={resp.status_code}", extra={"event": "downstream_response"})
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                headers=headers_out
            )
        except httpx.RequestError as e:
            if attempt < max_attempts:
                logger.warning(f"Downstream connection error: {str(e)}, retrying attempt {attempt}/{max_attempts}...", extra={"event": "downstream_retry"})
                await asyncio.sleep(base_delay * (2 ** (attempt - 1)))
                continue
            
            logger.error(f"Downstream service unavailable after {max_attempts} attempts: {str(e)}", extra={"event": "downstream_error"})
            import json
            return Response(
                content=json.dumps({
                    "error": "SERVICE_UNAVAILABLE",
                    "message": f"Connection to microservice failed after {max_attempts} attempts: {str(e)}",
                    "request_id": request_id
                }),
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                media_type="application/json",
                headers={"X-Request-ID": request_id}
            )

import socket
import os

def check_tcp_connection(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=1.0):
            return True
    except Exception:
        return False

@app.get("/api/postgres/health")
async def postgres_health():
    host = os.environ.get("POSTGRES_HOST", "postgres")
    if check_tcp_connection(host, 5432):
        return {"status": "healthy"}
    return JSONResponse(status_code=503, content={"status": "unhealthy", "detail": "PostgreSQL port 5432 unreachable"})

@app.get("/api/redis/health")
async def redis_health():
    host = os.environ.get("REDIS_HOST", "redis")
    if check_tcp_connection(host, 6379):
        return {"status": "healthy"}
    return JSONResponse(status_code=503, content={"status": "unhealthy", "detail": "Redis port 6379 unreachable"})

@app.get("/api/rabbitmq/health")
async def rabbitmq_health():
    host = os.environ.get("RABBITMQ_HOST", "rabbitmq")
    if check_tcp_connection(host, 5672):
        return {"status": "healthy"}
    return JSONResponse(status_code=503, content={"status": "unhealthy", "detail": "RabbitMQ port 5672 unreachable"})

@app.get("/api/worker/health")
async def worker_health(request: Request):
    try:
        resp = await reverse_proxy("http://training-worker:8000/", request)
        if resp.status_code == 200:
            return {"status": "healthy"}
        return JSONResponse(status_code=503, content={"status": "unhealthy", "detail": f"Downstream returned status {resp.status_code}"})
    except Exception as e:
        return JSONResponse(status_code=503, content={"status": "unhealthy", "detail": str(e)})

@app.get("/api/prometheus/health")
async def prometheus_health(request: Request):
    try:
        resp = await reverse_proxy("http://prometheus:9090/-/healthy", request)
        if resp.status_code == 200:
            return {"status": "healthy"}
        return JSONResponse(status_code=503, content={"status": "unhealthy", "detail": f"Downstream returned status {resp.status_code}"})
    except Exception as e:
        return JSONResponse(status_code=503, content={"status": "unhealthy", "detail": str(e)})

@app.get("/api/grafana/health")
async def grafana_health(request: Request):
    try:
        resp = await reverse_proxy("http://grafana:3000/api/health", request)
        if resp.status_code == 200:
            return {"status": "healthy"}
        return JSONResponse(status_code=503, content={"status": "unhealthy", "detail": f"Downstream returned status {resp.status_code}"})
    except Exception as e:
        return JSONResponse(status_code=503, content={"status": "unhealthy", "detail": str(e)})

@app.get("/api/auth/health")
async def auth_health(request: Request):
    return await reverse_proxy(f"{settings.AUTH_SERVICE_URL}/health", request)

@app.get("/api/auth/ready")
async def auth_ready(request: Request):
    return await reverse_proxy(f"{settings.AUTH_SERVICE_URL}/ready", request)

@app.get("/api/models/health")
async def models_health(request: Request):
    return await reverse_proxy(f"{settings.MODEL_SERVICE_URL}/health", request)

@app.get("/api/models/ready")
async def models_ready(request: Request):
    return await reverse_proxy(f"{settings.MODEL_SERVICE_URL}/ready", request)

@app.get("/api/training/health")
async def training_health(request: Request):
    return await reverse_proxy(f"{settings.TRAINING_SERVICE_URL}/health", request)

@app.get("/api/training/ready")
async def training_ready(request: Request):
    return await reverse_proxy(f"{settings.TRAINING_SERVICE_URL}/ready", request)

@app.get("/api/predictions/health")
async def predictions_health(request: Request):
    return await reverse_proxy(f"{settings.PREDICTION_SERVICE_URL}/health", request)

@app.get("/api/predictions/ready")
async def predictions_ready(request: Request):
    return await reverse_proxy(f"{settings.PREDICTION_SERVICE_URL}/ready", request)

@app.get("/api/rabbitmq/queues")
async def rabbitmq_queues(request: Request):
    import httpx
    auth = httpx.BasicAuth(os.environ.get("RABBITMQ_USER", "guest"), os.environ.get("RABBITMQ_PASSWORD", "guest"))
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get("http://rabbitmq:15672/api/queues", auth=auth, timeout=2.0)
            if resp.status_code == 200:
                return resp.json()
            return JSONResponse(status_code=resp.status_code, content={"detail": "RabbitMQ API returned error"})
        except Exception as e:
            return JSONResponse(status_code=503, content={"detail": str(e)})

@app.get("/api/prometheus/query")
async def prometheus_query(request: Request):
    import httpx
    query_params = request.query_params
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get("http://prometheus:9090/api/v1/query", params=query_params, timeout=5.0)
            return Response(content=resp.content, status_code=resp.status_code, media_type="application/json")
        except Exception as e:
            return JSONResponse(status_code=503, content={"detail": str(e)})

@app.get("/api/prometheus/query_range")
async def prometheus_query_range(request: Request):
    import httpx
    query_params = request.query_params
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get("http://prometheus:9090/api/v1/query_range", params=query_params, timeout=5.0)
            return Response(content=resp.content, status_code=resp.status_code, media_type="application/json")
        except Exception as e:
            return JSONResponse(status_code=503, content={"detail": str(e)})

# Wildcard route mappings
@app.api_route("/api/auth/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
async def route_auth(path: str, request: Request):
    target = f"{settings.AUTH_SERVICE_URL}/auth/{path}" if path else f"{settings.AUTH_SERVICE_URL}/auth"
    return await reverse_proxy(target, request)

@app.api_route("/api/models/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
async def route_models(path: str, request: Request):
    target = f"{settings.MODEL_SERVICE_URL}/models/{path}" if path else f"{settings.MODEL_SERVICE_URL}/models"
    return await reverse_proxy(target, request)

@app.api_route("/api/training/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
async def route_training(path: str, request: Request):
    target = f"{settings.TRAINING_SERVICE_URL}/training/{path}" if path else f"{settings.TRAINING_SERVICE_URL}/training"
    return await reverse_proxy(target, request)

@app.api_route("/api/predictions/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
async def route_predictions(path: str, request: Request):
    target = f"{settings.PREDICTION_SERVICE_URL}/predictions/{path}" if path else f"{settings.PREDICTION_SERVICE_URL}/predictions"
    return await reverse_proxy(target, request)

@app.get("/health", status_code=status.HTTP_200_OK)
def health():
    return {"status": "healthy"}

@app.get("/ready", status_code=status.HTTP_200_OK)
def ready():
    # Gateway is ready immediately if it is alive
    return {"status": "ready"}
