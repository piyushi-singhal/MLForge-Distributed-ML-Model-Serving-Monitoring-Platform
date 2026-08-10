'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BrainCircuit,
  RefreshCw,
  ArrowRight,
  Clock,
  Calendar,
  Layers,
} from 'lucide-react';
import { trainingApi } from '@/lib/api/training';
import { TrainingJob } from '@/types/training';
import { clsx } from 'clsx';

export default function TrainingJobsListPage() {
  const [jobs, setJobs] = useState<TrainingJob[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchJobs() {
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
    fetchJobs();
  }, []);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <Layers className="h-6 w-6 text-indigo-400" />
            Training Pipeline
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Monitor and trace the status of distributed asynchronous model training runs.
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={fetchJobs}
            className="flex items-center justify-center p-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <RefreshCw className="h-8 w-8 text-indigo-400 animate-spin" />
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 font-bold uppercase text-xs tracking-wider bg-zinc-950/20">
                <th className="px-6 py-4">Job ID</th>
                <th className="px-6 py-4">Model ID</th>
                <th className="px-6 py-4">Algorithm</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Attempts</th>
                <th className="px-6 py-4">Duration</th>
                <th className="px-6 py-4">Created At</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {jobs.map(job => {
                const durationSec = job.completed_at && job.started_at 
                  ? Math.round((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000)
                  : null;
                  
                return (
                  <tr key={job.id} className="hover:bg-zinc-800/20 transition-colors">
                    <td className="px-6 py-4 font-mono text-zinc-400 select-all">
                      {job.id.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/models/${job.model_id}`} className="font-semibold text-indigo-400 hover:underline">
                        {job.model_id}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-zinc-300">
                      {job.algorithm}
                    </td>
                    <td className="px-6 py-4">
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
                    <td className="px-6 py-4 text-zinc-400 text-center font-mono">
                      {job.retry_count + 1}
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                      {durationSec !== null ? (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-zinc-500" />
                          {durationSec}s
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Calendar className="h-3.5 w-3.5 text-zinc-600" />
                        {new Date(job.created_at).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/training/${job.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        Inspect <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-zinc-500">
                    No training runs recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
