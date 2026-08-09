from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Any, Optional

class ModelBase(BaseModel):
    id: str
    name: str
    description: str | None = None

class ModelCreate(ModelBase):
    created_by: str | None = Field(None, description="User email or string ID from authorization")

class ModelResponse(ModelBase):
    created_by: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ModelVersionCreate(BaseModel):
    version: str = Field(..., description="Semantic version string (e.g. 'v1', '1.0.0')")
    algorithm: str = Field(..., description="The machine learning algorithm used (e.g. 'random_forest')")
    artifact_path: str = Field(..., description="The S3 or local path to the trained model artifact")
    metrics_json: dict[str, Any] | None = Field({}, description="JSON dictionary containing training metrics (e.g. accuracy, f1)")
    status: str = Field("TRAINING", description="The status of the model version (TRAINING, READY, ACTIVE, ARCHIVED)")

class ModelVersionResponse(ModelVersionCreate):
    id: int
    model_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
