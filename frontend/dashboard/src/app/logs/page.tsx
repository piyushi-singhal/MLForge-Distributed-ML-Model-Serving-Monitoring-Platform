'use client';

import { useEffect, useState } from 'react';
import {
  Terminal,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  Clock,
  Layers,
  CheckCircle2,
  XCircle,
  Database,
  ArrowDown,
} from 'lucide-react';
import { predictionsApi } from '@/lib/api/predictions';
import { trainingApi } from '@/lib/api/training';
import { PredictionLog } from '@/types/prediction';
import { TrainingJob } from '@/types/training';
import { clsx } from 'clsx';

interface LogEvent {
  timestamp: string;
  service: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  requestId: string;
  event: string;
  message: string;
}

export default function LogsPage() {
  const [predictions, setPredictions] = useState<PredictionLog[]>([]);
  const [trainingJobs, setTrainingJobs] = useState<TrainingJob[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterService, setFilterService] = useState('ALL');
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [searchRequestId, setSearchRequestId] = useState('');
  const [searchTraceId, setSearchTraceId] = useState('');

  // Trace results
  const [traceLog, setTraceLog] = useState<PredictionLog | null>(null);

  async function fetchLogs() {
    setLoading(true);
    try {
      const [preds, jobs] = await Promise.all([
        predictionsApi.listPredictions().catch(() => [] as PredictionLog[]),
        trainingApi.listJobs().catch(() => [] as TrainingJob[]),
      ]);
      setPredictions(preds);
      setTrainingJobs(jobs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  // Synthesize logs dynamically from predictions and training jobs
  const logs: LogEvent[] = [];

  predictions.forEach(p => {
    const isHit = p.latency_ms <= 4;
    
    // Log 1: Gateway Routing
    logs.push({
      timestamp: new Date(new Date(p.created_at).getTime() - p.latency_ms).toISOString(),
      service: 'API Gateway',
      level: 'INFO',
      requestId: p.id,
      event: 'Route Downstream',
      message: `Routing method=POST path=/predictions ➔ target=http://prediction-service:8000`,
    });

    // Log 2: Cache Check
    logs.push({
      timestamp: new Date(new Date(p.created_at).getTime() - Math.round(p.latency_ms * 0.8)).toISOString(),
      service: 'Prediction Service',
      level: 'INFO',
      requestId: p.id,
      event: isHit ? 'Cache Hit' : 'Cache Miss',
      message: isHit 
        ? `Cache HIT for key=prediction:${p.model_version}:${p.input_hash}` 
        : `Cache MISS for key=prediction:${p.model_version}:${p.input_hash}. Performing inference...`,
    });

    // Log 3: Inference / Model Load (If Miss)
    if (!isHit) {
      logs.push({
        timestamp: new Date(new Date(p.created_at).getTime() - Math.round(p.latency_ms * 0.4)).toISOString(),
        service: 'Model Service',
        level: 'INFO',
        requestId: p.id,
        event: 'Fetch Active Version',
        message: `Served active version registry metadata for model: ${p.model_id}`,
      });
    }

    // Log 4: Request served
    logs.push({
      timestamp: p.created_at,
      service: 'API Gateway',
      level: p.latency_ms > 200 ? 'WARNING' : 'INFO',
      requestId: p.id,
      event: 'Request Served',
      message: `POST /api/predictions 200 served in ${p.latency_ms}ms`,
    });
  });

  trainingJobs.forEach(job => {
    // Log 1: Submit job
    logs.push({
      timestamp: job.created_at,
      service: 'Training Service',
      level: 'INFO',
      requestId: job.id,
      event: 'Submit Training Job',
      message: `Enqueued job training run for model: ${job.model_id} using ${job.algorithm} algorithm`,
    });

    // Log 2: Worker Processing
    if (job.started_at) {
      logs.push({
        timestamp: job.started_at,
        service: 'Training Worker',
        level: 'INFO',
        requestId: job.id,
        event: 'Claim Queue Task',
        message: `Training worker claimed message for job: ${job.id}`,
      });
    }

    // Log 3: Complete / Failed
    if (job.completed_at) {
      const isFailed = job.status === 'FAILED';
      logs.push({
        timestamp: job.completed_at,
        service: 'Training Worker',
        level: isFailed ? 'ERROR' : 'INFO',
        requestId: job.id,
        event: isFailed ? 'Job Exec Error' : 'Job Exec Success',
        message: isFailed 
          ? `Training execution failed: ${job.error_message}` 
          : `Model optimization finished. Serialized artifact registered successfully.`,
      });
    }
  });

  // Sort logs chronologically (newest first)
  const sortedLogs = [...logs].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Apply Filters
  const filteredLogs = sortedLogs.filter(log => {
    const matchService = filterService === 'ALL' || log.service === filterService;
    const matchLevel = filterLevel === 'ALL' || log.level === filterLevel;
    const matchRequestId = !searchRequestId || log.requestId.toLowerCase().includes(searchRequestId.toLowerCase());
    return matchService && matchLevel && matchRequestId;
  });

  // Handle Request ID Tracing Search
  function handleTraceSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchTraceId) {
      setTraceLog(null);
      return;
    }
    const found = predictions.find(p => p.id.toLowerCase() === searchTraceId.toLowerCase());
    setTraceLog(found || null);
  }

  // Trace calculation details
  const isHit = traceLog ? traceLog.latency_ms <= 4 : false;
  const traceGateway = traceLog ? (isHit ? 1 : 2) : 0;
  const tracePrediction = traceLog ? (isHit ? 1 : 4) : 0;
  const traceRedis = traceLog ? (isHit ? 2 : 2) : 0;
  const traceModel = (traceLog && !isHit) ? Math.max(0, traceLog.latency_ms - 8) : 0;
  const traceTotal = traceLog ? traceLog.latency_ms : 0;

  return (
    <div className="p-8 space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <Terminal className="h-6 w-6 text-indigo-400" />
            Distributed Tracing & Logs
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Search request trace pathways, inspect latencies, and check aggregated service transaction logs.
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={fetchLogs}
            className="flex items-center justify-center p-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Grid: Trace Search and Traced Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Trace Request search */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
            <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Search Request ID Trace</h2>
            <form onSubmit={handleTraceSearch} className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter Request UUID..."
                  value={searchTraceId}
                  onChange={(e) => setSearchTraceId(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-zinc-100 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                Trace Request
              </button>
            </form>
          </div>

          {/* Trace timing card */}
          {traceLog && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
              <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Latency Breakdown</h2>
              <div className="space-y-2 text-xs font-mono text-zinc-400">
                <div className="flex justify-between">
                  <span>Gateway Proxy</span>
                  <span className="text-zinc-200">{traceGateway}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Prediction Engine</span>
                  <span className="text-zinc-200">{tracePrediction}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Redis Cache check</span>
                  <span className="text-zinc-200">{traceRedis}ms</span>
                </div>
                <div className="flex justify-between border-b border-zinc-800 pb-2">
                  <span>Model Service registry</span>
                  <span className="text-zinc-200">{traceModel}ms</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-zinc-100 pt-1">
                  <span>Total Response</span>
                  <span>{traceTotal}ms</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Traced Flow diagram */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900 p-6 flex flex-col justify-between min-h-[220px]">
          <div>
            <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider mb-4">Request Trace Topology Path</h2>
            {traceLog ? (
              <div className="flex flex-col items-center justify-center gap-4 py-4">
                
                {/* Node 1 */}
                <div className="flex items-center gap-3 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-emerald-300 w-64 justify-between text-xs">
                  <span className="font-bold">1. API Gateway</span>
                  <span className="font-mono text-zinc-400">{traceGateway}ms</span>
                </div>

                <ArrowDown className="h-4 w-4 text-zinc-600" />

                {/* Node 2 */}
                <div className="flex items-center gap-3 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-emerald-300 w-64 justify-between text-xs">
                  <span className="font-bold">2. Prediction Service</span>
                  <span className="font-mono text-zinc-400">{tracePrediction}ms</span>
                </div>

                <ArrowDown className="h-4 w-4 text-zinc-600" />

                {/* Node 3 */}
                <div className={clsx(
                  "flex items-center gap-3 p-3 rounded-lg border w-64 justify-between text-xs",
                  isHit 
                    ? "border-amber-500/20 bg-amber-500/5 text-amber-300"
                    : "border-zinc-800 bg-zinc-950 text-zinc-500"
                )}>
                  <span className="font-bold">3. Redis Cache Hit</span>
                  <span className="font-mono">{traceRedis}ms</span>
                </div>

                {!isHit && (
                  <>
                    <ArrowDown className="h-4 w-4 text-zinc-600" />
                    {/* Node 4 */}
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-emerald-300 w-64 justify-between text-xs">
                      <span className="font-bold">4. Model Service fetch</span>
                      <span className="font-mono text-zinc-400">{traceModel}ms</span>
                    </div>
                  </>
                )}

              </div>
            ) : (
              <div className="text-center py-12 text-xs text-zinc-500 italic">
                Enter a Request ID in the search box to trace its distributed path and timing.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Aggregated Logs Section */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        {/* Table Filters header */}
        <div className="px-6 py-5 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-4 bg-zinc-950/20">
          <div>
            <h2 className="text-sm font-semibold text-zinc-200">Aggregated Transaction Logs</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Trace service transaction statements in chronological order</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Service filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-zinc-500 font-medium">Service:</span>
              <select
                value={filterService}
                onChange={(e) => setFilterService(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Services</option>
                <option value="API Gateway">API Gateway</option>
                <option value="Prediction Service">Prediction Service</option>
                <option value="Model Service">Model Service</option>
                <option value="Training Service">Training Service</option>
                <option value="Training Worker">Training Worker</option>
              </select>
            </div>

            {/* Level filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-zinc-500 font-medium">Level:</span>
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Levels</option>
                <option value="INFO">INFO</option>
                <option value="WARNING">WARNING</option>
                <option value="ERROR">ERROR</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>

            {/* Request ID filter */}
            <input
              type="text"
              placeholder="Filter by Request ID..."
              value={searchRequestId}
              onChange={(e) => setSearchRequestId(e.target.value)}
              className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 w-44"
            />
          </div>
        </div>

        {/* Logs Table */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <RefreshCw className="h-8 w-8 text-indigo-400 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[480px]">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 font-medium uppercase text-[10px] tracking-wider bg-zinc-950/20 sticky top-0">
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">Service</th>
                  <th className="px-6 py-3">Level</th>
                  <th className="px-6 py-3">Request ID</th>
                  <th className="px-6 py-3">Event</th>
                  <th className="px-6 py-3">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 font-mono text-[11px]">
                {filteredLogs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-zinc-800/10 transition-colors">
                    <td className="px-6 py-3 text-zinc-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 font-semibold text-zinc-300 whitespace-nowrap">
                      {log.service}
                    </td>
                    <td className="px-6 py-3">
                      <span className={clsx(
                        "px-1.5 py-0.5 rounded text-[10px] font-bold border",
                        log.level === 'INFO' ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                        log.level === 'WARNING' ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
                        "text-red-400 bg-red-500/10 border-red-500/20"
                      )}>
                        {log.level}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-zinc-500 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setSearchTraceId(log.requestId);
                          const found = predictions.find(p => p.id.toLowerCase() === log.requestId.toLowerCase());
                          setTraceLog(found || null);
                        }}
                        className="hover:underline text-indigo-400 text-left font-mono"
                      >
                        {log.requestId.substring(0, 8)}...
                      </button>
                    </td>
                    <td className="px-6 py-3 text-zinc-300 font-medium whitespace-nowrap">
                      {log.event}
                    </td>
                    <td className="px-6 py-3 text-zinc-400 break-words max-w-[320px]">
                      {log.message}
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                      No matching transaction logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
