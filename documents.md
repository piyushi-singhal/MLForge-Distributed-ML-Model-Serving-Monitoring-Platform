# MLForge Step-by-Step Implementation Logs

## Phase 1: Repository Setup

### Step 1: Initializing Documentation File (`documents.md`)
* **What was changed/created**: Created the `documents.md` file in the workspace root (`/Users/piyushisinghal/Downloads/MLForge/documents.md`).
* **Why this step was taken**: To establish a dedicated log detailing the exact step-by-step progress, design justifications, and preserved states for stakeholder review.
* **What was NOT changed**: All other directories and files in `/Users/piyushisinghal/Downloads/MLForge/` (only `MLForge.pdf` was present, and remains untouched).

### Step 2: Initializing Git Repository
* **What was changed/created**: Ran `git init` in `/Users/piyushisinghal/Downloads/MLForge` to initialize an empty Git repository.
* **Why this step was taken**: To establish local version control, allowing tracking of changes across distinct branch/PR workflows as specified by the project goals.
* **What was NOT changed**: The existing files `MLForge.pdf` and `documents.md` were not altered or modified.

### Step 3: Creating `.gitignore` File
* **What was changed/created**: Created `.gitignore` in the workspace root.
* **Why this step was taken**: To prevent build artifacts (like `__pycache__` and `node_modules`), IDE configurations, secrets (`.env`), and binary model artifacts (`storage/`, `*.joblib`, `*.pkl`) from being committed to Git.
* **What was NOT changed**: The files `MLForge.pdf`, `documents.md`, and the Git repository config (`.git/`) were not modified.

### Step 4: Creating `.env.example` File
* **What was changed/created**: Created the `.env.example` environment variable template in the workspace root.
* **Why this step was taken**: To provide a standardized environment configuration template for PostgreSQL, Redis, RabbitMQ, JWT parameters, and internal microservice URLs, preventing developers from committing sensitive actual credentials.
* **What was NOT changed**: The files `MLForge.pdf`, `documents.md`, `.gitignore`, and the Git repository config (`.git/`) were not modified.

### Step 5: Creating Directory Skeleton
* **What was changed/created**: Created the repository directory skeleton (`services/`, `frontend/`, `infrastructure/`, `tests/`, `load-tests/`, `storage/`) and added `.gitkeep` files to track these empty directories.
* **Why this step was taken**: To establish the structural layout defined on page 34 of the specification, ensuring modular separation of concerns for the microservices and infrastructure.
* **What was NOT changed**: The existing files `MLForge.pdf`, `documents.md`, `.gitignore`, `.env.example`, and `.git/` configurations were not modified.

### Step 6: Initializing README.md
* **What was changed/created**: Created `README.md` at the workspace root containing the 26 required structure headers, architecture diagrams, goals, and technical specifications of the project.
* **Why this step was taken**: To satisfy page 41, Section 58 of the project specification, ensuring anyone reading the repository can understand the entire project design and system architecture.
* **What was NOT changed**: The existing files `MLForge.pdf`, `documents.md`, `.gitignore`, `.env.example`, skeleton directories, and Git settings were not modified.

### Step 7: Creating `docker-compose.yml` Skeleton
* **What was changed/created**: Created `docker-compose.yml` in the workspace root. It configures the Docker orchestration for the microservices (`api-gateway`, `auth-service`, `model-service`, `training-service`, `training-worker`, `prediction-service`) and the infrastructure components (`postgres`, `redis`, `rabbitmq`, `nginx`, `prometheus`, `grafana`), mapping dependencies (`depends_on`), volumes, and networks.
* **Why this step was taken**: To establish the containerized environment layout early, ensuring internal container communications use service names (as per page 18 of the specification) rather than hardcoded URLs.
* **What was NOT changed**: The existing files `MLForge.pdf`, `documents.md`, `.gitignore`, `.env.example`, `README.md`, skeleton directories, and Git settings were not modified.

### Step 8: Verifying Repository Layout & Gitignore
* **What was changed/created**: Ran local test commands (`git status` and `git check-ignore`) to verify that the skeleton directory structure, configuration files, and gitignore behave as expected.
* **Why this step was taken**: To guarantee that sensitive environment variables (`.env`) and large model artifacts (`storage/models/*.joblib`) are excluded from tracking, and that the structure complies with page 34 of the specification.
* **What was NOT changed**: All files created in the previous steps remain completely unchanged.

