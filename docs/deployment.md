# Deployment

MLForge is fully containerized using Docker, allowing it to be easily deployed to any environment that supports Docker Engine.

## Local Deployment (Docker Compose)

The entire infrastructure—including all microservices, databases, caches, message brokers, load balancers, and observability tools—can be launched with a single command.

### Prerequisites
- Docker Engine
- Docker Compose

### Steps
1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/mlforge.git
   cd mlforge
   ```

2. **Start the environment**:
   ```bash
   docker compose up --build -d
   ```

3. **Verify Health**:
   Wait approximately 15-30 seconds for the databases to initialize, then check the gateway health:
   ```bash
   curl http://localhost/health
   ```

## Production Deployment Principles

While `docker-compose` is excellent for local testing, deploying MLForge to a production environment (like AWS, GCP, or Azure) requires orchestrators like **Kubernetes (K8s)** or Managed Container Services (e.g., AWS ECS).

Key adaptations for production:
1. **Managed Databases**: Replace the PostgreSQL, Redis, and RabbitMQ containers with managed cloud equivalents (AWS RDS, AWS ElastiCache, Amazon MQ) for automated backups and multi-AZ high availability.
2. **Horizontal Pod Autoscaling (HPA)**: Configure K8s to automatically scale the Prediction Service deployments based on CPU utilization or HTTP request rates.
3. **Secret Management**: Move hardcoded environment variables (e.g., `POSTGRES_PASSWORD`, `SECRET_KEY`) into secure vaults like AWS Secrets Manager or HashiCorp Vault.
4. **CI/CD Integration**: Our GitHub Actions pipeline automatically builds and pushes tagged Docker images to the GitHub Container Registry (GHCR) on every merge to `main`. Deployment pipelines simply pull the latest `main` tag and perform rolling K8s updates.
