from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.sql import func
from .database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)

class Model(Base):
    __tablename__ = "models"

    id = Column(String(255), primary_key=True)  # string identifier like 'equipment-failure'
    name = Column(String(255), nullable=False)
    description = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class ModelVersion(Base):
    __tablename__ = "model_versions"

    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(String(255), ForeignKey("models.id", ondelete="CASCADE"), nullable=False)
    version = Column(String(50), nullable=False)
    algorithm = Column(String(100), nullable=False)
    artifact_path = Column(String(512), nullable=False)
    metrics_json = Column(JSON, default={})
    status = Column(String(50), nullable=False) # 'TRAINING', 'READY', 'ACTIVE', 'FAILED', 'ARCHIVED'
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
