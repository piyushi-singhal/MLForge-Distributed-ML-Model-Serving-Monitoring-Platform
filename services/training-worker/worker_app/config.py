import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    POSTGRES_HOST: str | None = None
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "mlforge"
    POSTGRES_USER: str = "mlforge"
    POSTGRES_PASSWORD: str = "mlforge_dev_pwd"

    RABBITMQ_HOST: str = "localhost"
    RABBITMQ_PORT: int = 5672
    RABBITMQ_USER: str = "guest"
    RABBITMQ_PASSWORD: str = "guest"
    
    MODEL_STORAGE_DIR: str = "./storage/models"
    MODEL_SERVICE_URL: str = "http://localhost:8002"

    @property
    def database_url(self) -> str:
        if self.POSTGRES_HOST:
            return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        return "sqlite:///./worker.db"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