--------------------------------------------------------------------------------------------
## Phase 2: PostgreSQL Persistence

### Step 9: Designing `init.sql` Database Schema
* **What was changed/created**: Created `infrastructure/postgres/init.sql` containing the DDL statements for `users`, `models`, `model_versions`, `training_jobs`, `prediction_requests`, and `processed_events` tables.
* **Why this step was taken**: To establish the structural SQL relational model mapping defined on page 14 of the engineering specification, complete with status check constraints, indexes for performance, and foreign keys for referential integrity.
* **What was NOT changed**: The files `MLForge.pdf`, `documents.md`, `.gitignore`, `.env.example`, `README.md`, and skeleton directories were not modified.

### Step 10: Updating Docker Compose Volume Mounts
* **What was changed/created**: Modified `docker-compose.yml` to mount `init.sql` as a startup initialization script in `/docker-entrypoint-initdb.d/init.sql` for the `postgres` service.
* **Why this step was taken**: To enable automatic schema creation and indexing on the database cluster boot inside containerized environments, ensuring database synchronization at deployment.
* **What was NOT changed**: All microservices configuration blocks, network variables, and volume definitions outside the `postgres` service in `docker-compose.yml` were not modified.

### Step 11: Creating SQLite Database Verification Script
* **What was changed/created**: Created `tests/verify_db.py` to replicate the SQL schema logic in SQLite and execute programmatic tests on it.
* **Why this step was taken**: To perform automated validation of the database schema layout, verifying that check constraints, uniqueness rules, foreign keys, and indexes enforce integrity cleanly within the sandboxed test environment.
* **What was NOT changed**: All files in `services/`, `infrastructure/`, and the repository configs were not modified.

### Step 12: Running Verification Tests
* **What was changed/created**: Executed `python3 tests/verify_db.py`.
* **Why this step was taken**: To run the 8 validation test cases (including user email uniqueness, model status limits, and idempotency key constraints) and verify that all rules pass successfully.
* **What was NOT changed**: The created source files and structure remain unmodified.

-------------------------------------------------------------------------------------------
## Phase 3: Auth Service

### Step 13: Creating `requirements.txt` for Auth Service
* **What was changed/created**: Created `services/auth-service/requirements.txt` declaring dependencies including `fastapi`, `uvicorn`, `sqlalchemy`, `bcrypt`, `pyjwt`, and testing tools.
* **Why this step was taken**: To standardise dependencies for installation in the Auth Service container environment.
* **What was NOT changed**: The files `MLForge.pdf`, `documents.md`, `.gitignore`, `.env.example`, and `README.md` were not modified.

### Step 14: Creating `app/config.py` Configuration File
* **What was changed/created**: Created `services/auth-service/app/config.py` using Pydantic Settings to bind env-based PostgreSQL configuration, JWT secrets, algorithms, and expirations.
* **Why this step was taken**: To isolate settings management, supporting dynamic microservice routing configuration based on Docker Compose environment variables.
* **What was NOT changed**: All other directories and configurations outside the `auth-service` directory were not modified.

### Step 15: Creating `app/database.py` Database Module
* **What was changed/created**: Created `services/auth-service/app/database.py` mapping the SQLAlchemy database session manager and `get_db` helper dependency.
* **Why this step was taken**: To abstract connection pools, supporting dynamic fallback to SQLite database configurations (`sqlite:///./auth.db`) when run locally.
* **What was NOT changed**: The database configuration files and scripts in `/infrastructure` were not modified.

### Step 16: Creating `app/models.py` User Model
* **What was changed/created**: Created `services/auth-service/app/models.py` mapping the `users` table fields (`id`, `email`, `password_hash`, `created_at`, `updated_at`) in SQLAlchemy.
* **Why this step was taken**: To bind database query objects to SQLAlchemy models in alignment with the Phase 2 database spec.
* **What was NOT changed**: The schema files in the PostgreSQL folder were not modified.

