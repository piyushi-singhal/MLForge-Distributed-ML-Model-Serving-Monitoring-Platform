import os
import time
import json
import pandas as pd
import numpy as np
import joblib
import httpx
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, OperationalError

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score

from .config import settings
from .database import SessionLocal
from . import models
from .logger import setup_logger, request_id_var

logger = setup_logger("training-worker")

class TransientError(Exception):
    """Raised for issues like temporary DB disconnects that are worth retrying."""
    pass

def post_with_retries(url: str, json_data: dict, headers: dict, max_attempts: int = 3, base_delay: float = 0.5) -> httpx.Response:
    timeout = httpx.Timeout(5.0, connect=2.0)
    for attempt in range(1, max_attempts + 1):
        try:
            resp = httpx.post(url, json=json_data, headers=headers, timeout=timeout)
            if resp.status_code >= 500:
                if attempt < max_attempts:
                    logger.warning(f"Model Service returned {resp.status_code}, retrying attempt {attempt}/{max_attempts}...", extra={"event": "model_service_retry"})
                    time.sleep(base_delay * (2 ** (attempt - 1)))
                    continue
            return resp
        except httpx.RequestError as e:
            if attempt < max_attempts:
                logger.warning(f"Model Service connection error: {str(e)}, retrying attempt {attempt}/{max_attempts}...", extra={"event": "model_service_retry"})
                time.sleep(base_delay * (2 ** (attempt - 1)))
                continue
            raise e

class PermanentError(Exception):
    """Raised for issues like missing files or invalid parameters that should not be retried."""
    pass

def process_training_message(message_body: str):
    """Processes a single training message with idempotency and retry handlers."""
    db = SessionLocal()
    
    try:
        # 1. Parse JSON message
        try:
            data = json.loads(message_body)
            event_id = data["event_id"]
            job_id = data["job_id"]
            model_id = data["model_id"]
            dataset_path = data["dataset_path"]
            algorithm = data["algorithm"]
        except Exception as e:
            raise PermanentError(f"Malformed queue message JSON: {str(e)}")
            
        logger.info(f"Processing training job={job_id} event={event_id} model={model_id} algorithm={algorithm}")
        
        # 2. Check Idempotency and State Recovery
        try:
            existing_event = db.query(models.ProcessedEvent).filter(models.ProcessedEvent.event_id == event_id).first()
            if existing_event:
                if existing_event.status == "COMPLETED":
                    logger.info(f"Event {event_id} already successfully COMPLETED. Skipping.")
                    return True
                else:
                    # If status is RUNNING or FAILED, it means the worker crashed or failed. We recover.
                    logger.warning(f"Event {event_id} found in state {existing_event.status}. Attempting recovery and re-running...")
                    existing_event.status = "RUNNING"
                    db.commit()
                    processed_event = existing_event
            else:
                processed_event = models.ProcessedEvent(event_id=event_id, status="RUNNING")
                db.add(processed_event)
                db.commit()
        except OperationalError as e:
            db.rollback()
            raise TransientError(f"Database connection transient error during idempotency check: {str(e)}")

        # 3. Retrieve or Create Job Tracker
        try:
            job = db.query(models.TrainingJob).filter(models.TrainingJob.id == job_id).first()
            if not job:
                job = models.TrainingJob(
                    id=job_id,
                    model_id=model_id,
                    status="QUEUED",
                    algorithm=algorithm
                )
                db.add(job)
                db.commit()
            
            # Mark job as RUNNING
            job.status = "RUNNING"
            job.started_at = datetime.now(timezone.utc)
            db.commit()
        except OperationalError as e:
            db.rollback()
            raise TransientError(f"Database connection error when setting job RUNNING: {str(e)}")

        # 4. Core Training Pipeline
        try:
            metrics_json, artifact_path, version_str = run_training_pipeline(model_id, dataset_path, algorithm, event_id)
        except PermanentError as e:
            # Log failure in job tracker
            job.status = "FAILED"
            job.error_message = str(e)
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            
            # Update event log
            processed_event.status = "FAILED"
            db.commit()
            raise e
            
        # 5. Register Model Version via HTTP to Model Service & Complete Job
        try:
            # Post new version creation request to Model Service registry API
            payload = {
                "version": version_str,
                "algorithm": algorithm,
                "artifact_path": artifact_path,
                "metrics_json": metrics_json,
                "status": "READY" # Initially READY, can be activated to ACTIVE later
            }
            url = f"{settings.MODEL_SERVICE_URL}/models/{model_id}/versions"
            logger.info(f"Registering model version via HTTP POST to {url} payload={payload}", extra={"event": "register_model_version"})
            
            # Use test mode check to skip HTTP call in mock unit tests
            if os.environ.get("TESTING") == "True":
                logger.info("Skipped registration HTTP call in test environment.")
            else:
                headers = {"X-Request-ID": request_id_var.get()}
                resp = post_with_retries(url, json_data=payload, headers=headers)
                if resp.status_code not in (200, 201, 409):
                    raise TransientError(f"Model Service returned unexpected code {resp.status_code}: {resp.text}")
            
            job.status = "COMPLETED"
            job.completed_at = datetime.now(timezone.utc)
            processed_event.status = "COMPLETED"
            db.commit()
            logger.info(f"Successfully finished job {job_id} model version {version_str}", extra={"event": "training_completed"})
            return True
        except Exception as e:
            db.rollback()
            raise TransientError(f"Failed to submit model version registration to Model Service: {str(e)}")
            
    except TransientError as e:
        logger.error(f"Transient error occurred: {str(e)}")
        db.close()
        raise e
    except PermanentError as e:
        logger.error(f"Permanent error occurred: {str(e)}")
        db.close()
        return True # Acknowledge queue to remove the failing message from queue
    finally:
        db.close()

