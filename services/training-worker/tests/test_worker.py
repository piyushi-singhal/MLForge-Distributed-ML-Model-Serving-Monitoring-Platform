import os
import sys
import json
import pytest
import pandas as pd
import uuid

# Resolve parent directory to locate 'app' module
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ["TESTING"] = "True"

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
import app.worker as worker
from app import models

# Create in-memory SQLite database for test runs
engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Recreate tables for tests
Base.metadata.create_all(bind=engine)

# Override local SessionLocal inside the worker module to use the test engine!
worker.SessionLocal = TestingSessionLocal

DATASET_PATH = "test_dataset.csv"

@pytest.fixture(autouse=True)
def setup_test_environment():
    # 1. Create a dummy CSV dataset
    df = pd.DataFrame({
        "feature1": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0],
        "feature2": [10.0, 9.0, 8.0, 7.0, 6.0, 5.0, 4.0, 3.0, 2.0, 1.0],
        "target": [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]
    })
    df.to_csv(DATASET_PATH, index=False)
    
    # 2. Reset database tables
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    yield
    
    # 3. Clean up dataset files and model binaries
    if os.path.exists(DATASET_PATH):
        os.remove(DATASET_PATH)
        
    storage_dir = "./storage/models"
    if os.path.exists(storage_dir):
        for f in os.listdir(storage_dir):
            os.remove(os.path.join(storage_dir, f))

def test_successful_training_run():
    event_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())
    model_id = "test-classifier"
    
    message = {
        "event_id": event_id,
        "job_id": job_id,
        "model_id": model_id,
        "dataset_path": DATASET_PATH,
        "algorithm": "random_forest",
        "requested_at": "2026-08-09T12:00:00Z"
    }
    
    # Process
    success = worker.process_training_message(json.dumps(message))
    assert success is True
    
    # Verify DB state
    db = TestingSessionLocal()
    
    # Check job completion
    job = db.query(models.TrainingJob).filter(models.TrainingJob.id == job_id).first()
    assert job is not None
    assert job.status == "COMPLETED"
    assert job.error_message is None
    
    # Check event_id idempotency logging
    event = db.query(models.ProcessedEvent).filter(models.ProcessedEvent.event_id == event_id).first()
    assert event is not None
    assert event.status == "COMPLETED"
    
    # Check binary file was saved (using test mode suffix config path)
    artifact_path = "./storage/models/test-classifier_v1.joblib"
    assert os.path.exists(artifact_path)
    db.close()

def test_idempotency_deduplication():
    event_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())
    model_id = "idempotent-model"
    
    message = {
        "event_id": event_id,
        "job_id": job_id,
        "model_id": model_id,
        "dataset_path": DATASET_PATH,
        "algorithm": "logistic_regression",
        "requested_at": "2026-08-09T12:00:00Z"
    }
    
    # First processing succeeds
    assert worker.process_training_message(json.dumps(message)) is True
    
    # Second processing with same event_id should instantly skip
    assert worker.process_training_message(json.dumps(message)) is True
    
    # Verify only 1 version exists in directory (i.e. wasn't run twice)
    # Check binary files in storage directory
    storage_dir = "./storage/models"
    files = [f for f in os.listdir(storage_dir) if f.startswith("idempotent-model")]
    assert len(files) == 1

def test_missing_dataset_permanent_failure():
    event_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())
    
    message = {
        "event_id": event_id,
        "job_id": job_id,
        "model_id": "missing-data-model",
        "dataset_path": "non_existent_file.csv",
        "algorithm": "random_forest",
        "requested_at": "2026-08-09T12:00:00Z"
    }
    
    assert worker.process_training_message(json.dumps(message)) is True
    
    db = TestingSessionLocal()
    job = db.query(models.TrainingJob).filter(models.TrainingJob.id == job_id).first()
    assert job is not None
    assert job.status == "FAILED"
    assert "not found" in job.error_message.lower()
    db.close()

def test_unsupported_algorithm_permanent_failure():
    event_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())
    
    message = {
        "event_id": event_id,
        "job_id": job_id,
        "model_id": "unsupported-alg-model",
        "dataset_path": DATASET_PATH,
        "algorithm": "unsupported_ml_alg",
        "requested_at": "2026-08-09T12:00:00Z"
    }
    
    assert worker.process_training_message(json.dumps(message)) is True
    
    db = TestingSessionLocal()
    job = db.query(models.TrainingJob).filter(models.TrainingJob.id == job_id).first()
    assert job is not None
    assert job.status == "FAILED"
    assert "unsupported algorithm" in job.error_message.lower()
    db.close()
