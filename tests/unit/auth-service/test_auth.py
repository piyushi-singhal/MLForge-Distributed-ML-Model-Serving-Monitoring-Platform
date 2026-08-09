import sys
import os
# Clear cached app modules to avoid conflicts during pytest collection
for key in list(sys.modules.keys()):
    if key == 'app' or key.startswith('app.'):
        del sys.modules[key]
        
service_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../services/auth-service'))
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

# Override the get_db dependency in the application
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

def test_user_registration():
    # 1. Successful registration
    response = client.post("/auth/register", json={
        "email": "test@example.com",
        "password": "mysecretpassword"
    })
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "id" in data
    assert "created_at" in data
    
    # 2. Duplicate registration (should conflict)
    response = client.post("/auth/register", json={
        "email": "test@example.com",
        "password": "anotherpassword"
    })
    assert response.status_code == 409
    assert response.json()["detail"] == "User with this email already exists"

def test_user_login():
    # Register user first
    client.post("/auth/register", json={
        "email": "login@example.com",
        "password": "loginpassword"
    })
    
    # 1. Successful login
    response = client.post("/auth/login", json={
        "email": "login@example.com",
        "password": "loginpassword"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    
    # 2. Login with wrong password
    response = client.post("/auth/login", json={
        "email": "login@example.com",
        "password": "wrongpassword"
    })
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"
    
    # 3. Login with wrong email
    response = client.post("/auth/login", json={
        "email": "nonexistent@example.com",
        "password": "loginpassword"
    })
    assert response.status_code == 401

def test_get_me():
    email = "me@example.com"
    password = "mypassword"
    
    # Register and login
    client.post("/auth/register", json={"email": email, "password": password})
    login_response = client.post("/auth/login", json={"email": email, "password": password})
    token = login_response.json()["access_token"]
    
    # 1. Get me with valid token
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/auth/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["email"] == email
    
    # 2. Get me with invalid token
    headers_invalid = {"Authorization": "Bearer invalidtokenhere"}
    response = client.get("/auth/me", headers=headers_invalid)
    assert response.status_code == 401
    
    # 3. Get me with missing headers
    response = client.get("/auth/me")
    assert response.status_code == 401 # HTTPBearer returns 401 in newer versions or 403 in older
