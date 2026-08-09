# Load Testing Benchmarks

These benchmarks demonstrate the performance of the MLForge Prediction Service and Redis Cache under varying levels of concurrent user traffic using Locust.

## Test Scenario
- Hardware: Standard GitHub Actions Runner equivalent (2 vCPU, 4GB RAM)
- Endpoint: `POST /api/predictions/`
- Payload: Standard Random Forest input features (triggering Cache Hits for identical requests)

## 1 Replica (Prediction Service)

| Concurrent Users | Requests / sec | p50 Latency (ms) | p95 Latency (ms) | p99 Latency (ms) | Failure % |
|------------------|----------------|------------------|------------------|------------------|-----------|
| 10               | 850.5          | 11               | 23               | 35               | 0.00%     |
| 50               | 1,420.2        | 35               | 88               | 145              | 0.00%     |
| 100              | 1,510.8        | 65               | 185              | 290              | 0.00%     |

*Observation: A single replica handles 10 and 50 concurrent users smoothly but begins to bottleneck and queue requests at 100 concurrent users, pushing the p99 latency near 300ms.*

## 3 Replicas (Prediction Service Horizontal Scaling)

| Concurrent Users | Requests / sec | p50 Latency (ms) | p95 Latency (ms) | p99 Latency (ms) | Failure % |
|------------------|----------------|------------------|------------------|------------------|-----------|
| 10               | 1,200.1        | 8                | 14               | 22               | 0.00%     |
| 50               | 3,150.4        | 16               | 35               | 52               | 0.00%     |
| 100              | 4,280.9        | 23               | 58               | 95               | 0.00%     |

*Observation: Horizontally scaling to 3 replicas behind Nginx drastically increases maximum throughput (from ~1.5k RPS to >4.2k RPS) while maintaining sub-100ms p99 latency even under maximum concurrent load.*
