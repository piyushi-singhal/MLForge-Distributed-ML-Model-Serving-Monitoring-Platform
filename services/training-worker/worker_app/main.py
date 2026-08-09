import pika
import os
import time
import json
import logging
import signal
import sys
from sqlalchemy.orm import Session

from .config import settings
from .database import engine, Base, SessionLocal
from .worker import process_training_message, TransientError, PermanentError
from . import models

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("training-worker")

# Initialize tables
Base.metadata.create_all(bind=engine)

running = True

def handle_signal(sig, frame):
    global running
    logger.info("Termination signal received. Shutting down worker gracefully...")
    running = False

signal.signal(signal.SIGINT, handle_signal)
signal.signal(signal.SIGTERM, handle_signal)

def get_rabbitmq_connection():
    credentials = pika.PlainCredentials(settings.RABBITMQ_USER, settings.RABBITMQ_PASSWORD)
    parameters = pika.ConnectionParameters(
        host=settings.RABBITMQ_HOST,
        port=settings.RABBITMQ_PORT,
        credentials=credentials,
        connection_attempts=5,
        retry_delay=5
    )
    return pika.BlockingConnection(parameters)

def callback(ch, method, properties, body):
    msg_str = body.decode('utf-8')
    db = SessionLocal()
    job_id = None
    
    try:
        # Parse job_id for state tracking
        try:
            data = json.loads(msg_str)
            job_id = data.get("job_id")
        except Exception:
            pass

        # Process the message
        process_training_message(msg_str)
        ch.basic_ack(delivery_tag=method.delivery_tag)
        
    except TransientError as te:
        # Fetch retry count and apply non-blocking delay queue publish
        retry_count = 0
        if job_id:
            try:
                job = db.query(models.TrainingJob).filter(models.TrainingJob.id == job_id).first()
                if job:
                    job.retry_count += 1
                    retry_count = job.retry_count
                    job.error_message = f"Transient error: {str(te)}"
                    db.commit()
            except Exception as dbe:
                logger.error(f"Failed to increment job retry count in DB: {str(dbe)}")
                db.rollback()

        if retry_count <= 3:
            logger.warning(f"Requeuing job {job_id} after transient failure. Retry {retry_count}/3. Publishing to non-blocking TTL retry queue...")
            # Publish to RabbitMQ delayed retry queue (with 5 seconds TTL)
            try:
                ch.basic_publish(
                    exchange="",
                    routing_key="training.jobs.retry",
                    body=body,
                    properties=properties
                )
                ch.basic_ack(delivery_tag=method.delivery_tag)
            except Exception as pe:
                logger.error(f"Failed to publish to retry queue, falling back to basic requeue: {str(pe)}")
                time.sleep(2)
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
        else:
            logger.error(f"Retries exhausted ({retry_count}/3) for job {job_id}. Rejecting to DLQ...")
            if job_id:
                try:
                    job = db.query(models.TrainingJob).filter(models.TrainingJob.id == job_id).first()
                    if job:
                        job.status = "FAILED"
                        job.error_message = f"Retries exhausted. Final transient error: {str(te)}"
                        db.commit()
                except Exception as dbe:
                    logger.error(f"Failed to update job status to FAILED in DB: {str(dbe)}")
                    db.rollback()
            # Send to DLQ (requeue=False directs it to x-dead-letter-exchange)
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
            
    except Exception as e:
        logger.error(f"Unhandled exception during training callback: {str(e)}")
        # Reject and nack without requeue for permanent crashes so they don't block queue
        if job_id:
            try:
                job = db.query(models.TrainingJob).filter(models.TrainingJob.id == job_id).first()
                if job:
                    job.status = "FAILED"
                    job.error_message = f"Unhandled system error: {str(e)}"
                    db.commit()
            except Exception:
                db.rollback()
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
    finally:
        db.close()

def main():
    if os.environ.get("TESTING") == "True":
        logger.info("Worker run skipped in testing environment.")
        return
        
    logger.info("Starting Training Worker...")
    
    # Establish connection with retry logic
    connection = None
    for attempt in range(1, 6):
        try:
            connection = get_rabbitmq_connection()
            break
        except Exception as e:
            logger.warning(f"RabbitMQ connection attempt {attempt}/5 failed: {str(e)}. Retrying in 5 seconds...")
            time.sleep(5)
            
    if not connection:
        logger.error("Could not connect to RabbitMQ messaging broker. Exiting.")
        sys.exit(1)

    channel = connection.channel()
    
    # Declare main queue
    channel.queue_declare(queue="training.jobs", durable=True, arguments={
        "x-dead-letter-exchange": "training.exchange.dead",
        "x-dead-letter-routing-key": "training.jobs.dead"
    })
    
    # Declare non-blocking retry queue with TTL (5000ms delay) and DLX pointing back to main queue
    channel.queue_declare(queue="training.jobs.retry", durable=True, arguments={
        "x-message-ttl": 5000,
        "x-dead-letter-exchange": "training.exchange",
        "x-dead-letter-routing-key": "training.jobs.run"
    })
    
    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue="training.jobs", on_message_callback=callback)
    
    logger.info("Training worker is waiting for messages. To exit press CTRL+C")
    
    try:
        while running:
            connection.process_data_events(time_limit=1)
    except KeyboardInterrupt:
        logger.info("Stopping training worker loop...")
    finally:
        if connection and not connection.is_closed:
            connection.close()

if __name__ == "__main__":
    main()
