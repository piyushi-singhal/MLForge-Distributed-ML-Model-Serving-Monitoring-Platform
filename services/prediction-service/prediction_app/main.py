from fastapi import FastAPI, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
import uuid
import time
import os
import hashlib
import json
import joblib
import pandas as pd
import numpy as np
import redis
import logging
import httpx
from typing import Dict, Any
from prometheus_fastapi_instrumentator import Instrumentator

from .database import engine, Base, get_db
from .config import settings
from . import models, schemas

logger = logging.getLogger("prediction-service")
logging.basicConfig(level=logging.INFO)

# Initialize tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MLForge Prediction Service",
    description="Low-latency real-time model inference serving microservice for MLForge",
    version="1.0.0"
)

Instrumentator().instrument(app).expose(app)

@app.middleware("http")
async def structured_logging_middleware(request: Request, call_next):
    start_time = time.time()
    request_id = request.headers.get("X-Request-ID", "unknown")
    
    response = await call_next(request)
    
    process_time_ms = (time.time() - start_time) * 1000
    log_data = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "service": "prediction-service",
        "level": "INFO" if response.status_code < 400 else "WARNING" if response.status_code < 500 else "ERROR",
        "request_id": request_id,
        "event": "http_request",
        "message": f"{request.method} {request.url.path} {response.status_code}",
        "duration_ms": round(process_time_ms, 2)
    }
    logger.info(json.dumps(log_data))
    return response

# Initialize Redis connection client (with graceful error handling)
redis_client = None
try:
    redis_client = redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=0,
        socket_connect_timeout=1,
        decode_responses=True
    )
except Exception as e:
    logger.warning(f"Failed to connect to Redis on startup: {str(e)}")

# Global in-memory model cache to prevent reloading from disk on every HTTP request
_loaded_models = {}

def get_model_instance(artifact_path: str):
    if artifact_path not in _loaded_models:
        if not os.path.exists(artifact_path):
            raise FileNotFoundError(f"Model binary artifact not found on storage volume: {artifact_path}")
        _loaded_models[artifact_path] = joblib.load(artifact_path)
    return _loaded_models[artifact_path]

@app.post("/predictions", response_model=schemas.PredictionResponse)
def get_prediction(pred_in: schemas.PredictionInput, db: Session = Depends(get_db)):
    start_time = time.perf_counter()
    request_id = str(uuid.uuid4())
    
    # 1. Determine model version to load via HTTPX call to Model Service
    version_val = None
    artifact_path = None
    
    if os.environ.get("TESTING") == "True":
        # Mock active version auto-resolution for test suites
        version_val = pred_in.model_version or "v1"
        artifact_path = "test_model.joblib"
    else:
        try:
            if pred_in.model_version:
                url = f"{settings.MODEL_SERVICE_URL}/models/{pred_in.model_id}/versions"
                resp = httpx.get(url, timeout=5.0)
                if resp.status_code == 200:
                    versions = resp.json()
                    # Find matching version
                    for v in versions:
                        if v["version"] == pred_in.model_version:
                            version_val = v["version"]
                            artifact_path = v["artifact_path"]
                            break
            else:
                # Load active version by default
                url = f"{settings.MODEL_SERVICE_URL}/models/{pred_in.model_id}/active"
                resp = httpx.get(url, timeout=5.0)
                if resp.status_code == 200:
                    v = resp.json()
                    version_val = v["version"]
                    artifact_path = v["artifact_path"]
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to communicate with Model Service registry: {str(e)}"
            )

    if not version_val or not artifact_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No matching active model version found for model '{pred_in.model_id}'"
        )

    # 1.5. Calculate cache key & Check Redis Cache
    features_str = json.dumps(pred_in.features, sort_keys=True)
    features_hash = hashlib.sha256(features_str.encode('utf-8')).hexdigest()
    cache_key = f"prediction:{version_val}:{features_hash}"
    
    if redis_client:
        try:
            cached_data = redis_client.get(cache_key)
            if cached_data:
                cached_json = json.loads(cached_data)
                latency_ms = int((time.perf_counter() - start_time) * 1000)
                
                # Log cached request to Database
                try:
                    log_entry = models.PredictionRequest(
                        id=request_id,
                        model_id=pred_in.model_id,
                        model_version=version_val,
                        input_hash=features_hash,
                        prediction=cached_json["prediction"],
                        confidence=cached_json.get("confidence"),
                        latency_ms=latency_ms
                    )
                    db.add(log_entry)
                    db.commit()
                except Exception:
                    db.rollback()
                
                logger.info(f"Cache HIT for key={cache_key}")
                return {
                    "request_id": request_id,
                    "model_id": pred_in.model_id,
                    "model_version": version_val,
                    "prediction": cached_json["prediction"],
                    "confidence": cached_json.get("confidence"),
                    "latency_ms": max(1, latency_ms)
                }
        except Exception as e:
            logger.warning(f"Redis cache lookup error (graceful degradation): {str(e)}")

    logger.info(f"Cache MISS for key={cache_key}. Performing inference...")

    # 2. Load model from storage
    try:
        model = get_model_instance(artifact_path)
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to deserialize model binary: {str(e)}"
        )

    # 3. Generate Prediction
    try:
        # Convert features dict to 1-row DataFrame
        df_features = pd.DataFrame([pred_in.features])
        
        # Run inference
        prediction_arr = model.predict(df_features)
        
        # Convert numpy types to python native types
        prediction_val = prediction_arr[0]
        if isinstance(prediction_val, (np.integer, np.int64)):
            prediction_val = int(prediction_val)
        elif isinstance(prediction_val, (np.floating, np.float64)):
            prediction_val = float(prediction_val)
            
        # Compute confidence if model supports proba
        confidence_val = None
        if hasattr(model, "predict_proba"):
            proba = model.predict_proba(df_features)[0]
            confidence_val = float(np.max(proba))
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Feature matrix mismatch or prediction execution failed: {str(e)}"
        )

    latency_ms = int((time.perf_counter() - start_time) * 1000)

    # 4. Save prediction result to Redis cache
    if redis_client:
        try:
            cache_payload = {
                "prediction": prediction_val,
                "confidence": confidence_val
            }
            redis_client.set(cache_key, json.dumps(cache_payload), ex=300) # 5 minutes TTL
            logger.info(f"Saved prediction result to cache key={cache_key}")
        except Exception as e:
            logger.warning(f"Failed to write prediction result to Redis cache: {str(e)}")

    # 5. Log prediction request to Database
    try:
        log_entry = models.PredictionRequest(
            id=request_id,
            model_id=pred_in.model_id,
            model_version=version_val,
            input_hash=features_hash,
            prediction=prediction_val,
            confidence=confidence_val,
            latency_ms=latency_ms
        )
        db.add(log_entry)
        db.commit()
    except Exception:
        db.rollback()

    return {
        "request_id": request_id,
        "model_id": pred_in.model_id,
        "model_version": version_val,
        "prediction": prediction_val,
        "confidence": confidence_val,
        "latency_ms": max(1, latency_ms)
    }

@app.get("/predictions/{request_id}", response_model=schemas.PredictionLogResponse)
def get_prediction_log(request_id: str, db: Session = Depends(get_db)):
    log = db.query(models.PredictionRequest).filter(models.PredictionRequest.id == request_id).first()
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prediction request log not found"
        )
    return log

@app.get("/health", status_code=status.HTTP_200_OK)
def health():
    return {"status": "healthy"}

@app.get("/ready", status_code=status.HTTP_200_OK)
def ready(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database connection error: {str(e)}"
        )
