'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Database,
  Layers,
  RefreshCw,
  Server,
  Terminal,
  XCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { trainingApi } from '@/lib/api/training';
import { TrainingJob } from '@/types/training';
import { clsx } from 'clsx';

interface PipelineStep {
  name: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
}

export default function TrainingJobDetailPage({ params }: { params: Promise<{ job_id: string }> }) {
  const { job_id } = use(params);

  const [job, setJob] = useState<TrainingJob | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchJobDetails() {
    setLoading(true);
    try {
      const data = await trainingApi.getJob(job_id);
      setJob(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchJobDetails();
  }, [job_id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-40">
        <RefreshCw className="h-8 w-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="text-zinc-400">Training job not found in records.</div>
        <Link href="/training" className="text-indigo-400 hover:underline">Back to pipeline</Link>
      </div>
    );
  }

  // Calculate duration
  const durationSec = job.completed_at && job.started_at 
    ? Math.round((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000)
    : null;

  // Build Pipeline Steps based on job status
  const steps: PipelineStep[] = [
    { name: 'Created', description: 'Job record initialized in Postgres', status: 'completed' },
    { 
      name: 'Queued', 
      description: 'Pending scheduling', 
      status: job.status === 'QUEUED' ? 'active' : 'completed' 
    },
    { 
      name: 'RabbitMQ', 
      description: 'Enqueued on broker exchange', 
      status: job.status === 'QUEUED' ? 'pending' : 'completed' 
    },
    { 
      name: 'Worker', 
      description: 'Task claimed by training worker', 
      status: job.status === 'QUEUED' ? 'pending' : (job.status === 'PROCESSING' ? 'active' : 'completed')
    },
    { 
      name: 'Training', 
      description: 'Model optimization running', 
      status: job.status === 'QUEUED' ? 'pending' : (job.status === 'PROCESSING' ? 'active' : (job.status === 'FAILED' ? 'failed' : 'completed'))
    },
    { 
      name: 'Model Reg', 
      description: 'Registering artifact registry version', 
      status: job.status === 'QUEUED' || job.status === 'PROCESSING' ? 'pending' : (job.status === 'FAILED' ? 'failed' : 'completed')
    },
    { 
      name: 'Completed', 
      description: 'Ready to serve predictions', 
      status: job.status === 'READY' || job.status === 'COMPLETED' ? 'completed' : (job.status === 'FAILED' ? 'failed' : 'pending')
    }
  ];

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Back navigation */}
      <Link
        href="/training"
        className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Training Pipeline
      </Link>

      {/* Title Header */}
      <div className="flex flex-col md:flex-row justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <Layers className="h-6 w-6 text-indigo-400" />
            Training Job Details
          </h1>
          <p className="mt-1.5 text-xs font-mono text-zinc-500">{job.id}</p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-center">
          <button
            onClick={fetchJobDetails}
            className="flex items-center justify-center p-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Pipeline step tracker */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-6">
        <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Worker Execution Pipeline</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4 relative">
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            
            const badgeClasses = {
              pending: 'border-zinc-800 bg-zinc-950 text-zinc-600',
              active: 'border-indigo-500 bg-indigo-500/10 text-indigo-400 ring-2 ring-indigo-500/20 animate-pulse',
              completed: 'border-emerald-500 bg-emerald-500/10 text-emerald-400',
              failed: 'border-red-500 bg-red-500/10 text-red-400',
            }[step.status];

            const textClasses = {
              pending: 'text-zinc-600',
              active: 'text-indigo-400 font-semibold',
              completed: 'text-zinc-300',
              failed: 'text-red-400 font-semibold',
            }[step.status];

            return (
              <div key={step.name} className="flex flex-col items-center text-center space-y-2 relative">
                {/* Visual Connector Line (Desktop) */}
                {!isLast && (
                  <div className={clsx(
                    "hidden md:block absolute top-[16px] left-[50%] right-[-50%] h-0.5 -z-10",
                    step.status === 'completed' ? 'bg-emerald-500/30' : 'bg-zinc-800'
                  )} />
                )}

                <div className={clsx("w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold font-mono", badgeClasses)}>
                  {idx + 1}
                </div>
                <div>
                  <div className={clsx("text-xs font-medium", textClasses)}>{step.name}</div>
                  <div className="text-[10px] text-zinc-500 max-w-[110px] mx-auto mt-1 leading-normal">{step.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid Specs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Job parameters */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
            <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Specifications & Parameters</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs divide-y md:divide-y-0 md:divide-x divide-zinc-800">
              
              <div className="space-y-4">
                <div>
                  <span className="text-zinc-500 block mb-1">Associated Model</span>
                  <Link href={`/models/${job.model_id}`} className="font-semibold text-indigo-400 hover:underline">
                    {job.model_id}
                  </Link>
                </div>
                <div>
                  <span className="text-zinc-500 block mb-1">Algorithm Selection</span>
                  <span className="font-mono text-zinc-300 bg-zinc-950 px-2 py-1 rounded border border-zinc-800/80">
                    {job.algorithm}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block mb-1">Attempts / Retries</span>
                  <span className="text-zinc-300 font-mono">{job.retry_count + 1} / 4 runs</span>
                </div>
              </div>

              <div className="space-y-4 md:pl-6">
                <div>
                  <span className="text-zinc-500 block mb-1">Created Timestamp</span>
                  <span className="text-zinc-300">{new Date(job.created_at).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block mb-1">Started At</span>
                  <span className="text-zinc-300">{job.started_at ? new Date(job.started_at).toLocaleString() : '—'}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block mb-1">Completed At</span>
                  <span className="text-zinc-300">{job.completed_at ? new Date(job.completed_at).toLocaleString() : '—'}</span>
                </div>
              </div>

            </div>
          </div>

          {/* Dataset Path panel */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-3">
            <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <Database className="h-4 w-4 text-zinc-400" />
              Source Dataset Path
            </h2>
            <div className="bg-zinc-950 p-3 rounded border border-zinc-800/80 font-mono text-xs text-zinc-300 select-all break-all">
              s3://mlforge-datasets/training/{job.model_id}/latest.csv
            </div>
          </div>

        </div>

        {/* Right Column: Execution Outcome / Status logs */}
        <div className="lg:col-span-1 space-y-6">
          
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
            <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Status Console</h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-zinc-800 text-xs">
                <span className="text-zinc-500">Pipeline State</span>
                <span className={clsx(
                  "px-2 py-0.5 rounded text-[10px] font-bold border",
                  job.status === 'READY' || job.status === 'COMPLETED' ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                  job.status === 'PROCESSING' ? "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" :
                  job.status === 'FAILED' ? "text-red-400 bg-red-500/10 border-red-500/20" :
                  "text-amber-400 bg-amber-500/10 border-amber-500/20"
                )}>
                  {job.status}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-zinc-800 text-xs">
                <span className="text-zinc-500">Duration</span>
                <span className="text-zinc-300 font-semibold flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-zinc-500" />
                  {durationSec !== null ? `${durationSec} seconds` : 'Pending'}
                </span>
              </div>
            </div>

            {/* Error Message Panel */}
            {job.status === 'FAILED' && (
              <div className="space-y-2.5">
                <span className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  Pipeline Exception
                </span>
                <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5 font-mono text-[11px] text-red-400 break-words leading-relaxed">
                  {job.error_message || 'Unhandled failure occurred in the training worker container during gradient descent execution.'}
                </div>
              </div>
            )}
            
            {job.status === 'READY' && (
              <div className="space-y-2.5 text-xs text-emerald-400 flex gap-2 items-start border border-emerald-500/20 bg-emerald-500/5 p-3 rounded-lg">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Execution Successful</div>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-normal">The training worker completed successfully and registered the new version with the Model Registry.</p>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
