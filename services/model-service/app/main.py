from fastapi import FastAPI, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
import time
import json
import logging
from prometheus_fastapi_instrumentator import Instrumentator

logger = logging.getLogger("model-service")
logging.basicConfig(level=logging.INFO)

from .database import engine, Base, get_db
from . import models, schemas

# Initialize tables (e.g. SQLite local run)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MLForge Model Service",
    description="Model Registry and lifecycle management service for MLForge",
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
        "service": "model-service",
        "level": "INFO" if response.status_code < 400 else "WARNING" if response.status_code < 500 else "ERROR",
        "request_id": request_id,
        "event": "http_request",
        "message": f"{request.method} {request.url.path} {response.status_code}",
        "duration_ms": round(process_time_ms, 2)
    }
    logger.info(json.dumps(log_data))
    return response

@app.post("/models", response_model=schemas.ModelResponse, status_code=status.HTTP_201_CREATED)
def create_model(model_in: schemas.ModelCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Model).filter(models.Model.id == model_in.id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Model with id '{model_in.id}' already exists"
        )
    db_model = models.Model(
        id=model_in.id,
        name=model_in.name,
        description=model_in.description,
        created_by=model_in.created_by
    )
    db.add(db_model)
    db.commit()
    db.refresh(db_model)
    return db_model

@app.get("/models/{model_id}/active", response_model=schemas.ModelVersionResponse)
def get_active_version(model_id: str, db: Session = Depends(get_db)):
    model = db.query(models.Model).filter(models.Model.id == model_id).first()
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model not found"
        )
    version = db.query(models.ModelVersion).filter(
        models.ModelVersion.model_id == model_id,
        models.ModelVersion.status == "ACTIVE"
    ).first()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active version found for model '{model_id}'"
        )
    return version

@app.get("/models", response_model=List[schemas.ModelResponse])
def list_models(db: Session = Depends(get_db)):
    return db.query(models.Model).all()

@app.get("/models/{model_id}", response_model=schemas.ModelResponse)
def get_model(model_id: str, db: Session = Depends(get_db)):
    model = db.query(models.Model).filter(models.Model.id == model_id).first()
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model not found"
        )
    return model

@app.post("/models/{model_id}/versions", response_model=schemas.ModelVersionResponse, status_code=status.HTTP_201_CREATED)
def create_model_version(model_id: str, version_in: schemas.ModelVersionCreate, db: Session = Depends(get_db)):
    # Verify model exists
    model = db.query(models.Model).filter(models.Model.id == model_id).first()
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model not found"
        )
        
    # Verify duplicate version
    duplicate = db.query(models.ModelVersion).filter(
        models.ModelVersion.model_id == model_id,
        models.ModelVersion.version == version_in.version
    ).first()
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Version '{version_in.version}' already exists for model '{model_id}'"
        )
        
    # Validate status values
    valid_statuses = {"TRAINING", "READY", "ACTIVE", "FAILED", "ARCHIVED"}
    if version_in.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid status value. Must be one of: {', '.join(valid_statuses)}"
        )

    db_version = models.ModelVersion(
        model_id=model_id,
        version=version_in.version,
        algorithm=version_in.algorithm,
        artifact_path=version_in.artifact_path,
        metrics_json=version_in.metrics_json,
        status=version_in.status
    )
    db.add(db_version)
    db.commit()
    db.refresh(db_version)
    return db_version

@app.get("/models/{model_id}/versions", response_model=List[schemas.ModelVersionResponse])
def list_model_versions(model_id: str, db: Session = Depends(get_db)):
    # Verify model exists
    model = db.query(models.Model).filter(models.Model.id == model_id).first()
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model not found"
        )
    return db.query(models.ModelVersion).filter(models.ModelVersion.model_id == model_id).all()

@app.get("/models/{model_id}/versions/{version_id}", response_model=schemas.ModelVersionResponse)
def get_model_version(model_id: str, version_id: int, db: Session = Depends(get_db)):
    version = db.query(models.ModelVersion).filter(
        models.ModelVersion.model_id == model_id,
        models.ModelVersion.id == version_id
    ).first()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model version not found"
        )
    return version

@app.post("/models/{model_id}/versions/{version_id}/activate", response_model=schemas.ModelVersionResponse)
def activate_version(model_id: str, version_id: int, db: Session = Depends(get_db)):
    # 1. Verify version exists
    version = db.query(models.ModelVersion).filter(
        models.ModelVersion.model_id == model_id,
        models.ModelVersion.id == version_id
    ).first()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model version not found"
        )
        
    # 2. Deactivate other versions of this model (change status from ACTIVE to READY)
    db.query(models.ModelVersion).filter(
        models.ModelVersion.model_id == model_id,
        models.ModelVersion.status == "ACTIVE"
    ).update({"status": "READY"})
    
    # 3. Set this version to ACTIVE
    version.status = "ACTIVE"
    db.commit()
    db.refresh(version)
    return version

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