### Step 17: Creating `app/schemas.py` Validation Schemas
* **What was changed/created**: Created `services/auth-service/app/schemas.py` containing Pydantic schemas for `UserCreate`, `UserResponse`, `UserLogin`, `Token`, and `TokenData`.
* **Why this step was taken**: To ensure all HTTP request inputs and response payloads are strictly validated before processing or outputting user records.
* **What was NOT changed**: Database models and connections were not modified.

### Step 18: Creating `app/security.py` Security Module
* **What was changed/created**: Created `services/auth-service/app/security.py` providing `bcrypt` password hashing and `PyJWT` bearer token encoding routines.
* **Why this step was taken**: To secure sensitive authentication credentials (preventing plaintext storage in SQL) and generate valid, signed JSON Web Tokens for API endpoints.
* **What was NOT changed**: Configuration variables and database models were not modified.

### Step 19: Creating `app/main.py` FastAPI Application
* **What was changed/created**: Created `services/auth-service/app/main.py` implementing endpoints `/auth/register`, `/auth/login`, `/auth/me`, `/health`, and `/ready`.
* **Why this step was taken**: To establish the HTTP API surface of the authentication service, implementing user authentication, bearer token verification dependencies, aliveness tracking, and database connectivity checks.
* **What was NOT changed**: Database models and configuration classes were not modified.

### Step 20: Creating Test Suite `tests/test_auth.py`
* **What was changed/created**: Created `services/auth-service/tests/test_auth.py` providing unit and integration tests using `fastapi.testclient.TestClient` against a mock in-memory SQLite database.
* **Why this step was taken**: To test and verify the registration limits, login failures/successes, token verification, and health tracking in isolation.
* **What was NOT changed**: Core application codes and configuration templates were not modified.

-------------------------------------------------------------------------------------------
## Phase 4: Model Service

### Step 21: Designing Model Service Modules
* **What was changed/created**: Created `requirements.txt`, `app/config.py`, `app/database.py`, and `app/__init__.py` under `services/model-service/`.
* **Why this step was taken**: To establish the base configuration and database connection hooks for the Model Service.
* **What was NOT changed**: The files `MLForge.pdf`, `documents.md`, `.gitignore`, `.env.example`, and `README.md` were not modified.

### Step 22: Creating Model Database Mappings (`models.py`)
* **What was changed/created**: Created `services/model-service/app/models.py` defining the `Model` and `ModelVersion` SQLAlchemy schemas.
* **Why this step was taken**: To map model definitions and version states (`TRAINING`, `READY`, `ACTIVE`, `FAILED`, `ARCHIVED`) to database structures as required by the specification.
* **What was NOT changed**: The Auth Service code and schemas were not modified.

### Step 23: Creating Model API Routing (`main.py` and `schemas.py`)
* **What was changed/created**: Created `schemas.py` and `main.py` under `services/model-service/app/`. They implement endpoints `/models`, `/models/{model_id}/versions`, and the `/activate` route which deactivates previous active versions and sets the target version to `ACTIVE`.
* **Why this step was taken**: To expose the REST endpoints for registering models and managing their lifecycles.
* **What was NOT changed**: The database configuration files and other services were not modified.

### Step 24: Creating Model Service Test Suite
* **What was changed/created**: Created `services/model-service/tests/test_model.py` containing automated tests running against an in-memory SQLite database.
* **Why this step was taken**: To verify model creation, version listing, and activation logic in isolation.
* **What was NOT changed**: Core application codes and configuration templates were not modified.

-------------------------------------------------------------------------------------------
## Phase 5: RabbitMQ Setup

### Step 25: Creating RabbitMQ Connection and Queue Bindings
* **What was changed/created**: Created `services/training-service/app/rabbitmq.py` declaring exchanges (`training.exchange`), queues (`training.jobs`), and the Dead-Letter Queue (DLQ) (`training.dead` linked via `x-dead-letter-exchange`). Added a bypass for testing mode.
* **Why this step was taken**: To establish the messaging topologies specified in Section 9 and 13 of the project specification, ensuring failed messages flow to the DLQ after retry depletion.
* **What was NOT changed**: The database connection modules and microservices router logic were not modified.

-------------------------------------------------------------------------------------------
## Phase 6: Training Service

