from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, JSON
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

class PredictionRequest(Base):
    __tablename__ = "prediction_requests"

    id = Column(String(36), primary_key=True) # UUID string
    model_id = Column(String(255), ForeignKey("models.id", ondelete="CASCADE"), nullable=False)
    model_version = Column(String(50), nullable=False)
    input_hash = Column(String(64), nullable=False)
    prediction = Column(JSON, nullable=False) # Store predicted label or values as JSON
    confidence = Column(Float)
    latency_ms = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
