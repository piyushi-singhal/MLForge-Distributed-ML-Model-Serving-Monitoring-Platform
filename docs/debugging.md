# Debugging Distributed Failures

In a microservice architecture, a single user action may traverse 3-5 different services, message queues, and databases. When a failure occurs, identifying the root cause requires a systematic approach.

## The Power of the Correlation ID (`X-Request-ID`)

Every incoming request to the API Gateway is assigned a unique `X-Request-ID`. This ID is injected into the HTTP headers and forwarded to every internal microservice. 

### Step-by-Step Debugging Example

**Scenario**: A user reports receiving a `500 Internal Server Error` when trying to submit a prediction.

1. **Check the Gateway Logs**
   - Search the API Gateway logs for 500 errors.
   - You find: `{"level": "ERROR", "message": "500 Internal Server Error", "request_id": "req-9876-uuid"}`
   - *Result*: You now have the Correlation ID (`req-9876-uuid`).

2. **Follow the Request ID**
   - Grep all service logs for `req-9876-uuid`.
   - `grep "req-9876-uuid" /var/logs/mlforge/*`
   - You see the request reached the **Prediction Service**.

3. **Check the Prediction Service**
   - Log: `{"service": "prediction-service", "request_id": "req-9876-uuid", "message": "Cache miss, fetching model metadata"}`
   - Next Log: `{"service": "prediction-service", "request_id": "req-9876-uuid", "level": "ERROR", "message": "Failed to contact Model Service"}`
   - *Result*: The Prediction Service is failing because it cannot reach the Model Service.

4. **Check the Model Service**
   - Wait, there are no logs for `req-9876-uuid` in the Model Service!
   - This means the network request never arrived.

5. **Identify the Root Cause**
   - Check infrastructure: The Model Service container is caught in a crash-loop.
   - Why? Checking Model Service startup logs reveals: `sqlalchemy.exc.OperationalError: FATAL: too many connections for role "model_db"`
   - *Conclusion*: A connection leak in the Model Service exhausted PostgreSQL connections, causing it to crash. The Prediction Service timed out trying to reach it, resulting in the 500 returned to the user.

## Golden Rules for Troubleshooting

1. **Audit Dashboards First**: Before diving into logs, look at the Grafana dashboards. Are memory metrics spiking? Is Redis showing 100% CPU?
2. **Health Checks**: Always ping `/health` and `/ready` on the suspected services.
3. **Never Guess, Trace**: Always start with the `X-Request-ID`. Guessing which service failed based on symptoms often leads to wasted hours.
