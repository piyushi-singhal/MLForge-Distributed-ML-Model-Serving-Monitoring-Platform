import os
import sys
# Resolve parent directory to locate 'app' module and mock RabbitMQ
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ["TESTING"] = "True"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app

# Create in-memory SQLite database for test runs
engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Recreate tables for tests
Base.metadata.create_all(bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

# Override dependency
app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    # Clear tables and recreate before each test to ensure test isolation
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_ready():
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready"}

def test_submit_and_get_training_job():
    # 1. Submit training job (should return HTTP 202 Accepted immediately)
    response = client.post("/training/jobs", json={
        "model_id": "equipment-failure",
        "dataset_path": "/data/example.csv",
        "algorithm": "random_forest"
    })
    assert response.status_code == 202
    data = response.json()
    assert "job_id" in data
    assert data["status"] == "QUEUED"
    assert data["model_id"] == "equipment-failure"
    assert data["algorithm"] == "random_forest"
    job_id = data["id"]

    # 2. Get training job status
    response = client.get(f"/training/jobs/{job_id}")
    assert response.status_code == 200
    job_data = response.json()
    assert job_data["id"] == job_id
    assert job_data["status"] == "QUEUED"
    assert job_data["algorithm"] == "random_forest"

    # 3. Get non-existent training job (should return HTTP 404)
    response = client.get("/training/jobs/non-existent-uuid")
    assert response.status_code == 404