def run_training_pipeline(model_id: str, dataset_path: str, algorithm: str, event_id: str):
    """Loads CSV, trains scikit-learn, evaluates, and dumps joblib binary."""
    # 1. Load dataset
    if not os.path.exists(dataset_path):
        raise PermanentError(f"Dataset file not found at path: {dataset_path}")
        
    try:
        df = pd.read_csv(dataset_path)
    except Exception as e:
        raise PermanentError(f"Failed to read CSV dataset: {str(e)}")
        
    if df.empty or df.shape[1] < 2:
        raise PermanentError("Invalid dataset: empty or contains fewer than 2 columns")

    # Determine features X and target y
    target_col = "target"
    if target_col not in df.columns:
        # Use last column as target if "target" is not explicitly present
        target_col = df.columns[-1]
        
    y = df[target_col]
    X = df.drop(columns=[target_col])
    
    # Fill numeric NaNs and dummy encode categoricals
    X = pd.get_dummies(X)
    X = X.fillna(X.mean())

    # Split dataset
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # 2. Select Algorithm
    alg_lower = algorithm.lower()
    if alg_lower == "random_forest":
        model = RandomForestClassifier(n_estimators=10, random_state=42)
    elif alg_lower == "logistic_regression":
        model = LogisticRegression(max_iter=1000, random_state=42)
    elif alg_lower == "gradient_boosting":
        model = GradientBoostingClassifier(n_estimators=10, random_state=42)
    else:
        raise PermanentError(f"Unsupported algorithm parameter: '{algorithm}'")

    # 3. Train
    try:
        model.fit(X_train, y_train)
    except Exception as e:
        raise PermanentError(f"Model training fit failed: {str(e)}")

    # 4. Evaluate
    try:
        predictions = model.predict(X_test)
        accuracy = float(accuracy_score(y_test, predictions))
        metrics = {"accuracy": accuracy}
    except Exception as e:
        raise PermanentError(f"Evaluation metrics calculation failed: {str(e)}")

    # 5. Save Artifact
    os.makedirs(settings.MODEL_STORAGE_DIR, exist_ok=True)
    
    # Determine model version securely utilizing Model Service auto-generation
    version_str = "auto"
    
    # Save using event_id to ensure artifact path is perfectly unique regardless of version
    artifact_name = f"{model_id}_{event_id}.joblib"
    artifact_path = os.path.join(settings.MODEL_STORAGE_DIR, artifact_name)
    
    try:
        joblib.dump(model, artifact_path)
    except Exception as e:
        raise TransientError(f"Failed to write model binary artifact to storage volume: {str(e)}")

    return metrics, artifact_path, version_str