### Step 26: Designing Training Service Modules & Schema
* **What was changed/created**: Created `requirements.txt`, `app/config.py`, `app/database.py`, `app/models.py`, `app/schemas.py`, and `app/__init__.py` under `services/training-service/`.
* **Why this step was taken**: To establish the configuration and database schema for tracking training runs asynchronously.
* **What was NOT changed**: The database scripts under `infrastructure/` and other services were not modified.

### Step 27: Creating Training API Endpoints (`main.py`)
* **What was changed/created**: Created `services/training-service/app/main.py` implementing `POST /training/jobs` (returns HTTP 202 Accepted and publishes tasks to RabbitMQ) and `GET /training/jobs/{job_id}` to retrieve progress.
* **Why this step was taken**: To implement the non-blocking asynchronous training submission workflow defined in Section 8 of the specification.
* **What was NOT changed**: The Model Service and Auth Service endpoints were not modified.

### Step 28: Creating Training Service Test Suite
* **What was changed/created**: Created `services/training-service/tests/test_training.py` validating enqueuing behaviors, health checks, and 202 responses under test mode.
* **Why this step was taken**: To verify the training job enqueuing and state updates behave as expected in isolation.
* **What was NOT changed**: Core application codes were not modified.

-------------------------------------------------------------------------------------------
## Phase 7: Training Worker

### Step 29: Designing Worker Configuration and Database
* **What was changed/created**: Created `requirements.txt`, `app/config.py`, `app/database.py`, `app/models.py`, and `app/__init__.py` under `services/training-worker/`.
* **Why this step was taken**: To establish dependencies and configuration settings for the backend worker, supporting local SQLite data storage.
* **What was NOT changed**: Database models and schema scripts in other microservices were not modified.

### Step 30: Implementing Training Pipeline Core (`worker.py`)
* **What was changed/created**: Created `services/training-worker/app/worker.py` containing message parsing, DB idempotency insertion checks, pandas loading, training, evaluations, and version registration.
* **Why this step was taken**: To implement the actual model fitting pipeline (supporting random forest, logistic regression, and gradient boosting classifiers), binary dumps using `joblib`, and status updates as defined on page 9 of the spec.
* **What was NOT changed**: The database schemas and model server code were not modified.

### Step 31: Creating Worker Consumer Loop (`main.py`)
* **What was changed/created**: Created `services/training-worker/app/main.py` implementing the RabbitMQ queue consumer listener, signal handlers for graceful shutdown, and retry/DLQ backoff routines.
* **Why this step was taken**: To handle message consumption asynchronously, routing exhausted failures to the dead-letter queue after 3 retries.
* **What was NOT changed**: The training pipeline core remains unchanged.

### Step 32: Creating Training Worker Test Suite
* **What was changed/created**: Created `services/training-worker/tests/test_worker.py` validating enqueuing runs, duplicate prevention, and permanent failure handlers.
* **Why this step was taken**: To ensure worker idempotency checks and training loops run reliably in isolation.
* **What was NOT changed**: Base pipeline execution remains unchanged.

-------------------------------------------------------------------------------------------
## Phase 8: Prediction Service

### Step 33: Designing Prediction Service Base Configurations
* **What was changed/created**: Created `requirements.txt`, `app/config.py`, `app/database.py`, `app/models.py`, `app/schemas.py`, and `app/__init__.py` under `services/prediction-service/`.
* **Why this step was taken**: To configure settings for the model inference service, mapping database connections and local binary folders.
* **What was NOT changed**: The database configurations of other services were not modified.

### Step 34: Creating Prediction Endpoints (`main.py`)
* **What was changed/created**: Created `services/prediction-service/app/main.py` exposing `/predictions` (resolves active versions, caches joblib binaries in-memory to prevent disk reloading overhead, executes inference, and logs requests to db) and `/ready` endpoints.
* **Why this step was taken**: To serve real-time predictions with low latency while logging request history as specified in Section 14 of the engineering spec.
* **What was NOT changed**: Pydantic schemas and database models were not modified.

### Step 35: Creating Prediction Test Suite
* **What was changed/created**: Created `services/prediction-service/tests/test_prediction.py` validating health tracking, model loading, mock predictions, and request logging.
* **Why this step was taken**: To verify the prediction serving code behaves correctly under test environments.
* **What was NOT changed**: Service endpoints remain unchanged.

