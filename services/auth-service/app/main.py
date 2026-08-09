from fastapi import FastAPI, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
import jwt
import time
import json
from prometheus_fastapi_instrumentator import Instrumentator
from .logger import setup_logger, set_request_id

logger = setup_logger("auth-service")

from .database import engine, Base, get_db
from .config import settings
from . import models, schemas, security

# Automatically create database tables at startup (e.g. SQLite for local testing)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MLForge Auth Service",
    description="Authentication and identity validation microservice for MLForge",
    version="1.0.0"
)

Instrumentator().instrument(app).expose(app)

@app.middleware("http")
async def structured_logging_middleware(request: Request, call_next):
    start_time = time.time()
    request_id = request.headers.get("x-request-id") or request.headers.get("X-Request-ID", "unknown")
    set_request_id(request_id)
    
    response = await call_next(request)
    
    process_time_ms = (time.time() - start_time) * 1000
    if response.status_code < 400:
        logger.info(f"{request.method} {request.url.path} {response.status_code}", extra={"event": "http_request", "latency_ms": round(process_time_ms, 2)})
    elif response.status_code < 500:
        logger.warning(f"{request.method} {request.url.path} {response.status_code}", extra={"event": "http_request", "latency_ms": round(process_time_ms, 2)})
    else:
        logger.error(f"{request.method} {request.url.path} {response.status_code}", extra={"event": "http_request", "latency_ms": round(process_time_ms, 2)})
        
    return response

# Authentication Bearer scheme
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
security_scheme = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> models.User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        email: str | None = payload.get("email")
        if email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

@app.post("/auth/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists"
        )
    
    # Hash password and store
    hashed_pwd = security.hash_password(user_in.password)
    db_user = models.User(email=user_in.email, password_hash=hashed_pwd)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/auth/login", response_model=schemas.Token)
def login(login_in: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == login_in.email).first()
    if not user or not security.verify_password(login_in.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Generate token
    access_token = security.create_access_token(data={"email": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/auth/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user

@app.get("/health", status_code=status.HTTP_200_OK)
def health():
    return {"status": "healthy"}

@app.get("/ready", status_code=status.HTTP_200_OK)
def ready(db: Session = Depends(get_db)):
    try:
        # Run a simple query to verify database connectivity
        db.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database connection error: {str(e)}"
        )
