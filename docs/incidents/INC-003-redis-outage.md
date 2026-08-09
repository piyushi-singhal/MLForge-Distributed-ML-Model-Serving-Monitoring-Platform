# Incident Report: INC-003 Redis Cache Outage

**Incident:** Redis Cache Server Unreachable
**Date:** 2026-08-09
**Severity:** Low (Performance Degradation)
**Affected Service:** Prediction Service

## Symptoms
- Increased overall system prediction latency (from ~5ms to ~45ms per request).
- Cache MISS rate spiked to 100%.

## Detection
- Detected via Prometheus alerting on HTTP request latency p95.
- Application logs emitted `WARNING: Redis connection failed. Bypassing cache for prediction.`

## Timeline
- T+0: Redis container stopped intentionally.
- T+1s: Incoming prediction requests attempt to connect to Redis and timeout/fail.
- T+1s: Prediction service exception handler catches `redis.exceptions.ConnectionError`.
- T+2s: Prediction service degrades gracefully, querying the PostgreSQL DB for model metadata and loading the joblib artifact directly from disk.
- T+2s: Prediction successfully returned to the user, bypassing the cache entirely.

## Root Cause
- Simulated Redis node failure.

## Impact
- **No downtime.** 100% of prediction requests still succeeded.
- System suffered a latency penalty (degraded performance) due to disk I/O fallback, but maintained complete availability.

## Resolution
- System natively handles cache unavailability gracefully.
- Once Redis was restarted, the service automatically re-established the connection pool and cache HITs resumed.

## Preventive Action
- Keep the `try/except` block around Redis calls in the prediction service. Ensure Redis connection timeouts are kept short (e.g., 1-2 seconds) so that an offline cache doesn't block the request lifecycle for too long.

## Regression Test
- Execute automated chaos test that shuts down Redis during a locust load test to confirm 0% error rate.
