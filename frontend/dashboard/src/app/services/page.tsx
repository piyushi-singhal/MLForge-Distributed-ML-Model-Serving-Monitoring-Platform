'use client';

import { useEffect, useState } from 'react';
import {
  Server,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Database,
  Link,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { servicesApi } from '@/lib/api/services';
import { ServiceStatus } from '@/types/service';
import { clsx } from 'clsx';

interface ServiceDetail {
  name: string;
  checkHealth: () => Promise<any>;
  checkReady: () => Promise<any>;
  endpoint: string;
  dependencies: string[];
  description: string;
}

const SERVICES_DEFS: ServiceDetail[] = [
  {
    name: 'API Gateway',
    checkHealth: servicesApi.checkGatewayHealth,
    checkReady: servicesApi.checkGatewayReady,
    endpoint: '/health',
    dependencies: ['Auth Service', 'Model Service', 'Training Service', 'Prediction Service'],
    description: 'Entrypoint proxy routing HTTP requests and handling CORS headers.',
  },
  {
    name: 'Auth Service',
    checkHealth: servicesApi.checkAuthHealth,
    checkReady: servicesApi.checkAuthReady,
    endpoint: '/api/auth/health',
    dependencies: ['PostgreSQL (auth_db)'],
    description: 'Handles JWT authorization tokens and user authentication DB queries.',
  },
  {
    name: 'Model Service',
    checkHealth: servicesApi.checkModelsHealth,
    checkReady: servicesApi.checkModelsReady,
    endpoint: '/api/models/health',
    dependencies: ['PostgreSQL (model_db)'],
    description: 'Central registry cataloging model versions and active model configurations.',
  },
  {
    name: 'Training Service',
    checkHealth: servicesApi.checkTrainingHealth,
    checkReady: servicesApi.checkTrainingReady,
    endpoint: '/api/training/health',
    dependencies: ['PostgreSQL (training_db)', 'RabbitMQ'],
    description: 'Enqueues asynchronous model training runs to RabbitMQ queues.',
  },
  {
    name: 'Prediction Service',
    checkHealth: servicesApi.checkPredictionsHealth,
    checkReady: servicesApi.checkPredictionsReady,
    endpoint: '/api/predictions/health',
    dependencies: ['PostgreSQL (prediction_db)', 'Redis Cache', 'Model Service'],
    description: 'Executes high-performance low-latency model inference, falling back to Redis cache hits.',
  },
];

interface ServiceRuntimeState extends ServiceDetail {
  healthStatus: ServiceStatus;
  readyStatus: ServiceStatus;
  responseTimeMs: number | null;
  lastChecked: string;
}

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceRuntimeState[]>(
    SERVICES_DEFS.map(s => ({
      ...s,
      healthStatus: 'loading',
      readyStatus: 'loading',
      responseTimeMs: null,
      lastChecked: '—',
    }))
  );
  const [loading, setLoading] = useState(true);
  const [expandedService, setExpandedService] = useState<string | null>(null);

  async function pollServices() {
    setLoading(true);
    const updated = await Promise.all(
      services.map(async (svc) => {
        const start = performance.now();
        let healthStatus: ServiceStatus = 'down';
        let readyStatus: ServiceStatus = 'down';
        let responseTimeMs = null;

        try {
          // Check health
          const hRes = await svc.checkHealth();
          if (hRes && hRes.status === 'healthy') {
            healthStatus = 'healthy';
          }
          
          // Check readiness (verifies DB)
          const rRes = await svc.checkReady();
          if (rRes && rRes.status === 'ready') {
            readyStatus = 'healthy';
          }

          responseTimeMs = Math.round(performance.now() - start);
        } catch {
          healthStatus = 'down';
          readyStatus = 'down';
        }

        return {
          ...svc,
          healthStatus,
          readyStatus,
          responseTimeMs,
          lastChecked: new Date().toLocaleTimeString(),
        };
      })
    );
    setServices(updated);
    setLoading(false);
  }

  useEffect(() => {
    pollServices();
    const interval = setInterval(pollServices, 10_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <Server className="h-6 w-6 text-indigo-400" />
            Services Grid
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Audit runtime health, database readiness checks, and response latencies of core microservices.
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={pollServices}
            className="flex items-center justify-center p-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Services List */}
      <div className="space-y-4">
        {services.map((svc) => {
          const isExpanded = expandedService === svc.name;
          const statusOk = svc.healthStatus === 'healthy' && svc.readyStatus === 'healthy';

          return (
            <div
              key={svc.name}
              className={clsx(
                "rounded-xl border transition-all overflow-hidden bg-zinc-900",
                statusOk ? "border-zinc-800/80" : "border-red-500/20"
              )}
            >
              {/* Accordion Trigger */}
              <div
                onClick={() => setExpandedService(isExpanded ? null : svc.name)}
                className="px-6 py-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer hover:bg-zinc-800/30 transition-colors select-none"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-zinc-500 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-zinc-500 flex-shrink-0" />
                  )}
                  <div>
                    <h2 className="text-sm font-bold text-zinc-200">{svc.name}</h2>
                    <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">{svc.endpoint}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500 text-[10px] font-medium uppercase">Health Status:</span>
                    <span className={clsx(
                      "px-2 py-0.5 rounded text-[10px]",
                      svc.healthStatus === 'healthy' ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"
                    )}>
                      {svc.healthStatus.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500 text-[10px] font-medium uppercase">Ready Status (DB):</span>
                    <span className={clsx(
                      "px-2 py-0.5 rounded text-[10px]",
                      svc.readyStatus === 'healthy' ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"
                    )}>
                      {svc.readyStatus.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-zinc-500 text-[10px] font-medium uppercase">Latency:</span>
                    <span className="text-zinc-300">{svc.responseTimeMs !== null ? `${svc.responseTimeMs}ms` : '—'}</span>
                  </div>
                </div>
              </div>

              {/* Accordion Content */}
              {isExpanded && (
                <div className="px-6 pb-6 pt-2 border-t border-zinc-800 text-xs text-zinc-400 space-y-4 bg-zinc-950/20">
                  <div>
                    <span className="font-bold text-zinc-300 block mb-1">Service Description</span>
                    <p className="leading-relaxed">{svc.description}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="font-bold text-zinc-300 block mb-1.5">Downstream Dependencies</span>
                      <div className="flex flex-wrap gap-1.5">
                        {svc.dependencies.map(dep => (
                          <span key={dep} className="px-2 py-1 bg-zinc-800 rounded border border-zinc-800 text-[10px] font-mono text-zinc-300">
                            {dep}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="font-bold text-zinc-300 block mb-1.5">Runtime Logs & Check Metrics</span>
                      <div className="space-y-1 text-[10px] text-zinc-500 font-mono">
                        <div>Checked at: {svc.lastChecked}</div>
                        <div>Timeout setting: 2.0s</div>
                        <div>Protocol: HTTP/1.1</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
