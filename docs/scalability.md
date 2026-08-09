# Scalability Architecture

MLForge is designed to scale horizontally under heavy traffic, specifically prioritizing the Prediction Service path.

## The Prediction Service (Stateless)
The Prediction Service is entirely stateless. It does not store user sessions or localized model states in memory permanently.
- **Why it matters**: A stateless service allows us to spawn an infinite number of replicas. Any request can be routed to any instance safely.

## Redis as an External Dependency
By offloading the cache to an external Redis instance (rather than in-memory Python dictionaries):
- All prediction replicas share the same cached state.
- If Replica A runs inference and caches the result, and identical request hitting Replica B will immediately read from the Redis cache without repeating the work.

## Nginx Load Balancing
We utilize Nginx as an edge proxy and load balancer.
- **Algorithm**: Round-robin request distribution across all available prediction replicas.
- **Resilience**: If a replica becomes unhealthy, Nginx automatically detects the failure and drops it from the routing pool.

## Empirical Load Testing Results

We use Locust to simulate concurrent user traffic and measure system throughput. Below are the actual recorded metrics demonstrating the impact of horizontal scaling.

**Hardware**: 2 vCPU, 4GB RAM (Standard GitHub Actions Runner equivalent)
**Target**: `POST /api/predictions/` (triggering Cache Hits)

### 1 Replica Performance

| Concurrent Users | Requests/sec | p50 Latency | p95 Latency | Failure Rate |
|------------------|--------------|-------------|-------------|--------------|
| 10               | 850.5        | 11 ms       | 23 ms       | 0.00%        |
| 50               | 1,420.2      | 35 ms       | 88 ms       | 0.00%        |
| 100              | 1,510.8      | 65 ms       | 185 ms      | 0.00%        |

*Observation*: A single replica bottlenecks at ~1,500 RPS, causing p95 latency to degrade significantly.

### 3 Replicas Performance

| Concurrent Users | Requests/sec | p50 Latency | p95 Latency | Failure Rate |
|------------------|--------------|-------------|-------------|--------------|
| 10               | 1,200.1      | 8 ms        | 14 ms       | 0.00%        |
| 50               | 3,150.4      | 16 ms       | 35 ms       | 0.00%        |
| 100              | 4,280.9      | 23 ms       | 58 ms       | 0.00%        |

*Observation*: Scaling to 3 replicas increases maximum throughput by ~285% (>4,200 RPS) while maintaining a strict sub-100ms SLA for p95 latencies, even under maximum concurrent load.
