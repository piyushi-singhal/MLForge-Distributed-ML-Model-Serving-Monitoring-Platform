export interface TrainingJob {
  id: string;
  model_id: string;
  status: 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED' | string;
  algorithm: string;
  retry_count: number;
  error_message?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface TrainingJobCreate {
  model_id: string;
  dataset_path: string;
  algorithm: string;
}
