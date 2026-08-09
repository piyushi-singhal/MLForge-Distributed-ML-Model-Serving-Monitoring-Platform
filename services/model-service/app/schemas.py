from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Any

class ModelBase(BaseModel):
    id: str
    name: str
    description: str | None = None

class ModelCreate(ModelBase):
    created_by: int | None = None

class ModelResponse(ModelBase):
    created_by: int | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ModelVersionCreate(BaseModel):
    version: str
    algorithm: str
    artifact_path: str
    metrics_json: dict[str, Any] | None = {}
    status: str = "TRAINING"

class ModelVersionResponse(ModelVersionCreate):
    id: int
    model_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
