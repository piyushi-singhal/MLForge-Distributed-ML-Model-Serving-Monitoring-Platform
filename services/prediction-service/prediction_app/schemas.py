from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Any

class PredictionInput(BaseModel):
    model_id: str
    model_version: str | None = None  # If not set, defaults to active model version
    features: dict[str, Any]

class PredictionResponse(BaseModel):
    request_id: str
    model_id: str
    model_version: str
    prediction: Any
    confidence: float | None = None
    latency_ms: int

class PredictionLogResponse(BaseModel):
    id: str
    model_id: str
    model_version: str
    input_hash: str
    prediction: Any
    confidence: float | None = None
    latency_ms: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
