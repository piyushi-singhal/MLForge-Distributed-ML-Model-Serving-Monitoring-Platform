from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.sql import func
from .database import Base

class Model(Base):
    __tablename__ = "models"
    id = Column(String(255), primary_key=True)
    name = Column(String(255), nullable=False)

class ModelVersion(Base):
    __tablename__ = "model_versions"
    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(String(255), ForeignKey("models.id", ondelete="CASCADE"), nullable=False)
    version = Column(String(50), nullable=False)
    algorithm = Column(String(100), nullable=False)
    artifact_path = Column(String(512), nullable=False)
    metrics_json = Column(JSON, default={})
    status = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class TrainingJob(Base):
    __tablename__ = "training_jobs"
    id = Column(String(36), primary_key=True)
    model_id = Column(String(255), ForeignKey("models.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), nullable=False)
    algorithm = Column(String(100), nullable=False)
    retry_count = Column(Integer, default=0, nullable=False)
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))

class ProcessedEvent(Base):
    __tablename__ = "processed_events"
    event_id = Column(String(36), primary_key=True)
    processed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    status = Column(String(50), nullable=False)
