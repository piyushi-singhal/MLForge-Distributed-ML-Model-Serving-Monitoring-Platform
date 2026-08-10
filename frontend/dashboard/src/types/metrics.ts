export interface MetricValue {
  metric: Record<string, string>;
  value: [number, string];
}

export interface MetricResult {
  resultType: string;
  result: MetricValue[];
}

export interface PrometheusQueryResponse {
  status: 'success' | 'error';
  data?: MetricResult;
  errorType?: string;
  error?: string;
}
