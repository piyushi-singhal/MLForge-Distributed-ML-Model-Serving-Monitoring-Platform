'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  BrainCircuit,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Server,
  Database,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  Radio,
} from 'lucide-react';
import { clsx } from 'clsx';
import { servicesApi } from '@/lib/api/services';
import { trainingApi } from '@/lib/api/training';
import { predictionsApi } from '@/lib/api/predictions';
import { modelsApi } from '@/lib/api/models';
import { ServiceStatus } from '@/types/service';
import { TrainingJob } from '@/types/training';
import { PredictionLog } from '@/types/prediction';
import { Model } from '@/types/model';

interface ServiceHealth {
  name: string;
  check: (hostname: string) => Promise<any>;
  status: ServiceStatus;
  endpoint: string;
  type: 'core' | 'infra' | 'ops';
}

const INITIAL_SERVICES: Omit<ServiceHealth, 'status'>[] = [
  { name: 'Nginx Proxy',        check: (h) => servicesApi.checkNginxHealth(h),     endpoint: 'http://localhost/health', type: 'core' },
  { name: 'API Gateway',        check: () => servicesApi.checkGatewayHealth(),     endpoint: '/health', type: 'core' },
  { name: 'Auth Service',       check: () => servicesApi.checkAuthHealth(),        endpoint: '/api/auth/health', type: 'core' },
  { name: 'Model Service',      check: () => servicesApi.checkModelsHealth(),      endpoint: '/api/models/health', type: 'core' },
  { name: 'Training Service',   check: () => servicesApi.checkTrainingHealth(),    endpoint: '/api/training/health', type: 'core' },
  { name: 'Prediction Service', check: () => servicesApi.checkPredictionsHealth(), endpoint: '/api/predictions/health', type: 'core' },
  { name: 'PostgreSQL',         check: () => servicesApi.checkPostgresHealth(),    endpoint: '/api/postgres/health', type: 'infra' },
  { name: 'Redis Cache',        check: () => servicesApi.checkRedisHealth(),       endpoint: '/api/redis/health', type: 'infra' },
  { name: 'RabbitMQ Broker',    check: () => servicesApi.checkRabbitmqHealth(),    endpoint: '/api/rabbitmq/health', type: 'infra' },
  { name: 'Training Worker',    check: () => servicesApi.checkWorkerHealth(),      endpoint: '/api/worker/health', type: 'infra' },
  { name: 'Prometheus',         check: () => servicesApi.checkPrometheusHealth(),  endpoint: '/api/prometheus/health', type: 'ops' },
  { name: 'Grafana',            check: () => servicesApi.checkGrafanaHealth(),     endpoint: '/api/grafana/health', type: 'ops' },
];

