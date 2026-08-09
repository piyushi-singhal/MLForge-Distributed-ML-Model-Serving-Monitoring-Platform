import time
import uuid
import httpx
import pytest

# Assuming the Docker Compose cluster is running locally, exposing Nginx on port 80.
BASE_URL = "http://localhost:80/api"

# We use a unique suffix so tests don't collide if run multiple times
TEST_SUFFIX = str(uuid.uuid4())[:8]

def test_mlforge_golden_path():
    """
    Executes the golden-path integration test for MLForge.
    Register -> Login -> Create model -> Submit training job -> Wait for training completion 
    -> Activate version -> Submit prediction -> Repeat prediction (Cache Hit).
    """
    client = httpx.Client(timeout=10.0)

    # 1. Register
    username = f"testuser_{TEST_SUFFIX}"
    password = "securepassword123"
    reg_response = client.post(f"{BASE_URL}/auth/register", json={
        "username": username,
        "email": f"{username}@example.com",
        "password": password
    })
    assert reg_response.status_code == 201, f"Registration failed: {reg_response.text}"
    user_id = reg_response.json()["id"]

    # 2. Login
    login_response = client.post(f"{BASE_URL}/auth/login", json={
        "email": f"{username}@example.com",
        "password": password
    })
    assert login_response.status_code == 200, f"Login failed: {login_response.text}"
    token = login_response.json()["access_token"]
    
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Create Model
    model_name = f"test-model-{TEST_SUFFIX}"
    model_response = client.post(f"{BASE_URL}/models/", json={
        "id": model_name,
        "name": model_name,
        "description": "E2E Test Model"
    }, headers=headers)
    assert model_response.status_code == 201, f"Model creation failed: {model_response.text}"
    model_id = model_response.json()["id"]

    # 4. Submit Training Job
    train_response = client.post(f"{BASE_URL}/training/jobs", json={
        "model_id": model_id,
        "dataset_url": "s3://dummy-bucket/test_data.csv",
        "parameters": {"epochs": 1, "learning_rate": 0.01}
    }, headers=headers)
    assert train_response.status_code == 202, f"Training submission failed: {train_response.text}"
    job_id = train_response.json()["job_id"]

    # 5. Poll for Training Completion (Wait up to 30 seconds)
    max_retries = 15
    job_status = "PENDING"
    version_id = None
    for i in range(max_retries):
        status_resp = client.get(f"{BASE_URL}/training/jobs/{job_id}", headers=headers)
        assert status_resp.status_code == 200
        job_data = status_resp.json()
        job_status = job_data["status"]
        if job_status == "COMPLETED":
            # Worker creates a new model version upon completion. Let's find it.
            # Assuming the worker set the version name in the job metadata or we just fetch the latest version.
            break
        elif job_status == "FAILED":
            pytest.fail("Training job failed unexpectedly.")
        time.sleep(2)

    assert job_status == "COMPLETED", "Training job did not complete in time."

    # Fetch the newly created version for this model
    versions_resp = client.get(f"{BASE_URL}/models/{model_id}/versions", headers=headers)
    assert versions_resp.status_code == 200
    versions = versions_resp.json()
    assert len(versions) > 0, "No model versions found after successful training."
    
    # We take the first created version (which the worker just created)
    version_id = versions[0]["id"]
    version_name = versions[0]["version"]

    # 6. Activate Version
    activate_resp = client.post(f"{BASE_URL}/models/{model_id}/versions/{version_id}/activate", headers=headers)
    assert activate_resp.status_code == 200, f"Failed to activate version: {activate_resp.text}"

    # 7. Submit Prediction (Cache Miss)
    predict_payload = {
        "model_id": model_name,
        "model_version": version_name,
        "features": {
            "feature_a": 1.5,
            "feature_b": 2.5
        }
    }
    
    # Send via gateway or directly? The prediction service is exposed on Nginx directly at /api/predictions/
    # Nginx config maps /api/predictions/ -> prediction_backends
    pred_response_1 = client.post(f"{BASE_URL}/predictions/", json=predict_payload, headers=headers)
    
    assert pred_response_1.status_code == 200, f"Prediction 1 failed: {pred_response_1.text}"
    pred_data_1 = pred_response_1.json()
    assert "prediction" in pred_data_1

    # 8. Submit Prediction Again (Cache Hit)
    pred_response_2 = client.post(f"{BASE_URL}/predictions/", json=predict_payload, headers=headers)
    
    assert pred_response_2.status_code == 200, f"Prediction 2 failed: {pred_response_2.text}"
    pred_data_2 = pred_response_2.json()
    assert "prediction" in pred_data_2
    assert pred_data_1["prediction"] == pred_data_2["prediction"]
    
    print("Golden path end-to-end test completed successfully!")
