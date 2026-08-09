from sqlalchemy import Column, Integer, String, DateTime, Float, JSON
from sqlalchemy.sql import func
from .database import Base

class PredictionRequest(Base):
    __tablename__ = "prediction_requests"

    id = Column(String(36), primary_key=True) # UUID string
    model_id = Column(String(255), nullable=False) # string identifier, no DB FK constraint
    model_version = Column(String(50), nullable=False)
    input_hash = Column(String(64), nullable=False)
    prediction = Column(JSON, nullable=False) # Store predicted label or values as JSON
    confidence = Column(Float)
    latency_ms = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
