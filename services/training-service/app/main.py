from fastapi import FastAPI, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
import uuid
import time
import json
from datetime import datetime, timezone
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client import Counter

from .logger import setup_logger, set_request_id

from .database import engine, Base, get_db
from . import models, schemas, rabbitmq

logger = setup_logger("training-service")

# Initialize tables
Base.metadata.create_all(bind=engine)

# Setup RabbitMQ Exchanges & Queues on startup
try:
    rabbitmq.setup_rabbitmq()
except Exception:
    pass

TRAINING_JOBS_TOTAL = Counter(
    "training_jobs_total",
    "Total number of training jobs submitted successfully"
)

app = FastAPI(
    title="MLForge Training Service",
    description="Asynchronous training job enqueuing service for MLForge",
    version="1.0.0"
)

Instrumentator().instrument(app).expose(app)

@app.middleware("http")
async def structured_logging_middleware(request: Request, call_next):
    start_time = time.time()
    request_id = request.headers.get("x-request-id") or request.headers.get("X-Request-ID", "unknown")
    set_request_id(request_id)
    
    response = await call_next(request)
    
    process_time_ms = (time.time() - start_time) * 1000
    if response.status_code < 400:
        logger.info(f"{request.method} {request.url.path} {response.status_code}", extra={"event": "http_request", "latency_ms": round(process_time_ms, 2)})
    elif response.status_code < 500:
        logger.warning(f"{request.method} {request.url.path} {response.status_code}", extra={"event": "http_request", "latency_ms": round(process_time_ms, 2)})
    else:
        logger.error(f"{request.method} {request.url.path} {response.status_code}", extra={"event": "http_request", "latency_ms": round(process_time_ms, 2)})
        
    return response

@app.post("/training/jobs", response_model=schemas.TrainingJobResponse, status_code=status.HTTP_202_ACCEPTED)
def submit_training_job(job_in: schemas.TrainingJobCreate, db: Session = Depends(get_db)):
    job_id = str(uuid.uuid4())
    event_id = str(uuid.uuid4())
    requested_at = datetime.now(timezone.utc).isoformat()
    
    # 1. Register job in database
    db_job = models.TrainingJob(
        id=job_id,
        model_id=job_in.model_id,
        status="QUEUED",
        algorithm=job_in.algorithm,
        retry_count=0
    )
    db.add(db_job)
    db.commit()
    
    # 2. Publish message to RabbitMQ Training Queue
    try:
        rabbitmq.publish_training_job(
            event_id=event_id,
            job_id=job_id,
            model_id=job_in.model_id,
            dataset_path=job_in.dataset_path,
            algorithm=job_in.algorithm,
            requested_at=requested_at
        )
    except Exception as e:
        # Fallback to FAILED status in DB if enqueuing fails
        db_job.status = "FAILED"
        db_job.error_message = f"Failed to enqueue task: {str(e)}"
        db.commit()
        db.refresh(db_job)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Temporary message broker connection failure: {str(e)}"
        )
        
    TRAINING_JOBS_TOTAL.inc()
    db.refresh(db_job)
    return db_job

@app.get("/training/jobs/{job_id}", response_model=schemas.TrainingJobResponse)
def get_training_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(models.TrainingJob).filter(models.TrainingJob.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training job not found"
        )
    return job

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