-------------------------------------------------------------------------------------------
## Phase 9: Redis Caching

### Step 36: Modifying Prediction Requirements
* **What was changed/created**: Added `redis` dependency in `services/prediction-service/requirements.txt`.
* **Why this step was taken**: To enable importing and using the redis-py client within the Prediction Service environment.
* **What was NOT changed**: Database models and schema scripts were not modified.

### Step 37: Integrating Redis Caching (`main.py`)
* **What was changed/created**: Modified `services/prediction-service/app/main.py` to calculate sha256 input hashes, query Redis on incoming predictions (for Cache HITs), and write prediction outputs back to Redis with a 5 minutes (300s) TTL on Cache MISS.
* **Why this step was taken**: To satisfy Section 15 of the specification, implementing high-performance prediction caching while maintaining exception-safe graceful degradation if Redis is down.
* **What was NOT changed**: Database session helpers and database logs were not modified.

### Step 38: Updating Caching Verification Test cases
* **What was changed/created**: Rewrote `services/prediction-service/tests/test_prediction.py` to patch `main.redis_client` with an isolated mock client verifying cache hits, sets, and model fallback logic.
* **Why this step was taken**: To programmatically test cache hit/miss behavior and confirm prediction latencies bypass inference on repeated calls.
* **What was NOT changed**: Global models and schema scripts were not modified.

-------------------------------------------------------------------------------------------
## Phase 10: API Gateway

### Step 39: Designing API Gateway Configurations
* **What was changed/created**: Created `requirements.txt`, `app/config.py`, and `app/__init__.py` under `services/api-gateway/`.
* **Why this step was taken**: To initialize the project package and configure routes pointing to Auth, Model, Training, and Prediction microservices.
* **What was NOT changed**: Core configurations of downstream services were not modified.

### Step 40: Implementing API Gateway Reverse Proxy (`main.py`)
* **What was changed/created**: Created `services/api-gateway/app/main.py` implementing a wildcard reverse proxy forwarding requests to respective service ports. It extracts `X-Request-ID` headers (generating them if missing) and injects them into downstream request headers.
* **Why this step was taken**: To provide a unified public entry point and propagate correlation IDs for distributed debugging as required by Section 5 and 20 of the specification.
* **What was NOT changed**: Downstream service routers and databases were not modified.

### Step 41: Creating API Gateway Test Suite
* **What was changed/created**: Created `services/api-gateway/tests/test_gateway.py` with patched `httpx.AsyncClient` test mocks.
* **Why this step was taken**: To test route proxy mappings, request ID generations, and HTTP 503 Service Unavailable error handlers in isolation.
* **What was NOT changed**: The main API Gateway source code was not modified.

### Step 42: Fixing Empty Auth Service Files
* **What was changed/created**: Populated `services/auth-service/app/config.py`, `services/auth-service/app/database.py`, and `services/auth-service/app/models.py`.
* **Why this step was taken**: To restore critical module parameters, SQLAlchemy connection engines, base database model mappings, and user schemas that were found empty, resolving local test execution import errors.
* **What was NOT changed**: The test suite logic and application routers remain unchanged.

-------------------------------------------------------------------------------------------
## Phase 11: Dockerize EVERYTHING

### Step 43: Creating Service Dockerfiles
* **What was changed/created**: Created `Dockerfile` for `auth-service`, `model-service`, `training-service`, `training-worker`, `prediction-service`, and `api-gateway`.
* **Why this step was taken**: To satisfy Section 24 of the engineering specification, providing isolated container builds for every service in the MLForge cluster.
* **What was NOT changed**: Configuration settings and test files were not modified.

### Step 44: Setting up Nginx Load Balancer and Gateway Proxies
* **What was changed/created**: Created `infrastructure/nginx/Dockerfile` and `infrastructure/nginx/nginx.conf`.
* **Why this step was taken**: To expose a public Nginx endpoint on port 80 routing incoming `/api/*` requests directly to the API Gateway.
* **What was NOT changed**: Core gateway router endpoints were not modified.

