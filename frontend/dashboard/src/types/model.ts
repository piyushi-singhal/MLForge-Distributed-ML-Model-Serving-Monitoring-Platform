export interface Model {
  id: string;
  name: string;
  description?: string;
  created_by?: string;
  created_at: string;
}

export interface ModelVersion {
  id: number;
  model_id: string;
  version: string;
  algorithm: string;
  artifact_path: string;
  metrics_json?: Record<string, any>;
  status: 'TRAINING' | 'READY' | 'ACTIVE' | 'ARCHIVED';
  created_at: string;
}
