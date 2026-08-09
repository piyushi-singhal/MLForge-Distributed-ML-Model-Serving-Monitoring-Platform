import sqlite3
import uuid

def run_tests():
    print("=== PHASE 2 VERIFICATION: RUNNING SQLite DATABASE TESTS ===")
    
    # 1. Connect to SQLite database in-memory
    conn = sqlite3.connect(":memory:")
    cursor = conn.cursor()
    
    # 2. Enable foreign keys in SQLite
    conn.execute("PRAGMA foreign_keys = ON;")
    
    # 3. Create tables matching the init.sql schema
    cursor.execute("""
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
    """)
    
    cursor.execute("""
    CREATE TABLE models (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
    """)
    
    cursor.execute("""
    CREATE TABLE model_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
        version TEXT NOT NULL,
        algorithm TEXT NOT NULL,
        artifact_path TEXT NOT NULL,
        metrics_json TEXT DEFAULT '{}',
        status TEXT NOT NULL CHECK (status IN ('TRAINING', 'READY', 'ACTIVE', 'FAILED', 'ARCHIVED')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE (model_id, version)
    );
    """)
    
    cursor.execute("""
    CREATE TABLE training_jobs (
        id TEXT PRIMARY KEY,
        model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        algorithm TEXT NOT NULL,
        retry_count INTEGER DEFAULT 0 NOT NULL,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        started_at TIMESTAMP,
        completed_at TIMESTAMP
    );
    """)
    
    cursor.execute("""
    CREATE TABLE prediction_requests (
        id TEXT PRIMARY KEY,
        model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
        model_version TEXT NOT NULL,
        input_hash TEXT NOT NULL,
        prediction TEXT NOT NULL,
        confidence REAL,
        latency_ms INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
    """)
    
    cursor.execute("""
    CREATE TABLE processed_events (
        event_id TEXT PRIMARY KEY,
        processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        status TEXT NOT NULL
    );
    """)
    
    # Create indexes
    cursor.execute("CREATE INDEX idx_training_jobs_status ON training_jobs(status);")
    cursor.execute("CREATE INDEX idx_training_jobs_created_at ON training_jobs(created_at);")
    cursor.execute("CREATE INDEX idx_prediction_requests_model_id ON prediction_requests(model_id);")
    cursor.execute("CREATE INDEX idx_prediction_requests_created_at ON prediction_requests(created_at);")
    
    print("✅ Schema created, indexes initialized successfully.")
    
    # --- TEST CASE 1: User Insertion ---
    cursor.execute("INSERT INTO users (email, password_hash) VALUES ('test@example.com', 'hash_123');")
    user_id = cursor.lastrowid
    print(f"✅ TEST PASSED: User insertion (user_id={user_id})")
    
    # --- TEST CASE 2: Duplicate User Email (Expected Unique Constraint Failure) ---
    try:
        cursor.execute("INSERT INTO users (email, password_hash) VALUES ('test@example.com', 'hash_456');")
        print("❌ TEST FAILED: Duplicate user email succeeded!")
        exit(1)
    except sqlite3.IntegrityError as e:
        print(f"✅ TEST PASSED: Duplicate user email failed as expected ({e})")
        
    # --- TEST CASE 3: Model Insertion ---
    cursor.execute("INSERT INTO models (id, name, description, created_by) VALUES (?, ?, ?, ?)", 
                   ('equipment-failure', 'Equipment Failure Model', 'Test model', user_id))
    print("✅ TEST PASSED: Model registration")
    
    # --- TEST CASE 4: Model Version Insertion ---
    cursor.execute("INSERT INTO model_versions (model_id, version, algorithm, artifact_path, status) VALUES (?, ?, ?, ?, ?)",
                   ('equipment-failure', 'v1', 'random_forest', '/data/models/v1.joblib', 'READY'))
    print("✅ TEST PASSED: Model version registration")
    
    # --- TEST CASE 5: Duplicate Version Insertion (Expected model_id + version UNIQUE Failure) ---
    try:
        cursor.execute("INSERT INTO model_versions (model_id, version, algorithm, artifact_path, status) VALUES (?, ?, ?, ?, ?)",
                       ('equipment-failure', 'v1', 'gradient_boosting', '/data/models/v2.joblib', 'READY'))
        print("❌ TEST FAILED: Duplicate model version succeeded!")
        exit(1)
    except sqlite3.IntegrityError as e:
        print(f"✅ TEST PASSED: Duplicate model version failed as expected ({e})")
        
    # --- TEST CASE 6: Invalid Status (Expected CHECK constraint Failure) ---
    try:
        cursor.execute("INSERT INTO model_versions (model_id, version, algorithm, artifact_path, status) VALUES (?, ?, ?, ?, ?)",
                       ('equipment-failure', 'v2', 'gradient_boosting', '/data/models/v2.joblib', 'INVALID_STATUS'))
        print("❌ TEST FAILED: Invalid status CHECK constraint succeeded!")
        exit(1)
    except sqlite3.IntegrityError as e:
        print(f"✅ TEST PASSED: Invalid model status CHECK constraint failed as expected ({e})")
        
    # --- TEST CASE 7: Idempotency Processed Events Unique check ---
    event_uuid = str(uuid.uuid4())
    cursor.execute("INSERT INTO processed_events (event_id, status) VALUES (?, ?)", (event_uuid, 'COMPLETED'))
    print("✅ TEST PASSED: Idempotency event log inserted")
    
    try:
        cursor.execute("INSERT INTO processed_events (event_id, status) VALUES (?, ?)", (event_uuid, 'COMPLETED'))
        print("❌ TEST FAILED: Duplicate event ID insertion succeeded!")
        exit(1)
    except sqlite3.IntegrityError as e:
        print(f"✅ TEST PASSED: Duplicate event ID insertion failed as expected ({e})")

    # --- TEST CASE 8: Foreign Key Constraint (Expected model_id FK Failure) ---
    try:
        cursor.execute("INSERT INTO model_versions (model_id, version, algorithm, artifact_path, status) VALUES (?, ?, ?, ?, ?)",
                       ('non-existent-model', 'v1', 'random_forest', '/data/models/v1.joblib', 'READY'))
        print("❌ TEST FAILED: Non-existent model version creation succeeded (Foreign Key violation ignored)!")
        exit(1)
    except sqlite3.IntegrityError as e:
        print(f"✅ TEST PASSED: Foreign key model_id constraint failed as expected ({e})")

    print("\n=== ALL SCHEMA AND CONSTRAINT TESTS PASSED (SQLite VERIFIED) ===")
    conn.close()

if __name__ == "__main__":
    run_tests()