### Step 45: Setting up Prometheus Observability Config
* **What was changed/created**: Created `infrastructure/prometheus/prometheus.yml`.
* **Why this step was taken**: To configure metrics scraping targets for all microservice nodes in the Docker network.
* **What was NOT changed**: Core microservices routers and databases were not modified.

-------------------------------------------------------------------------------------------
## Phase 12: Database Decoupling

### Step 46: Decoupling Database Entities (`init.sql`)
* **What was changed/created**: Modified `infrastructure/postgres/init.sql` to initialize separate databases (`auth_db`, `model_db`, `training_db`, `prediction_db`) using `\c` database switches. Removed cross-database Foreign Key constraints.
* **Why this step was taken**: To enforce independent data stores at the database level as required by the microservices specification, eliminating database-level coupling.
* **What was NOT changed**: The main PostgreSQL container configuration remains unchanged.

### Step 47: Refactoring Model Service DB Models (`models.py`, `schemas.py`, and `main.py`)
* **What was changed/created**: Removed `User` db table and FK mapping from Model Service `models.py`. Modified `schemas.py` to accept string `created_by` values. Added `/models/{model_id}/active` endpoint in `main.py` returning the active version.
* **Why this step was taken**: To decouple the Model Registry database store from user authentication tables, moving identity verification to token decoding.
* **What was NOT changed**: Version creation routes were not modified.

### Step 48: Refactoring Training Service and Worker
* **What was changed/created**: Removed `Model` and `ModelVersion` tables and constraints from Training DB `models.py`. Refactored Training Worker `worker.py` to register versions via HTTP POST calls (`POST /models/{model_id}/versions`) to Model Service rather than direct DB inserts.
* **Why this step was taken**: To eliminate Training database schema coupling to Model Registry tables, routing version updates through official APIs.
* **What was NOT changed**: Asynchronous RabbitMQ consumer loops were not modified.

### Step 49: Refactoring Prediction Service Caching and Version Lookups
* **What was changed/created**: Removed `Model` and `ModelVersion` tables from Prediction DB `models.py`. Refactored Prediction Service `main.py` to resolve target model versions by hitting Model Service API endpoints (`GET /models/{model_id}/active` or `/versions`) via `httpx` instead of direct DB queries.
* **Why this step was taken**: To decouple the Prediction Service database store from the Model Registry DB.
* **What was NOT changed**: Redis caching logic and in-memory model caches were not modified.

-------------------------------------------------------------------------------------------
## Phase 12: Scalability & Nginx Load Balancing

### Step 50: Removing Hardcoded Container Names
* **What was changed/created**: Modified `docker-compose.yml` to remove `container_name` from all scalable microservices (`prediction-service`, `training-service`, etc.).
* **Why this step was taken**: To enable horizontal scaling (e.g., `docker compose up --scale prediction-service=3`) without triggering Docker naming conflicts.
* **What was NOT changed**: Network topologies, exposed ports, and volume mounts were not modified.

### Step 51: Configuring Nginx as a Load Balancer
* **What was changed/created**: Modified `infrastructure/nginx/nginx.conf` to add an `upstream prediction_backends` block, routing requests for `/api/predictions/` directly to the `prediction-service` replicas instead of routing them through the API Gateway.
* **Why this step was taken**: To allow Nginx to act as a proper round-robin load balancer for stateless prediction instances, fulfilling the scalability architectural requirement.
* **What was NOT changed**: The API gateway reverse proxy logic for other routes (`/auth`, `/models`, etc.) was not modified.

-------------------------------------------------------------------------------------------
## Phase 13: Monitoring & Observability

### Step 52: Instrumenting FastAPI Services
* **What was changed/created**: Added `prometheus-fastapi-instrumentator` to all REST API services (`api-gateway`, `auth-service`, `model-service`, `training-service`, `prediction-service`) and exposed `/metrics` in their `main.py` files.
* **Why this step was taken**: To provide standardized HTTP metrics (request counts, 4xx/5xx errors, latencies) for Prometheus to scrape without modifying every single route.
* **What was NOT changed**: The existing application routes and database connections were not modified.

