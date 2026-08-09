from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime

class TrainingJobCreate(BaseModel):
    model_id: str = Field(..., description="The ID/name of the model to train")
    dataset_path: str = Field(..., description="URL or path to the training dataset (CSV, Parquet, etc.)")
    algorithm: str = Field(..., description="The ML algorithm to use for training (e.g. random_forest)")

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
