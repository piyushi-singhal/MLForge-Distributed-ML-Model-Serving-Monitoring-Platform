import pika
import json
import logging
import os
from .config import settings

logger = logging.getLogger("training-service.rabbitmq")

def get_rabbitmq_connection():
    if os.environ.get("TESTING") == "True":
        # Return a mock connection or dummy that is not used in test runs
        return None
    credentials = pika.PlainCredentials(settings.RABBITMQ_USER, settings.RABBITMQ_PASSWORD)
    parameters = pika.ConnectionParameters(
        host=settings.RABBITMQ_HOST,
        port=settings.RABBITMQ_PORT,
        credentials=credentials,
        connection_attempts=3,
        retry_delay=2
    )
    return pika.BlockingConnection(parameters)

def setup_rabbitmq():
    """Initializes exchanges, main queues, and dead-letter queues (DLQ)."""
    if os.environ.get("TESTING") == "True":
        logger.info("Mocked setup_rabbitmq in testing environment.")
        return
    try:
        connection = get_rabbitmq_connection()
        channel = connection.channel()

        # 1. Declare the Dead-Letter Exchange (DLX) and Dead-Letter Queue (DLQ)
        dlx_name = "training.exchange.dead"
        dlq_name = "training.dead"
        dlq_routing_key = "training.jobs.dead"

        channel.exchange_declare(exchange=dlx_name, exchange_type="direct", durable=True)
        channel.queue_declare(queue=dlq_name, durable=True)
        channel.queue_bind(exchange=dlx_name, queue=dlq_name, routing_key=dlq_routing_key)

        # 2. Declare the Main Exchange and Main Queue (linked to DLX)
        exchange_name = "training.exchange"
        queue_name = "training.jobs"
        routing_key = "training.jobs.run"

        channel.exchange_declare(exchange=exchange_name, exchange_type="direct", durable=True)
        
        # Configure queue to route failed/rejected messages to the DLX
        queue_args = {
            "x-dead-letter-exchange": dlx_name,
            "x-dead-letter-routing-key": dlq_routing_key
        }
        channel.queue_declare(queue=queue_name, durable=True, arguments=queue_args)
        channel.queue_bind(exchange=exchange_name, queue=queue_name, routing_key=routing_key)

        logger.info("RabbitMQ exchanges and queues successfully declared and bound.")
        connection.close()
    except Exception as e:
        logger.error(f"Failed to setup RabbitMQ queues: {str(e)}")
        # In developer tests or local runs without RabbitMQ, we log and proceed
        if not os.environ.get("TESTING"):
            raise e

def publish_training_job(event_id: str, job_id: str, model_id: str, dataset_path: str, algorithm: str, requested_at: str):
    """Publishes a training task event to the RabbitMQ queue."""
    if os.environ.get("TESTING") == "True":
        logger.info("Mocked publish_training_job in testing environment.")
        return
    connection = get_rabbitmq_connection()
    channel = connection.channel()

    message = {
        "event_id": event_id,
        "job_id": job_id,
        "model_id": model_id,
        "dataset_path": dataset_path,
        "algorithm": algorithm,
        "requested_at": requested_at
    }

    channel.basic_publish(
        exchange="training.exchange",
        routing_key="training.jobs.run",
        body=json.dumps(message),
        properties=pika.BasicProperties(
            delivery_mode=2, # make message persistent on disk
            content_type="application/json"
        )
    )
    connection.close()
    logger.info(f"Published training job {job_id} event {event_id} successfully.")
