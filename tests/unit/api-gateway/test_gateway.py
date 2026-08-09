import sys
import os
# Clear cached app modules to avoid conflicts during pytest collection
for key in list(sys.modules.keys()):
    if key == 'app' or key.startswith('app.'):
        del sys.modules[key]
        
service_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../services/api-gateway'))
if service_path not in sys.path:
    sys.path.insert(0, service_path)

import pytest
from fastapi.testclient import TestClient
import httpx
from unittest.mock import AsyncMock, patch

from gateway_app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_ready():
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready"}

def test_gateway_request_id_generation_and_propagation():
    # 1. Mock the httpx request call
    mock_response = httpx.Response(
        status_code=200,
        content=b'{"user": "test_user"}',
        headers={"content-type": "application/json"}
    )
    
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_request:
        mock_request.return_value = mock_response
        
        # Call endpoint without custom X-Request-ID (should auto-generate and propagate)
        response = client.get("/api/auth/me")
        
        assert response.status_code == 200
        assert response.json() == {"user": "test_user"}
        
        # Verify X-Request-ID is in response headers
        request_id = response.headers.get("X-Request-ID")
        assert request_id is not None
        assert request_id.startswith("req_")
        
        # Verify the downstream request was called with correct headers
        called_args, called_kwargs = mock_request.call_args
        called_headers = called_kwargs["headers"]
        assert called_headers["X-Request-ID"] == request_id
        assert called_headers["x-request-id"] == request_id

def test_gateway_request_id_preservation():
    mock_response = httpx.Response(status_code=200, content=b"{}")
    custom_req_id = "custom_correlation_id_123"
    
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_request:
        mock_request.return_value = mock_response
        
        # Call with explicit request ID
        response = client.get("/api/models/equipment-failure", headers={"X-Request-ID": custom_req_id})
        
        assert response.status_code == 200
        assert response.headers.get("X-Request-ID") == custom_req_id
        
        called_args, called_kwargs = mock_request.call_args
        assert called_kwargs["headers"]["X-Request-ID"] == custom_req_id

def test_gateway_service_unavailable_error():
    with patch("httpx.AsyncClient.request", side_effect=httpx.ConnectError("Connection refused")):
        response = client.get("/api/predictions/some-request")
        
        # Should catch Connection refused and return HTTP 503
        assert response.status_code == 503
        data = response.json()
        assert data["error"] == "SERVICE_UNAVAILABLE"
        assert "request_id" in data
        assert response.headers.get("X-Request-ID") is not None
