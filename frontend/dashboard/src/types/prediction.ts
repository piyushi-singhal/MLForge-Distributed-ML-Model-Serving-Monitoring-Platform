export interface PredictionInput {
  model_id: string;
  model_version?: string;
  features: Record<string, any>;
}

export interface PredictionResponse {
  request_id: string;
  model_id: string;
  model_version: string;
  prediction: any;
  confidence?: number;
  latency_ms: number;
}

export interface PredictionLog {
  id: string;
  model_id: string;
  model_version: string;
  input_hash: string;
  prediction: any;
  confidence?: number;
  latency_ms: number;
  created_at: string;
}
