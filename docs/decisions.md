# Architecture Decision Records (ADR)

This document tracks the significant architectural decisions made during the development of MLForge.

---

## ADR-001 — Asynchronous Training via RabbitMQ

**Date**: 2026-08-01  
**Status**: Accepted

### Context
Training machine learning models is a compute-intensive operation that can take anywhere from minutes to hours. Initially, a monolithic approach might handle this synchronously via a direct HTTP call.

### Decision
We will use **RabbitMQ** to decouple the HTTP API from the actual model training compute. The Training Service will publish a message to a queue and instantly return a `202 Accepted` to the client. Dedicated Training Worker nodes will consume jobs from this queue.

### Reason
Synchronous HTTP calls will time out, causing poor user experience and locking up web server threads. 

### Alternatives Considered
- **Synchronous HTTP**: Rejected (Times out, blocks threads).
- **Redis Queue (RQ/Celery)**: Rejected (Lacks advanced routing features and robust Dead-Letter Queues compared to RabbitMQ).
- **Kafka**: Rejected (Overkill for our event throughput; Kafka is optimized for massive event streaming and log aggregation, whereas RabbitMQ is optimized for task routing and strict delivery acknowledgements).

---

## ADR-002 — PostgreSQL for Distributed Idempotency

**Date**: 2026-08-03  
**Status**: Accepted

### Context
Message queues provide "at-least-once" delivery guarantees. Under certain failure scenarios (e.g., network timeout during ACK), a worker might receive the same training job twice.

### Decision
We will generate a unique `event_id` (UUID) for every job. Before a worker begins training, it attempts to insert this `event_id` into a PostgreSQL `processed_events` table configured with a `UNIQUE` constraint.

### Reason
This guarantees exactly-once processing semantics without relying on complex distributed locking mechanisms like Redis Redlock or Zookeeper.

### Alternatives Considered
- **Redis Distributed Locks**: Rejected (Can suffer from split-brain scenarios or TTL expirations on extremely long-running jobs).
- **No Idempotency Check**: Rejected (Would result in duplicate model versions and wasted compute).

---

## ADR-003 — Stateless Prediction Service

**Date**: 2026-08-05  
**Status**: Accepted

### Context
The Prediction API requires extremely low latency and high availability to serve real-time client inference requests.

### Decision
The Prediction Service will not store any session data, nor will it permanently pin models in memory. It will dynamically load requested model binaries from the shared storage volume and aggressively cache exact-match inference results in an external Redis cluster.

### Reason
Stateless services allow infinite horizontal scaling. By delegating state to Redis, we can spin up dozens of Prediction Service replicas behind an Nginx load balancer to handle arbitrary traffic spikes.

### Alternatives Considered
- **In-Memory LRU Caches**: Rejected (If Replica A caches a prediction, Replica B doesn't know about it, causing redundant compute).
- **Sticky Sessions**: Rejected (Causes uneven load balancing if certain users make significantly more requests than others).
