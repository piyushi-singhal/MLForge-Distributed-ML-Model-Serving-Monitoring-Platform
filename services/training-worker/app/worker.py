import os
import time
import json
import logging
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

logger = logging.getLogger("training-worker")

class TransientError(Exception):
    """Raised for issues like temporary DB disconnects that are worth retrying."""
    pass

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
        
        # 2. Check Idempotency (Atomic event_id log insertion)
        try:
            processed_event = models.ProcessedEvent(event_id=event_id, status="RUNNING")
            db.add(processed_event)
            db.commit()
        except IntegrityError:
            db.rollback()
            logger.warning(f"Duplicate event {event_id} detected. Skipping processing.")
            return True # Successfully handled (duplicate ignored)
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
            metrics_json, artifact_path, version_str = run_training_pipeline(model_id, dataset_path, algorithm)
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
            logger.info(f"Registering model version via HTTP POST to {url} payload={payload}")
            
            # Use test mode check to skip HTTP call in mock unit tests
            if os.environ.get("TESTING") == "True":
                logger.info("Skipped registration HTTP call in test environment.")
            else:
                resp = httpx.post(url, json=payload, timeout=5.0)
                if resp.status_code not in (200, 201, 409):
                    raise TransientError(f"Model Service returned unexpected code {resp.status_code}: {resp.text}")
            
            job.status = "COMPLETED"
            job.completed_at = datetime.now(timezone.utc)
            processed_event.status = "COMPLETED"
            db.commit()
            logger.info(f"Successfully finished job {job_id} model version {version_str}")
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

def run_training_pipeline(model_id: str, dataset_path: str, algorithm: str):
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
    
    # Determine model version string by calling Model Service endpoint
    version_str = f"v{int(time.time())}" # Default/fallback version string
    if os.environ.get("TESTING") != "True":
        try:
            url = f"{settings.MODEL_SERVICE_URL}/models/{model_id}/versions"
            resp = httpx.get(url, timeout=5.0)
            if resp.status_code == 200:
                versions = resp.json()
                version_str = f"v{len(versions) + 1}"
        except Exception as e:
            logger.warning(f"Failed to query model versions, falling back to timestamp version: {str(e)}")
    else:
        version_str = "v1"
    
    artifact_name = f"{model_id}_{version_str}.joblib"
    artifact_path = os.path.join(settings.MODEL_STORAGE_DIR, artifact_name)
    
    try:
        joblib.dump(model, artifact_path)
    except Exception as e:
        raise TransientError(f"Failed to write model binary artifact to storage volume: {str(e)}")

    return metrics, artifact_path, version_str