function StatusBadge({ status }: { status: ServiceStatus }) {
  const map = {
    healthy: { icon: CheckCircle2, text: 'Healthy',  cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    degraded:{ icon: Clock,        text: 'Degraded', cls: 'text-amber-400  bg-amber-500/10 border-amber-500/20'  },
    down:    { icon: XCircle,      text: 'Offline',  cls: 'text-red-400    bg-red-500/10 border-red-500/20'    },
    loading: { icon: Activity,     text: 'Checking', cls: 'text-zinc-400   bg-zinc-800 border-zinc-700/50'      },
  };
  const { icon: Icon, text, cls } = map[status] || map.loading;
  return (
    <span className={clsx('flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide', cls)}>
      <Icon className={clsx("h-3 w-3", status === 'loading' && "animate-pulse")} />
      {text}
    </span>
  );
}

export default function OverviewPage() {
  const [services, setServices] = useState<ServiceHealth[]>(
    INITIAL_SERVICES.map(s => ({ ...s, status: 'loading' }))
  );
  const [trainingJobs, setTrainingJobs] = useState<TrainingJob[]>([]);
  const [predictions, setPredictions] = useState<PredictionLog[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  const [autoRefresh] = useState(true);

  // Poll function
  async function pollSystemState() {
    const hostname = typeof window !== 'undefined' ? window.location.host : 'localhost';
    
    // Check Health of all services in parallel
    const healthPromises = services.map(async svc => {
      try {
        const body = await svc.check(hostname);
        const status: ServiceStatus =
          body && (body.status === 'healthy' || body.status === 'ready') ? 'healthy' : 'degraded';
        return { ...svc, status };
      } catch {
        return { ...svc, status: 'down' as const };
      }
    });

    const jobsPromise = trainingApi.listJobs().catch(() => [] as TrainingJob[]);
    const predsPromise = predictionsApi.listPredictions().catch(() => [] as PredictionLog[]);
    const modelsPromise = modelsApi.listModels().catch(() => [] as Model[]);

    const [updatedServices, jobs, preds, listModels] = await Promise.all([
      Promise.all(healthPromises),
      jobsPromise,
      predsPromise,
      modelsPromise,
    ]);

    setServices(updatedServices);
    setTrainingJobs(jobs);
    setPredictions(preds);
    setModels(listModels);
    setLoading(false);
    setSecondsSinceUpdate(0);
  }

  useEffect(() => {
    pollSystemState();
    
    const pollInterval = setInterval(pollSystemState, 10_000);
    const counterInterval = setInterval(() => {
      setSecondsSinceUpdate(prev => prev + 1);
    }, 1000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(counterInterval);
    };
  }, []);

  const healthyCount = services.filter(s => s.status === 'healthy').length;
  const criticalCount = services.filter(s => s.status === 'down').length;
  
  let overallStatus = 'Healthy';
  let overallColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  if (criticalCount > 0) {
    overallStatus = 'Degraded State';
    overallColor = 'text-red-400 bg-red-500/10 border-red-500/20';
  } else if (healthyCount < services.length) {
    overallStatus = 'Attention Required';
    overallColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  }

  // Real Stats
  const activeJobs = trainingJobs.filter(j => j.status === 'PROCESSING' || j.status === 'QUEUED').length;
  const recentFailures = trainingJobs.filter(j => j.status === 'FAILED').length;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      
      {/* Top Banner: Real-time update indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
            <Radio className="h-5 w-5 text-indigo-400 animate-pulse" />
            System Control Center
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Unified observability across the distributed MLForge model serving and training pipeline.
          </p>
        </div>
        
        <div className="flex items-center gap-3 self-start sm:self-center">
          <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-xs text-zinc-400 font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            LIVE
            <span className="text-zinc-600">|</span>
            Updated {secondsSinceUpdate}s ago
            <span className="text-zinc-600">|</span>
            Auto-refresh: <span className="text-indigo-400">ON (10s)</span>
          </div>
          <button
            onClick={() => {
              setLoading(true);
              pollSystemState();
            }}
            className="flex items-center justify-center p-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Summary KPI Widgets */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className={clsx("rounded-xl border p-5 flex flex-col justify-between", overallColor)}>
          <span className="text-xs font-semibold uppercase tracking-wider opacity-60">System Status</span>
          <span className="mt-2 text-2xl font-bold tracking-tight">{overallStatus}</span>
        </div>
        
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col justify-between">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Services Online</span>
          <span className="mt-2 text-2xl font-bold text-zinc-100">{healthyCount} / {services.length}</span>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col justify-between">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Active Training Jobs</span>
          <span className="mt-2 text-2xl font-bold text-indigo-400">{activeJobs}</span>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col justify-between">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Total Registered Models</span>
          <span className="mt-2 text-2xl font-bold text-violet-400">{models.length}</span>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col justify-between">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Total Prediction Requests</span>
          <span className="mt-2 text-2xl font-bold text-amber-400">{predictions.length}</span>
        </div>
      </div>

      {/* Architecture Topology Visualizer */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-6 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-indigo-400" />
          Pipeline Architecture & Active Traffic Paths
        </h2>
        
        <div className="flex flex-col lg:flex-row items-center justify-center gap-6 py-4 overflow-x-auto">
          {/* Client node */}
          <div className="flex flex-col items-center p-3 rounded-lg border border-zinc-700 bg-zinc-800/40 w-32 shadow-sm">
            <span className="text-xs font-bold text-zinc-300">Client / Browser</span>
          </div>

          <ArrowRight className="h-5 w-5 text-zinc-600 rotate-90 lg:rotate-0" />

          {/* Nginx node */}
          <div className={clsx(
            "flex flex-col items-center p-3 rounded-lg border w-32 shadow-sm",
            services.find(s => s.name === 'Nginx Proxy')?.status === 'healthy' ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300" : "border-zinc-800 bg-zinc-900 text-zinc-500"
          )}>
            <span className="text-xs font-bold">Nginx Proxy</span>
          </div>

          <ArrowRight className="h-5 w-5 text-zinc-600 rotate-90 lg:rotate-0" />

          {/* Gateway node */}
          <div className={clsx(
            "flex flex-col items-center p-3 rounded-lg border w-36 shadow-sm",
            services.find(s => s.name === 'API Gateway')?.status === 'healthy' ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300" : "border-zinc-800 bg-zinc-900 text-zinc-500"
          )}>
            <span className="text-xs font-bold">API Gateway</span>
          </div>

          <ArrowRight className="h-5 w-5 text-zinc-600 rotate-90 lg:rotate-0" />

          {/* Core Services Hub */}
          <div className="flex flex-col sm:flex-row gap-4">
            
            {/* Left pipeline: Predictions & Cache */}
            <div className="flex flex-col items-center gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-950/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Inference Serving</span>
              <div className="flex items-center gap-2">
                <div className={clsx(
                  "p-2.5 rounded-lg border text-xs font-bold shadow-sm",
                  services.find(s => s.name === 'Prediction Service')?.status === 'healthy' ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300" : "border-zinc-800 bg-zinc-900 text-zinc-500"
                )}>
                  Prediction Service
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-600" />
                <div className={clsx(
                  "p-2.5 rounded-lg border text-xs font-bold shadow-sm flex items-center gap-1.5",
                  services.find(s => s.name === 'Redis Cache')?.status === 'healthy' ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300" : "border-zinc-800 bg-zinc-900 text-zinc-500"
                )}>
                  <Database className="h-3 w-3" /> Redis
                </div>
              </div>
            </div>

            {/* Right pipeline: Training Lifecycle */}
            <div className="flex flex-col items-center gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-950/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Asynchronous Training</span>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className={clsx(
                  "p-2.5 rounded-lg border text-xs font-bold shadow-sm",
                  services.find(s => s.name === 'Training Service')?.status === 'healthy' ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300" : "border-zinc-800 bg-zinc-900 text-zinc-500"
                )}>
                  Training Service
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-600 rotate-90 sm:rotate-0" />
                <div className={clsx(
                  "p-2.5 rounded-lg border text-xs font-bold shadow-sm flex items-center gap-1.5",
                  services.find(s => s.name === 'RabbitMQ Broker')?.status === 'healthy' ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300" : "border-zinc-800 bg-zinc-900 text-zinc-500"
                )}>
                  <Server className="h-3 w-3" /> RabbitMQ
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-600 rotate-90 sm:rotate-0" />
                <div className={clsx(
                  "p-2.5 rounded-lg border text-xs font-bold shadow-sm",
                  services.find(s => s.name === 'Training Worker')?.status === 'healthy' ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300" : "border-zinc-800 bg-zinc-900 text-zinc-500"
                )}>
                  Training Worker
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Grid: 12 Services Health Checks & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1: Services Grid */}
        <div className="lg:col-span-1 rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">Services Matrix</h2>
            <p className="text-xs text-zinc-500 mt-1">Real-time health status checklist.</p>
          </div>
          
          <div className="divide-y divide-zinc-800">
            {services.map(svc => (
              <div key={svc.name} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-zinc-200">{svc.name}</div>
                  <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{svc.endpoint}</div>
                </div>
                <StatusBadge status={svc.status} />
              </div>
            ))}
          </div>
        </div>

        {/* Column 2 & 3: Recent Activity Panels */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Recent Training Jobs */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">Recent Training Jobs</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Latest asynchronously submitted runs.</p>
              </div>
              <Link href="/training" className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 font-medium uppercase text-[10px] tracking-wider bg-zinc-950/20">
                    <th className="px-6 py-3">Job ID</th>
                    <th className="px-6 py-3">Model</th>
                    <th className="px-6 py-3">Algorithm</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {trainingJobs.slice(0, 5).map(job => (
                    <tr key={job.id} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="px-6 py-3.5 font-mono text-zinc-500">
                        <Link href={`/training/${job.id}`} className="hover:underline text-indigo-400">
                          {job.id.substring(0, 8)}...
                        </Link>
                      </td>
                      <td className="px-6 py-3.5 font-semibold text-zinc-300">{job.model_id}</td>
                      <td className="px-6 py-3.5 text-zinc-400">{job.algorithm}</td>
                      <td className="px-6 py-3.5">
                        <span className={clsx(
                          "px-2 py-0.5 rounded text-[10px] font-bold border",
                          job.status === 'READY' || job.status === 'COMPLETED' ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                          job.status === 'PROCESSING' ? "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" :
                          job.status === 'FAILED' ? "text-red-400 bg-red-500/10 border-red-500/20" :
                          "text-amber-400 bg-amber-500/10 border-amber-500/20"
                        )}>
                          {job.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {trainingJobs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-zinc-600">No training jobs found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Prediction Logs */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">Recent Prediction Requests</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Real-time model serving latency logs.</p>
              </div>
              <Link href="/predictions" className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 font-medium uppercase text-[10px] tracking-wider bg-zinc-950/20">
                    <th className="px-6 py-3">Request ID</th>
                    <th className="px-6 py-3">Model</th>
                    <th className="px-6 py-3">Confidence</th>
                    <th className="px-6 py-3">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {predictions.slice(0, 5).map(pred => (
                    <tr key={pred.id} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="px-6 py-3.5 font-mono text-zinc-500">{pred.id.substring(0, 8)}...</td>
                      <td className="px-6 py-3.5 text-zinc-300">
                        {pred.model_id} <span className="text-[10px] text-zinc-500">({pred.model_version})</span>
                      </td>
                      <td className="px-6 py-3.5 text-zinc-400 font-medium">
                        {pred.confidence ? `${(pred.confidence * 100).toFixed(1)}%` : 'N/A'}
                      </td>
                      <td className="px-6 py-3.5 font-mono text-zinc-300">{pred.latency_ms}ms</td>
                    </tr>
                  ))}
                  {predictions.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-zinc-600">No predictions made yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Failures Section (Filtered from training jobs & predictions) */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
            <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Recent Incidents & Failures
            </h2>
            
            <div className="space-y-3">
              {trainingJobs.filter(j => j.status === 'FAILED').slice(0, 3).map(job => (
                <div key={job.id} className="p-4 rounded-lg border border-red-500/20 bg-red-500/5 text-xs flex gap-3 items-start">
                  <XCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-zinc-200">Training Job Failed</div>
                    <div className="text-zinc-400 mt-1">Model ID: <span className="font-mono">{job.model_id}</span> | Algorithm: <span className="font-mono">{job.algorithm}</span></div>
                    {job.error_message && <div className="text-red-400 font-mono mt-1 text-[11px] bg-red-950/20 p-2 rounded border border-red-900/30">{job.error_message}</div>}
                  </div>
                </div>
              ))}
              
              {trainingJobs.filter(j => j.status === 'FAILED').length === 0 && (
                <div className="text-center text-zinc-500 py-4 text-xs">
                  No failures detected in active systems.
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
