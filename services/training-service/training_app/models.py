from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from .database import Base

class TrainingJob(Base):
    __tablename__ = "training_jobs"

    id = Column(String(36), primary_key=True) # UUID string
    model_id = Column(String(255), nullable=False) # string identifier, no DB FK constraint
    status = Column(String(50), nullable=False) # 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'
    algorithm = Column(String(100), nullable=False)
    retry_count = Column(Integer, default=0, nullable=False)
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
