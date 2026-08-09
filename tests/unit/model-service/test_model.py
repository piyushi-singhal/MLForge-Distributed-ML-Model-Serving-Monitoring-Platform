import sys
import os
# Clear cached app modules to avoid conflicts during pytest collection
for key in list(sys.modules.keys()):
    if key == 'app' or key.startswith('app.'):
        del sys.modules[key]
        
service_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../services/model-service'))
if service_path not in sys.path:
    sys.path.insert(0, service_path)

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app

# Create in-memory SQLite database for test runs
from sqlalchemy.pool import StaticPool
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
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

def test_model_creation():
    # 1. Create model
    response = client.post("/models", json={
        "id": "equipment-failure",
        "name": "Equipment Failure Model",
        "description": "Predicts component failures",
        "created_by": "test-user-email@example.com"
    })
    assert response.status_code == 201
    data = response.json()
    assert data["id"] == "equipment-failure"
    assert data["name"] == "Equipment Failure Model"
    assert data["created_by"] == "test-user-email@example.com"
    assert "created_at" in data

    # 2. Duplicate model registration (should conflict)
    response = client.post("/models", json={
        "id": "equipment-failure",
        "name": "Duplicate Model Name",
        "description": "This should fail"
    })
    assert response.status_code == 409

def test_list_and_get_models():
    # Register models
    client.post("/models", json={"id": "model-a", "name": "Model A"})
    client.post("/models", json={"id": "model-b", "name": "Model B"})

    # 1. List models
    response = client.get("/models")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert {m["id"] for m in data} == {"model-a", "model-b"}

    # 2. Get specific model
    response = client.get("/models/model-a")
    assert response.status_code == 200
    assert response.json()["name"] == "Model A"

    # 3. Get non-existent model
    response = client.get("/models/non-existent")
    assert response.status_code == 404

def test_version_registration_and_activation():
    # Register model first
    client.post("/models", json={"id": "churn-prediction", "name": "Churn Model"})

    # 1. Register version 1 (status READY)
    response = client.post("/models/churn-prediction/versions", json={
        "version": "v1",
        "algorithm": "logistic_regression",
        "artifact_path": "/data/models/v1.joblib",
        "metrics_json": {"accuracy": 0.85},
        "status": "READY"
    })
    assert response.status_code == 201
    v1_id = response.json()["id"]

    # 2. Register version 2 (status ACTIVE)
    response = client.post("/models/churn-prediction/versions", json={
        "version": "v2",
        "algorithm": "random_forest",
        "artifact_path": "/data/models/v2.joblib",
        "metrics_json": {"accuracy": 0.91},
        "status": "ACTIVE"
    })
    assert response.status_code == 201
    v2_id = response.json()["id"]

    # 3. List versions
    response = client.get("/models/churn-prediction/versions")
    assert response.status_code == 200
    versions = response.json()
    assert len(versions) == 2

    # 4. Activate version 1 (should automatically change version 2 from ACTIVE to READY)
    response = client.post(f"/models/churn-prediction/versions/{v1_id}/activate")
    assert response.status_code == 200
    assert response.json()["status"] == "ACTIVE"

    # Verify version 2 is now set to READY
    response = client.get(f"/models/churn-prediction/versions/{v2_id}")
    assert response.status_code == 200
    assert response.json()["status"] == "READY"
    
    # 5. Invalid status check constraint
    response = client.post("/models/churn-prediction/versions", json={
        "version": "v3",
        "algorithm": "random_forest",
        "artifact_path": "/data/models/v3.joblib",
        "status": "INVALID_STATUS"
    })
    assert response.status_code == 422
