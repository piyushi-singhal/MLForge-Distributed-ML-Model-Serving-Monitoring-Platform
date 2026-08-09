# Incident Report: INC-004 Database Unavailability

**Incident:** PostgreSQL Database Stopped
**Date:** 2026-08-09
**Severity:** High
**Affected Service:** All Microservices

## Symptoms
- System-wide 503 Service Unavailable errors on all stateful endpoints (`/auth/register`, `/models`, `/training/jobs`).
- Prediction requests without a Redis cache HIT fail.

## Detection
- Detected via Prometheus alerting on `/health` and `/ready` endpoints.
- Grafana dashboard showed 100% error rate on database-bound routes.

## Timeline
- T+0: PostgreSQL container stopped intentionally.
- T+1s: Incoming requests attempt to open DB sessions via SQLAlchemy.
- T+10s: Connection timeout reached. Services log `OperationalError: could not connect to server`.
- T+11s: Services return controlled `HTTP 503 Service Unavailable` or `500 Internal Server Error` instead of crashing.
- T+15s: Load balancer `/ready` checks fail, pulling nodes out of rotation if applicable.

## Root Cause
- Simulated Database failure (e.g. disk full, bad migration, network partition).

## Impact
- System cannot accept new users, models, or training jobs.
- Cache-miss predictions fail.
- However, the microservices **did not crash uncontrollably**. The application processes remained alive and continued to serve `/health` checks and correctly formatted error responses.

## Resolution
- System recovered immediately when PostgreSQL was restarted. SQLAlchemy connection pools automatically re-established connectivity to the server.

## Preventive Action
- Ensure database connections use tight timeouts and proper connection pooling parameters to prevent thread exhaustion during an outage.

## Regression Test
- Ensure `tests/verify_db.py` handles connection drops cleanly.
