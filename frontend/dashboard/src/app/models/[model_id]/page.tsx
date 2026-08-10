'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BrainCircuit,
  Calendar,
  Database,
  GitCommit,
  Layers,
  Activity,
  CheckCircle2,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { modelsApi } from '@/lib/api/models';
import { trainingApi } from '@/lib/api/training';
import { Model, ModelVersion } from '@/types/model';
import { TrainingJob } from '@/types/training';
import { clsx } from 'clsx';

export default function ModelDetailPage({ params }: { params: Promise<{ model_id: string }> }) {
  const { model_id } = use(params);

  const [model, setModel] = useState<Model | null>(null);
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [activeVersion, setActiveVersion] = useState<ModelVersion | null>(null);
  const [trainingJobs, setTrainingJobs] = useState<TrainingJob[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchDetails() {
    setLoading(true);
    try {
      const [modelData, versionList, activeVer, jobs] = await Promise.all([
        modelsApi.getModel(model_id),
        modelsApi.listVersions(model_id).catch(() => [] as ModelVersion[]),
        modelsApi.getActiveVersion(model_id).catch(() => null),
        trainingApi.listJobs().catch(() => [] as TrainingJob[]),
      ]);

      setModel(modelData);
      
      // Sort versions chronologically
      const sortedVersions = [...versionList].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setVersions(sortedVersions);
      setActiveVersion(activeVer);
      
      // Filter training jobs for this model
      const modelJobs = jobs.filter(j => j.model_id === model_id);
      setTrainingJobs(modelJobs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDetails();
  }, [model_id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-40">
        <RefreshCw className="h-8 w-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!model) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="text-zinc-400">Model not found in registry.</div>
        <Link href="/models" className="text-indigo-400 hover:underline">Back to registry</Link>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Back navigation */}
      <Link
        href="/models"
        className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Model Registry
      </Link>

      {/* Model Title Header */}
      <div className="flex flex-col md:flex-row justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <BrainCircuit className="h-6 w-6 text-indigo-400" />
            {model.name}
          </h1>
          <p className="mt-1.5 text-xs font-mono text-zinc-500">{model.id}</p>
          <p className="mt-2 text-sm text-zinc-400 max-w-2xl">{model.description || 'No description provided.'}</p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-center">
          <button
            onClick={fetchDetails}
            className="flex items-center justify-center p-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Version Timeline Panel */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-6">
        <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
          <Layers className="h-4 w-4 text-indigo-400" />
          Version Deployment Timeline
        </h2>
        
        {versions.length > 0 ? (
          <div className="relative flex items-center justify-start gap-8 py-4 overflow-x-auto">
            {/* The horizontal connector line */}
            <div className="absolute top-[28px] left-0 right-0 h-0.5 bg-zinc-800 -z-10" />
            
            {versions.map((ver, idx) => {
              const isActive = activeVersion?.version === ver.version;
              return (
                <div key={ver.id} className="flex flex-col items-center min-w-[120px] relative">
                  <div className={clsx(
                    "w-8 h-8 rounded-full border flex items-center justify-center font-mono text-xs font-bold",
                    isActive 
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 ring-2 ring-emerald-500/20" 
                      : "border-zinc-700 bg-zinc-800 text-zinc-400"
                  )}>
                    v{idx + 1}
                  </div>
                  <span className={clsx(
                    "text-xs font-semibold mt-2.5",
                    isActive ? "text-emerald-400" : "text-zinc-400"
                  )}>
                    {ver.version}
                  </span>
                  {isActive && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1 rounded mt-1">
                      ACTIVE
                    </span>
                  )}
                  <span className="text-[10px] text-zinc-500 mt-1 font-mono">{ver.algorithm}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-zinc-500 italic">
            No versions have been trained or registered for this model yet.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Active Version Details */}
        <div className="lg:col-span-1 space-y-6">
          
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
            <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Active Version Specifications</h2>
            
            {activeVersion ? (
              <div className="space-y-4 text-xs">
                <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                  <span className="text-zinc-500">Semantic Version</span>
                  <span className="font-semibold text-zinc-200 font-mono">{activeVersion.version}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                  <span className="text-zinc-500">Algorithm</span>
                  <span className="text-zinc-200">{activeVersion.algorithm}</span>
                </div>
                <div className="flex flex-col gap-1.5 py-2 border-b border-zinc-800">
                  <span className="text-zinc-500">Artifact Storage Path</span>
                  <span className="font-mono text-zinc-400 bg-zinc-950 p-2 rounded text-[10px] select-all break-all border border-zinc-800">
                    {activeVersion.artifact_path}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                  <span className="text-zinc-500">Status</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-500/20 text-emerald-400 bg-emerald-500/10">
                    {activeVersion.status}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-zinc-500">Activated At</span>
                  <span className="text-zinc-300">{new Date(activeVersion.created_at).toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-zinc-500 italic">
                No active model version serving predictions.
              </div>
            )}
          </div>

          {/* Model Metrics Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
            <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-indigo-400" />
              Active Version Metrics
            </h2>
            
            {activeVersion && activeVersion.metrics_json && Object.keys(activeVersion.metrics_json).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(activeVersion.metrics_json).map(([name, val]) => (
                  <div key={name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-zinc-400 capitalize">{name}</span>
                      <span className="font-semibold text-zinc-200">{typeof val === 'number' ? (val * 100).toFixed(2) + '%' : String(val)}</span>
                    </div>
                    {typeof val === 'number' && (
                      <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${val * 100}%` }}></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-zinc-500 italic">
                No validation metrics recorded.
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Training Execution History */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800">
              <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Model Training Job Executions</h2>
              <p className="text-xs text-zinc-500 mt-1">Status of training runs submitted for this model.</p>
            </div>
            
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 font-medium uppercase text-[10px] tracking-wider bg-zinc-950/20">
                  <th className="px-6 py-3">Job ID</th>
                  <th className="px-6 py-3">Algorithm</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Duration</th>
                  <th className="px-6 py-3">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {trainingJobs.map(job => {
                  const durationSec = job.completed_at && job.started_at 
                    ? Math.round((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000)
                    : null;
                  
                  return (
                    <tr key={job.id} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="px-6 py-3.5 font-mono text-zinc-500">
                        <Link href={`/training/${job.id}`} className="hover:underline text-indigo-400">
                          {job.id.substring(0, 8)}...
                        </Link>
                      </td>
                      <td className="px-6 py-3.5 text-zinc-300">{job.algorithm}</td>
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
                      <td className="px-6 py-3.5 text-zinc-400">
                        {durationSec ? `${durationSec}s` : '—'}
                      </td>
                      <td className="px-6 py-3.5 text-zinc-400">
                        {new Date(job.created_at).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
                {trainingJobs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-zinc-500">
                      No training job history for this model.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );
}
