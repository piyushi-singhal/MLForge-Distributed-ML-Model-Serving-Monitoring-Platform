import json
import random
from locust import HttpUser, task, between

class MLForgePredictionUser(HttpUser):
    wait_time = between(1, 2)
    
    @task
    def predict(self):
        # We assume a model "test-model" with version "v1" is trained and active.
        # Since this is a test, the prediction service should handle missing models gracefully (e.g. 404/500).
        # To truly test caching and load balancing, we send deterministic inputs.
        
        # Simulating random traffic with a small set of deterministic inputs to get some cache hits and some misses
        feature_a = random.choice([1.0, 2.0, 3.0, 4.0, 5.0])
        feature_b = random.choice([10.5, 20.5, 30.5])
        
        payload = {
            "model_id": "test-model",
            "model_version": "v1",
            "features": {
                "feature_a": feature_a,
                "feature_b": feature_b
            }
        }
        
        self.client.post("/api/predictions/", json=payload)