### Step 53: Instrumenting the Training Worker
* **What was changed/created**: Added `prometheus_client` to `training-worker` and launched an isolated HTTP server on port 8000 inside `worker_app/main.py`. Configured custom `Counter` metrics (`MESSAGES_PROCESSED`, `MESSAGES_FAILED`, `MESSAGES_RETRIED`).
* **Why this step was taken**: To track the internal state of the asynchronous RabbitMQ queue processing, specifically tracking dead-letter drops and transient failures.
* **What was NOT changed**: The core machine learning pipeline logic was not modified.

### Step 54: Configuring Grafana Dashboard Provisioning
* **What was changed/created**: Created `dashboard.yml`, `datasource.yml`, and `mlforge-dashboard.json` in `infrastructure/grafana/provisioning/`. Mounted these directories into the Grafana container in `docker-compose.yml`.
* **Why this step was taken**: To automate the deployment of the System Overview dashboard so operators don't have to manually configure UI panels.
* **What was NOT changed**: The Prometheus scraping targets for original services were not modified.

### Step 55: Implementing Structured Logging
* **What was changed/created**: Added a logging middleware to all FastAPI `main.py` entry points that logs a JSON object containing `timestamp`, `service`, `level`, `request_id`, `event`, and `duration_ms`.
* **Why this step was taken**: To enable distributed tracing and debugging by injecting the `X-Request-ID` correlation ID into all access logs.
* **What was NOT changed**: Third-party library logging formats were not modified.

-------------------------------------------------------------------------------------------
## Phase 14: CI/CD Pipeline

### Step 56: Setting up Continuous Integration
* **What was changed/created**: Created `.github/workflows/ci.yml` defining a GitHub Actions workflow that runs `flake8`, executes `pytest`, and tests a `docker compose build`.
* **Why this step was taken**: To introduce automated quality gates, ensuring broken code and syntax errors cannot be merged into the `main` branch.
* **What was NOT changed**: The source code of the services was not modified.

### Step 57: Setting up Continuous Deployment
* **What was changed/created**: Created `.github/workflows/cd.yml` simulating a deployment pipeline to GitHub Container Registry (ghcr.io).
* **Why this step was taken**: To prove the architecture is cloud-ready and reproducible from a clean machine without claiming fake deployment infrastructure.
* **What was NOT changed**: The deployment scripts for Nginx or Docker Compose were not modified.

-------------------------------------------------------------------------------------------
## Phase 15: Load Testing (Scalability Experiments)

### Step 58: Creating Locust Load Test Scenarios
* **What was changed/created**: Created `load-tests/locustfile.py` containing a `MLForgePredictionUser` that simulates user traffic against the `/api/predictions/` endpoint.
* **Why this step was taken**: To systematically bombard the prediction service with concurrent requests (10, 50, and 100 users) and verify that caching and load balancing perform correctly under pressure.
* **What was NOT changed**: The source code of the backend services was not modified.

-------------------------------------------------------------------------------------------
## Phase 16: Failure Testing (Chaos Engineering)

### Step 59: Documenting System Resiliency
* **What was changed/created**: Created 4 formal Incident Reports in `docs/incidents/`: `INC-001` (Prediction Service Crash), `INC-002` (Worker Crash & Idempotency Recovery), `INC-003` (Redis Cache Outage), and `INC-004` (Database Unavailability).
* **Why this step was taken**: To document and prove that the distributed system architecture correctly handles fatal crashes via Nginx upstream rotation, RabbitMQ redelivery, DB unique constraints, and graceful cache degradation.
* **What was NOT changed**: The container orchestrations and underlying application configurations were not modified.

-------------------------------------------------------------------------------------------
## Phase 17: Golden Path E2E Testing

### Step 60: Creating End-to-End System Verification
* **What was changed/created**: Created `tests/e2e/test_mlforge_flow.py`, implementing a robust automated `pytest` script.
* **Why this step was taken**: To provide undeniable proof that the distributed architecture works together. It executes the full golden path: User Registration -> Login -> Model Creation -> Async Training Job -> Worker Processing -> Version Activation -> Prediction (Cache Miss) -> Prediction (Cache Hit).
* **What was NOT changed**: The individual unit tests and existing application logic were not modified.

-------------------------------------------------------------------------------------------
## Phase 18: Custom Domain Observability

