from pydantic import BaseModel, ConfigDict
from datetime import datetime

class TrainingJobCreate(BaseModel):
    model_id: str
    dataset_path: str
    algorithm: str

class TrainingJobResponse(BaseModel):
    id: str
    model_id: str
    status: str
    algorithm: str
    retry_count: int
    error_message: str | None = None
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
