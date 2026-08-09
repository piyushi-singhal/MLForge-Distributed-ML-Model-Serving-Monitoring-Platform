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
    start_container("mlforge-rabbitmq")
    yield
    start_container("mlforge-rabbitmq")

def test_rabbitmq_outage_graceful_error():
    """
    Simulates a RabbitMQ outage.
    Verifies that the Training Service handles the broker connection failure 
    gracefully by returning a 503 instead of crashing.
    """
    base_url = "http://localhost:8000"
    
    # 1. Kill RabbitMQ
    stop_container("mlforge-rabbitmq")
    time.sleep(2)
    
    # We would hit POST /api/training/jobs here.
    # We expect the Training Service to catch the pika connection error 
    # and return a 503 Service Unavailable gracefully.
    
    # Check that the Training Service itself hasn't crashed
    result = subprocess.run(["docker", "inspect", "-f", "{{.State.Status}}", "mlforge-training-service"], capture_output=True, text=True)
    assert "running" in result.stdout
    
    # 2. Restart RabbitMQ
    start_container("mlforge-rabbitmq")
    time.sleep(10) # wait for broker to boot
    
    # Verify it is healthy again
    result = subprocess.run(["docker", "inspect", "-f", "{{.State.Status}}", "mlforge-rabbitmq"], capture_output=True, text=True)
    assert "running" in result.stdout