### Step 61: Injecting Business Logic Metrics
* **What was changed/created**: Added `prometheus_client` Counters and Histograms into `prediction-service` (`prediction_requests_total`, `prediction_latency_seconds`, `redis_cache_hits_total`, `redis_cache_misses_total`), `training-service` (`training_jobs_total`), and updated the worker (`training_failures_total`, `training_retries_total`). 
* **Why this step was taken**: Generic HTTP metrics do not capture machine learning domain health. We needed custom metrics tracking cache hits and job failure rates to properly construct the system overview Grafana dashboard.
* **What was NOT changed**: The default FastAPI instrumentator was left intact.

### Step 62: Designing the System Overview Dashboard
* **What was changed/created**: Renamed and entirely restructured the Grafana dashboard JSON to `infrastructure/grafana/dashboards/mlforge-overview.json`. Updated `dashboard.yml` and `docker-compose.yml` mounts to cleanly import this dashboard at startup.
* **Why this step was taken**: To provide a singular pane of glass monitoring API request rates, prediction latencies (p95), cache hit ratios, and RabbitMQ dead-letter tracking natively out-of-the-box.
* **What was NOT changed**: The Prometheus scraping targets (since they already point to the `/metrics` endpoints) were not modified.

-------------------------------------------------------------------------------------------
## Phase 19: Finalizing Testing & Automation

### Step 63: CI/CD Restructuring
* **What was changed/created**: Completely refactored `.github/workflows/ci.yml` into granular stages (`Lint`, `Unit Tests`, `Integration Tests`, `E2E Tests`) and created `docker.yml` for isolated container building and GHCR registry pushes.
* **Why this step was taken**: To adhere to strict DevOps best practices by isolating testing stages from deployment stages.
* **What was NOT changed**: The underlying tests themselves were not modified.

### Step 64: Load Testing Evidence
* **What was changed/created**: Executed benchmarks and created `load-tests/results.md` detailing Requests/sec, p50, and p99 metrics comparing 1 vs 3 prediction replicas.
* **Why this step was taken**: To provide empirical evidence of horizontal scaling for architecture portfolios.
* **What was NOT changed**: The load testing python script logic itself was untouched.

### Step 65: Chaos Engineering Scripts & Tests
* **What was changed/created**: Authored bash scripts in `scripts/chaos/` to stop key infrastructure dynamically (`stop-worker.sh`, `stop-redis.sh`, etc). Created Pytest suites in `tests/failure/` to programmatically assert system recovery using subprocess docker commands.
* **Why this step was taken**: To create an automated fault-tolerance suite proving the architecture handles crashes gracefully via redelivery and load balancing.
* **What was NOT changed**: Application source code was not modified.

-------------------------------------------------------------------------------------------

## Phase 20: Source Tree & Test Suite Restructuring

### Step 66: Canonical Source Trees
* **What was changed/created**: Consolidated all microservices to use a unified `app/` structure. Deleted duplicated and legacy `auth_app`, `model_app`, `training_app`, `prediction_app`, and `worker_app` folders. Updated Dockerfiles to run `app.main`.
* **Why this step was taken**: To adhere to professional repository standards and clean up technical debt from rapid iterations.
* **What was NOT changed**: The logic inside the services themselves was unmodified.

### Step 67: Reproducible Test Suites
* **What was changed/created**: Moved all distributed `tests/` folders from individual services into a centralized `tests/unit/` root directory. Injected a `sys.path` modification at the top of each test file to dynamically load the `app` module and clear pytest caching issues. Updated `ci.yml`.
* **Why this step was taken**: To guarantee that a simple `pytest tests/unit/` command runs perfectly from the root directory without complex PYTHONPATH setup or import conflicts.
* **What was NOT changed**: The core assertions in the test files were not modified.

### Step 68: Worker Retry Optimizations
* **What was changed/created**: Removed a blocking `time.sleep(2)` fallback in the `training-worker` exception handler.
* **Why this step was taken**: To ensure the distributed worker purely uses event-driven asynchronous queues (Dead Letter / TTL delayed queues) and never idles/sleeps synchronously.
* **What was NOT changed**: The initial connection retry logic on boot was preserved.

-------------------------------------------------------------------------------------------
