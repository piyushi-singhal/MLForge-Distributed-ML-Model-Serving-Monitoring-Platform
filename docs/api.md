# API Examples

MLForge abstracts its underlying microservices behind a unified API Gateway. All external clients communicate exclusively via port `80` (or `443` in production) through Nginx -> API Gateway.

## 1. Authentication

### Register a User
```bash
curl -X POST http://localhost/auth/register \
     -H "Content-Type: application/json" \
     -d '{
           "email": "data.scientist@example.com",
           "password": "securepassword123"
         }'
```
**Response**: `201 Created`

### Login to obtain JWT
```bash
curl -X POST http://localhost/auth/login \
     -H "Content-Type: application/json" \
     -d '{
           "email": "data.scientist@example.com",
           "password": "securepassword123"
         }'
```
**Response**: `200 OK`
```json
{
  "access_token": "eyJhbGciOiJIUz...",
  "token_type": "bearer"
}
```

*Note: Extract the `access_token` and use it in the `Authorization: Bearer <token>` header for all subsequent authenticated requests.*

## 2. Model Management

### Create a Model Entry
```bash
curl -X POST http://localhost/models/ \
     -H "Authorization: Bearer <YOUR_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
           "name": "churn-predictor",
           "description": "Predicts customer churn probability"
         }'
```
**Response**: `201 Created`

## 3. Training

### Submit an Asynchronous Training Job
```bash
curl -X POST http://localhost/training/jobs \
     -H "Authorization: Bearer <YOUR_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
           "model_id": "churn-predictor",
           "dataset_path": "/shared/data/training.csv",
           "algorithm": "random_forest"
         }'
```
**Response**: `202 Accepted` (Note: The request completes instantly while training continues in the background).
```json
{
  "message": "Training job queued",
  "job_id": "8432a58b-9d43...",
  "status": "QUEUED"
}
```

### Check Job Status
```bash
curl -X GET http://localhost/training/jobs/8432a58b-9d43... \
     -H "Authorization: Bearer <YOUR_TOKEN>"
```

## 4. Model Activation

Once a model is trained, it registers a `version` (e.g., `v1`). We must activate it before predictions can be made.

### Activate Model Version
```bash
curl -X POST http://localhost/models/churn-predictor/versions/v1/activate \
     -H "Authorization: Bearer <YOUR_TOKEN>"
```
**Response**: `200 OK`

## 5. Prediction (Inference)

### Request a Prediction
```bash
curl -X POST http://localhost/predictions/ \
     -H "Authorization: Bearer <YOUR_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
           "model_id": "churn-predictor",
           "features": [0.5, 1.2, 3.4, 0.1, 9.2]
         }'
```
**Response**: `200 OK`
```json
{
  "prediction": [1],
  "latency_ms": 14.5
}
```

*Note: Submitting this exact same payload a second time will result in a sub-millisecond response due to Redis caching.*
