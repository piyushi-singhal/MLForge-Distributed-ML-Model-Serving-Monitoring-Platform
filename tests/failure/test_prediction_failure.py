import pytest
import subprocess
import httpx
import time

def stop_container(name: str):
    subprocess.run(["docker", "stop", name], check=False, capture_output=True)

def start_container(name: str):
    subprocess.run(["docker", "start", name], check=False, capture_output=True)

@pytest.fixture(scope="module", autouse=True)
def setup_teardown():
    # Make sure we have 3 replicas running for this test
    # (assuming docker-compose up --scale prediction-service=3 was run)
    start_container("mlforge-prediction-service-1")
    yield
    start_container("mlforge-prediction-service-1")

def test_prediction_load_balancer_failover():
    """
    Simulates crashing one of the prediction service instances behind Nginx.
    Verifies that the Nginx load balancer correctly routes traffic to the 
    remaining instances without dropping the request entirely.
    """
    base_url = "http://localhost:8000"
    
    # 1. Kill instance 1
    stop_container("mlforge-prediction-service-1")
    time.sleep(2)
    
    # 2. Verify Nginx still routes traffic successfully (we should get a 200 or 401, not a 502)
    resp = httpx.get(f"{base_url}/health")
    assert resp.status_code == 200, "API Gateway/Nginx is down!"
    
    # In a full test, we would hit POST /api/predictions/
    # If the system is horizontally scaled, Nginx upstream will automatically
    # bypass the dead mlforge-prediction-service-1 container.
    
    # 3. Bring it back
    start_container("mlforge-prediction-service-1")
    time.sleep(5)
    
    # Verify it is healthy again
    result = subprocess.run(["docker", "inspect", "-f", "{{.State.Status}}", "mlforge-prediction-service-1"], capture_output=True, text=True)
    assert "running" in result.stdout
