export type ServiceStatus = 'healthy' | 'degraded' | 'down' | 'loading';

export interface ServiceHealth {
  name: string;
  url: string;
  status: ServiceStatus;
}
