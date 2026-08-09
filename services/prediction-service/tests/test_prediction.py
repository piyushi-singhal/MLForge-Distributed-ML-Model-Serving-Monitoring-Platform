import os
import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import joblib
from sklearn.linear_model import LogisticRegression
import numpy as np
import json

# Resolve parent directory to locate 'app' module
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ["TESTING"] = "True"

# Mock Redis before importing app.main
class MockRedis:
    def __init__(self):
        self.store = {}
        self.hits = 0
        self.sets = 0

    def get(self, key):
        if key in self.store:
            self.hits += 1
            return self.store[key]
        return None

    def set(self, key, value, ex=None):
        self.store[key] = value
        self.sets += 1
        return True

import app.main as main
mock_redis = MockRedis()
main.redis_client = mock_redis

from app.database import Base, get_db
from app.main import app
from app import models

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

MODEL_PATH = "test_model.joblib"

@pytest.fixture(autouse=True)
def setup_db_and_model():
    # Reset mock counters
    mock_redis.store = {}
    mock_redis.hits = 0
    mock_redis.sets = 0

    # 1. Train and serialize a mock model
    X = np.array([[1.0, 2.0], [2.0, 3.0], [10.0, 11.0], [11.0, 12.0]])
    y = np.array([0, 0, 1, 1])
    mock_model = LogisticRegression()
    mock_model.fit(X, y)
    
    joblib.dump(mock_model, MODEL_PATH)
    
    # 2. Reset database tables
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    yield
    
    # 3. Cleanup model binary
    if os.path.exists(MODEL_PATH):
        os.remove(MODEL_PATH)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_ready():
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready"}

def test_predictions_caching_hit_and_miss():
    # 1. First request -> Cache MISS (should call model fit and save to cache)
    payload = {
        "model_id": "equipment-failure",
        "features": {"feature1": 12.0, "feature2": 13.0}
    }
    response = client.post("/predictions", json=payload)
    assert response.status_code == 200
    assert mock_redis.sets == 1
    assert mock_redis.hits == 0
    
    # 2. Second request -> Cache HIT (should return from mock redis store directly)
    response_hit = client.post("/predictions", json=payload)
    assert response_hit.status_code == 200
    assert mock_redis.hits == 1
    assert mock_redis.sets == 1 # sets remains 1, no duplicate write
    
    # Verify both responses returned identical predictions
    assert response.json()["prediction"] == response_hit.json()["prediction"]
