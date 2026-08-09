from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    AUTH_SERVICE_URL: str = "http://localhost:8001"
    MODEL_SERVICE_URL: str = "http://localhost:8002"
    TRAINING_SERVICE_URL: str = "http://localhost:8003"
    PREDICTION_SERVICE_URL: str = "http://localhost:8004"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
