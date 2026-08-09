# System Reliability & Fault Tolerance

MLForge is engineered to expect and survive infrastructure failures. We do not assume that databases, caches, or network connections are always available.

## Failure Scenarios & Recovery Outcomes

### Scenario 1: Redis Cache Failure
**Context**: The Prediction Service relies on Redis to cache inference results for high throughput.
* **Failure**: The Redis container goes down or network connectivity is lost.
* **Detection**: The `redis-py` client raises a `ConnectionError`.
* **Handling**: The exception is caught at the repository layer. We log a warning (`"Cache unavailable, bypassing"`).
* **Recovery**: The application bypasses the cache entirely and queries PostgreSQL for model metadata, loads the binary from disk, and runs the inference live.
* **Expected Outcome**: The prediction endpoints continue serving `200 OK` responses. Latency increases (cache miss), but the service remains highly available.

### Scenario 2: Training Worker Crash
**Context**: An active training worker is processing a computationally expensive Scikit-Learn pipeline.
* **Failure**: The worker runs out of memory (OOM) and the Linux kernel kills the container process.
* **Detection**: The TCP connection between the worker and RabbitMQ drops unexpectedly without a `Basic.Ack`.
* **Handling**: RabbitMQ's delivery guarantee kicks in. It re-queues the "in-flight" message automatically.
* **Recovery**: The message is instantly redelivered to a healthy worker replica. The new worker uses Idempotency checks to reset the database state and restarts the training.
* **Expected Outcome**: The job successfully reaches the `COMPLETED` state despite the catastrophic crash of the original node. No data is lost.

### Scenario 3: Transient Database Unavailability
**Context**: The system is booting up, or PostgreSQL is undergoing a brief failover.
* **Failure**: Services cannot connect to PostgreSQL.
* **Detection**: SQLAlchemy raises an `OperationalError`.
* **Handling**: Applications wrap database connections in an exponential backoff retry loop (using libraries like `tenacity`).
* **Recovery**: The service sleeps for increasing intervals (2s, 4s, 8s) and retries the connection until successful.
* **Expected Outcome**: Services do not crash on boot. They wait gracefully until the dependency is available, ensuring a stable deployment order.

### Scenario 4: Prediction Service Node Failure
**Context**: We have 3 replicas of the Prediction Service running behind Nginx.
* **Failure**: Replica #2 becomes unresponsive.
* **Detection**: Nginx fails to proxy a request to Replica #2 and receives a timeout.
* **Handling**: Nginx immediately routes the failed request to Replica #3, and marks Replica #2 as "down".
* **Recovery**: Subsequent traffic is exclusively routed to Replicas #1 and #3.
* **Expected Outcome**: The client receives a `200 OK` without realizing a node failed. Throughput capacity decreases slightly, but availability remains at 100%.
