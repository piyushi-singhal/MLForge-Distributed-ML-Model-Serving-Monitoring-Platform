# Incident Report: INC-001 Prediction Service Crash

**Incident:** Prediction service container unexpected crash
**Date:** 2026-08-09
**Severity:** Low (Degraded Performance)
**Affected Service:** Prediction Service

## Symptoms
- Momentary spike in HTTP 502/503 errors visible on Grafana dashboard.

## Detection
- Detected via Prometheus alerting on Nginx upstream targets.
- Operator observed container `mlforge-prediction-service-1` exited unexpectedly.

## Timeline
- T+0: Container intentionally killed (`docker stop`) to simulate OOM crash.
- T+2s: Nginx upstream health checks marked the node as dead.
- T+3s: Nginx routed all subsequent traffic to remaining healthy replicas (Prediction 2 and 3).

## Root Cause
- Simulated application crash (e.g. Out of Memory error or segmentation fault).

## Impact
- None on system availability. 
- The system remained highly available because Nginx load-balances across 3 scaled instances. A fraction of requests inflight during the exact second of the crash failed.

## Resolution
- System inherently resolved the routing issue via Nginx upstream checks.
- Container orchestration (Docker Compose/Kubernetes) would normally restart the container automatically.

## Preventive Action
- Ensure horizontal scaling is permanently configured with at least 3 replicas.

## Regression Test
- Load test with locust (`locustfile.py`) during rolling restarts to confirm 0 downtime.
