'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  RefreshCw,
  XCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Zap,
  Server,
  Activity,
} from 'lucide-react';
import { trainingApi } from '@/lib/api/training';
import { TrainingJob } from '@/types/training';
import { clsx } from 'clsx';

interface FailureEvent {
  id: string;
  service: string;
  type: string;
  timestamp: string;
  detail: string;
  retryCount: number;
  status: 'recovered' | 'retrying' | 'failed';
}

export default function FailuresPage() {
  const [jobs, setJobs] = useState<TrainingJob[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchFailures() {
    setLoading(true);
    try {
      const data = await trainingApi.listJobs();
      setJobs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFailures();
  }, []);

  // Filter jobs that failed or had retries (indicating failures happened)
  const failedJobs = jobs.filter(j => j.status === 'FAILED' || j.retry_count > 0);

  // Convert failed/retried jobs to unified FailureEvent interface
  const events: FailureEvent[] = failedJobs.map(job => {
    let status: FailureEvent['status'] = 'retrying';
    if (job.status === 'FAILED') status = 'failed';
    else if (job.status === 'READY' || job.status === 'COMPLETED') status = 'recovered';

    return {
      id: job.id,
      service: 'Training Worker',
      type: 'Distributed Job Failure',
      timestamp: job.completed_at || job.created_at,
      detail: job.error_message || `Transient worker interruption encountered during ${job.algorithm} model fitting.`,
      retryCount: job.retry_count,
      status,
    };
  });

  return (
    <div className="p-8 space-y-8 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-red-500 animate-pulse" />
            Failure & Recovery Incidents
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Observe distributed-system self-healing timelines, worker retries, and message broker recovery paths.
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={fetchFailures}
            className="flex items-center justify-center p-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Failure Self-Healing Recovery Pipeline Visualizer */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-6">
        <div>
          <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">Distributed Recovery Blueprint</h2>
          <p className="text-xs text-zinc-500 mt-1">Timeline of how MLForge resolves transient worker node outages.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative py-4">
          <div className="absolute top-[28px] left-0 right-0 h-0.5 bg-zinc-800 -z-10" />

          {/* Node 1 */}
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-8 h-8 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 flex items-center justify-center text-xs font-bold font-mono">
              1
            </div>
            <div>
              <span className="text-xs font-bold text-red-400">Worker Outage</span>
              <p className="text-[10px] text-zinc-500 max-w-[120px] mx-auto mt-1 leading-normal">
                Container crashes or reports transient db query exception.
              </p>
            </div>
          </div>

          {/* Node 2 */}
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-8 h-8 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xs font-bold font-mono">
              2
            </div>
            <div>
              <span className="text-xs font-bold text-indigo-400">Message Redelivery</span>
              <p className="text-[10px] text-zinc-500 max-w-[120px] mx-auto mt-1 leading-normal">
                RabbitMQ broker identifies unacknowledged channel, tags task for redelivery.
              </p>
            </div>
          </div>

          {/* Node 3 */}
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-8 h-8 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 flex items-center justify-center text-xs font-bold font-mono">
              3
            </div>
            <div>
              <span className="text-xs font-bold text-amber-400">Retry Exchange</span>
              <p className="text-[10px] text-zinc-500 max-w-[120px] mx-auto mt-1 leading-normal">
                Jobs routed to TTL delay queues, avoiding immediate thrashing.
              </p>
            </div>
          </div>

          {/* Node 4 */}
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-8 h-8 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 flex items-center justify-center text-xs font-bold font-mono">
              4
            </div>
            <div>
              <span className="text-xs font-bold text-amber-400">Attempts (1 - 3)</span>
              <p className="text-[10px] text-zinc-500 max-w-[120px] mx-auto mt-1 leading-normal">
                Database tracks retry increments. Unresolved runs route to DLQ.
              </p>
            </div>
          </div>

          {/* Node 5 */}
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-8 h-8 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-bold font-mono">
              5
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-400">Safe Recovery</span>
              <p className="text-[10px] text-zinc-500 max-w-[120px] mx-auto mt-1 leading-normal">
                Postgres state commits model READY status and triggers serving cache.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Incident Logs Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Historical Incident Records</h2>
          <p className="text-xs text-zinc-500 mt-1">Audit trail of self-healed or failed distributed transactions.</p>
        </div>

        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 font-medium uppercase text-[10px] tracking-wider bg-zinc-950/20">
              <th className="px-6 py-4">Incident Request ID</th>
              <th className="px-6 py-4">Service</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Failures Checked</th>
              <th className="px-6 py-4">Retries</th>
              <th className="px-6 py-4">Recovery Status</th>
              <th className="px-6 py-4">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 text-xs">
            {events.map((e) => (
              <tr key={e.id} className="hover:bg-zinc-800/20 transition-colors">
                <td className="px-6 py-4 font-mono text-indigo-400">
                  <Link href={`/training/${e.id}`} className="hover:underline">
                    {e.id.substring(0, 8)}...
                  </Link>
                </td>
                <td className="px-6 py-4 font-semibold text-zinc-300">{e.service}</td>
                <td className="px-6 py-4 text-zinc-400">{e.type}</td>
                <td className="px-6 py-4 text-zinc-500">{new Date(e.timestamp).toLocaleString()}</td>
                <td className="px-6 py-4 font-mono text-zinc-400 text-center">{e.retryCount}</td>
                <td className="px-6 py-4">
                  <span className={clsx(
                    "px-2 py-0.5 rounded text-[10px] font-bold border",
                    e.status === 'recovered' ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                    e.status === 'retrying' ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
                    "text-red-400 bg-red-500/10 border-red-500/20"
                  )}>
                    {e.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 text-zinc-400 truncate max-w-[200px]" title={e.detail}>
                  {e.detail}
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                  Zero active incident records. The distributed network is stable.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
