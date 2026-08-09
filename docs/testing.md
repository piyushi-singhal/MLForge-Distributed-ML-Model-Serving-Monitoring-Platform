# Testing Strategy

MLForge relies on a robust, multi-layered testing strategy to guarantee stability across its distributed components. 

## 1. Unit Tests (`tests/unit/`)
Unit tests assert the business logic of individual microservices in isolation. They mock external dependencies (like databases and message queues) to execute rapidly.

**Focus**: Parameter validation, error handling, algorithm execution, caching logic.

**Command**:
```bash
source .venv/bin/activate
pytest tests/unit/
```

## 2. Integration Tests (`tests/integration/`)
Integration tests verify that two or more real components communicate correctly. They do not mock the database or RabbitMQ, but rather spin up ephemeral instances to test against.

**Focus**: PostgreSQL schema insertions, RabbitMQ publishing/consuming, Redis cache setting/getting.

**Command**:
```bash
source .venv/bin/activate
pytest tests/integration/
```

## 3. End-to-End (E2E) Tests (`tests/e2e/`)
E2E tests treat the entire MLForge platform as a black box. They fire HTTP requests through the API Gateway, exactly as a real user would.

**Focus**: 
1. Register -> Login -> Receive JWT
2. Create Model -> Submit Training Job
3. Wait for RabbitMQ Worker -> Job Completes
4. Submit Prediction -> Receive Result -> Verify Cache Hit

**Command**:
```bash
source .venv/bin/activate
pytest tests/e2e/
```

## 4. Failure & Chaos Tests (`tests/failure/`)
These tests simulate catastrophic infrastructure failures to prove the system's fault tolerance and recovery mechanisms. 

**Focus**: 
- `docker stop` on a training worker mid-flight (Verifies RabbitMQ redelivery).
- `docker stop` on Redis (Verifies Prediction service fallback).

**Command**:
```bash
source .venv/bin/activate
pytest tests/failure/
```

## 5. Load Tests (`load-tests/`)
We use Locust to simulate hundreds of concurrent users hammering the API to measure performance degradation, throughput bottlenecks, and horizontal scaling efficiency.

**Focus**: Measuring p50/p95/p99 latencies, Requests per Second (RPS), and failure rates.

**Command**:
```bash
source .venv/bin/activate
locust -f load-tests/locustfile.py --headless -u 100 -r 10 --run-time 1m
```
