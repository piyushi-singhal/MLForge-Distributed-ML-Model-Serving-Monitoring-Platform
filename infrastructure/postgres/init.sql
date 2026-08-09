-- Create Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create Models Table
CREATE TABLE IF NOT EXISTS models (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create Model Versions Table
CREATE TABLE IF NOT EXISTS model_versions (
    id SERIAL PRIMARY KEY,
    model_id VARCHAR(255) NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    algorithm VARCHAR(100) NOT NULL,
    artifact_path VARCHAR(512) NOT NULL,
    metrics_json JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) NOT NULL CHECK (status IN ('TRAINING', 'READY', 'ACTIVE', 'FAILED', 'ARCHIVED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE (model_id, version)
);

-- Create Training Jobs Table
CREATE TABLE IF NOT EXISTS training_jobs (
    id UUID PRIMARY KEY,
    model_id VARCHAR(255) NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    algorithm VARCHAR(100) NOT NULL,
    retry_count INT DEFAULT 0 NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create Prediction Requests Table
CREATE TABLE IF NOT EXISTS prediction_requests (
    id UUID PRIMARY KEY,
    model_id VARCHAR(255) NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    model_version VARCHAR(50) NOT NULL,
    input_hash VARCHAR(64) NOT NULL,
    prediction JSONB NOT NULL,
    confidence DOUBLE PRECISION,
    latency_ms INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create Processed Events Table (for Idempotency)
CREATE TABLE IF NOT EXISTS processed_events (
    event_id UUID PRIMARY KEY,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status VARCHAR(50) NOT NULL
);

-- --- INDEXES (AS SPECIFIED IN SECTION 17) ---
CREATE INDEX IF NOT EXISTS idx_training_jobs_status ON training_jobs(status);
CREATE INDEX IF NOT EXISTS idx_training_jobs_created_at ON training_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_prediction_requests_model_id ON prediction_requests(model_id);
CREATE INDEX IF NOT EXISTS idx_prediction_requests_created_at ON prediction_requests(created_at);
