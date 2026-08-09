from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Any

class PredictionInput(BaseModel):
    model_id: str = Field(..., description="The unique ID or name of the model to query")
    model_version: str | None = Field(None, description="Specific model version. If omitted, the ACTIVE version is used.")
    features: dict[str, Any] = Field(..., description="The feature dictionary required by the model for inference")

class PredictionResponse(BaseModel):
    request_id: str = Field(..., description="The unique correlation ID for this request")
    model_id: str = Field(..., description="The queried model ID")
    model_version: str = Field(..., description="The specific version of the model that served this request")
    prediction: Any = Field(..., description="The prediction output from the model")
    confidence: float | None = Field(None, description="The confidence score of the prediction (if applicable)")
    latency_ms: int = Field(..., description="Inference latency in milliseconds")

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
