# Service Topology

MLForge is decoupled into multiple distinct microservices, each with a single responsibility. This allows for independent scaling, isolated failures, and cleaner codebases.

## Overview

| Service | Responsibility | Database | Communication |
| --- | --- | --- | --- |
| **Auth** | Authentication & User Management | `auth_db` | REST |
| **Model** | Registry, versioning, and metadata | `model_db` | REST |
| **Training** | Job creation and queueing | `training_db` | REST + RabbitMQ |
| **Worker** | Async ML model training | `training_db` | RabbitMQ + REST |
| **Prediction** | Live model inference & caching | `prediction_db` | REST + Redis |
| **Gateway** | Routing, correlation, rate-limiting | — | REST |

## Service Details

### API Gateway (`services/api-gateway`)
- **Role**: The perimeter layer of the application.
- **Why it exists**: Instead of clients calling internal services directly, they call the Gateway. This allows us to centrally enforce SSL/TLS, generate distributed tracing IDs (`X-Request-ID`), and provide a unified API surface.

### Auth Service (`services/auth-service`)
- **Role**: Manages user identities.
- **Why it exists**: It issues JSON Web Tokens (JWTs). Other services do not need to access the `users` table; they merely decode the stateless JWT to verify identity and permissions.

### Model Service (`services/model-service`)
- **Role**: The centralized registry for models.
- **Why it exists**: It tracks model names, active versions, and hyperparameter metadata. When the Prediction service needs to run an inference, it queries the Model service to find the file path of the currently active binary.

### Training Service (`services/training-service`)
- **Role**: Handles client requests to train new models.
- **Why it exists**: Rather than blocking the client HTTP request for 30 minutes while a model trains, this service synchronously validates parameters and immediately publishes a message to RabbitMQ, returning a `202 Accepted` job ID.

### Training Worker (`services/training-worker`)
- **Role**: The heavy lifter.
- **Why it exists**: It continuously listens to RabbitMQ. When a job arrives, it pulls the dataset, trains the Scikit-Learn model, serializes it to disk (`.joblib`), and reports completion back to the database. It is not exposed to HTTP traffic.

### Prediction Service (`services/prediction-service`)
- **Role**: Low-latency inference engine.
- **Why it exists**: Once a model is trained and activated, clients query this service to get predictions. It aggressively caches identical queries in Redis. Because it is completely stateless, we can run dozens of replicas of this service behind Nginx to handle massive traffic spikes.
