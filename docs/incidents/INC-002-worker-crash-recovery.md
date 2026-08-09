# Incident Report: INC-002 Worker Crash & Idempotency Recovery

**Incident:** Training Worker crashed mid-processing
**Date:** 2026-08-09
**Severity:** Medium
**Affected Service:** Training Worker, RabbitMQ Queue

## Symptoms
- A training job (`status: RUNNING`) appeared stuck.
- RabbitMQ queue depth briefly spiked.

## Detection
- Detected via Prometheus metrics (`training_messages_processed_total` halted while jobs were enqueued).
- Operator manually simulated crash by stopping the training-worker container.

## Timeline
- T+0: User submits large dataset training job.
- T+1s: Worker receives RabbitMQ message and marks DB status `RUNNING`.
- T+5s: Worker container killed. Message is NOT acknowledged (No ACK sent).
- T+10s: RabbitMQ detects connection loss and re-queues the message.
- T+15s: Worker container restarted.
- T+16s: Worker receives the exact same message again.
- T+17s: Worker checks `processed_events` table for `event_id`. Discovers message is a duplicate.
- T+18s: Worker verifies the original training job is in a `RUNNING` state (indicating a crash, not a completion).
- T+19s: Worker safely resumes processing, completes training, updates status to `COMPLETED`, and ACKs RabbitMQ.

## Root Cause
- Simulated application crash (e.g., node eviction or hardware failure).

## Impact
- None on data integrity. 
- Due to the strict database unique constraint on `event_id` and recovery logic, the system successfully avoided training two separate duplicate models or crashing with a constraint violation.

## Resolution
- System recovered autonomously upon worker restart via RabbitMQ redelivery and idempotency checks.

## Preventive Action
- Idempotency logic is already correctly implemented. Ensure all future worker events include unique `event_id` headers.

## Regression Test
- Added specific `test_idempotency` in unit tests to simulate double-delivery.
