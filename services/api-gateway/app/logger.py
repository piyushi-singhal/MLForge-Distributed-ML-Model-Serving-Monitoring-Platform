import logging
import json
import time
from contextvars import ContextVar

request_id_var = ContextVar("request_id", default="unknown")

def set_request_id(request_id: str):
    request_id_var.set(request_id)

class JsonFormatter(logging.Formatter):
    def __init__(self, service_name):
        super().__init__()
        self.service_name = service_name

    def format(self, record):
        # Allow passing 'event' and 'latency_ms' via extra dict
        event = getattr(record, "event", record.getMessage())
        
        log_data = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(record.created)),
            "level": record.levelname,
            "service": self.service_name,
            "request_id": request_id_var.get(),
            "event": event,
            "message": record.getMessage(),
        }
        
        if hasattr(record, "latency_ms"):
            log_data["latency_ms"] = record.latency_ms
            
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
            
        return json.dumps(log_data)

def setup_logger(service_name: str) -> logging.Logger:
    logger = logging.getLogger(service_name)
    logger.setLevel(logging.INFO)
    
    # Clear existing handlers
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
        
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter(service_name))
    logger.addHandler(handler)
    
    # Disable propagation so we don't get double logs from uvicorn root logger
    logger.propagate = False
    
    return logger
