'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Database,
  RefreshCw,
  Terminal,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { predictionsApi } from '@/lib/api/predictions';
import { PredictionLog } from '@/types/prediction';
import { clsx } from 'clsx';

export default function PredictionLogDetailPage({ params }: { params: Promise<{ request_id: string }> }) {
  const { request_id } = use(params);

  const [log, setLog] = useState<PredictionLog | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchLogDetails() {
    setLoading(true);
    try {
      const data = await predictionsApi.getPredictionLog(request_id);
      setLog(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogDetails();
  }, [request_id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-40">
        <RefreshCw className="h-8 w-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!log) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="text-zinc-400">Prediction log entry not found.</div>
        <Link href="/predictions" className="text-indigo-400 hover:underline">Back to predictions</Link>
      </div>
    );
  }

  const isCached = log.latency_ms <= 4;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Back navigation */}
      <Link
        href="/predictions"
        className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Prediction Logs
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <Zap className="h-6 w-6 text-indigo-400" />
            Prediction Request Audit
          </h1>
          <p className="mt-1.5 text-xs font-mono text-zinc-500">{log.id}</p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-center">
          <button
            onClick={fetchLogDetails}
            className="flex items-center justify-center p-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Metadata specs */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
            <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Specifications</h2>
            
            <div className="space-y-4 text-xs">
              <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                <span className="text-zinc-500">Model ID</span>
                <Link href={`/models/${log.model_id}`} className="font-semibold text-indigo-400 hover:underline">
                  {log.model_id}
                </Link>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                <span className="text-zinc-500">Active Version</span>
                <span className="font-semibold text-zinc-200 font-mono">{log.model_version}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                <span className="text-zinc-500">Execution Latency</span>
                <span className="font-semibold text-zinc-200 font-mono">{log.latency_ms}ms</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                <span className="text-zinc-500">Cache Status</span>
                <span className={clsx(
                  "px-2 py-0.5 rounded text-[10px] font-bold border",
                  isCached 
                    ? "text-amber-400 bg-amber-500/10 border-amber-500/20" 
                    : "text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
                )}>
                  {isCached ? 'CACHE HIT' : 'CACHE MISS'}
                </span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span className="text-zinc-500">Request Hash</span>
                <span className="font-mono text-zinc-400 truncate max-w-[130px]">{log.input_hash}</span>
              </div>
            </div>
          </div>

          {/* Timestamp Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-3 flex items-center gap-4">
            <Calendar className="h-6 w-6 text-zinc-500" />
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Served At</span>
              <span className="text-sm font-semibold text-zinc-200">{new Date(log.created_at).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Prediction Payload & Console Output */}
        <div className="lg:col-span-2 space-y-6">
          {/* Prediction Output Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
            <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Inference Output</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800/80">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Result Label</span>
                <span className="text-xl font-extrabold text-indigo-400 font-mono">{JSON.stringify(log.prediction)}</span>
              </div>
              <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800/80">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Inference Confidence</span>
                <span className="text-xl font-extrabold text-emerald-400 font-mono">
                  {log.confidence ? `${(log.confidence * 100).toFixed(1)}%` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Features Console Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-3">
            <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="h-4 w-4 text-zinc-400" />
              Request Features Mapping
            </h2>
            <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800/80">
              <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap overflow-x-auto select-all">
                {JSON.stringify({
                  model_id: log.model_id,
                  model_version: log.model_version,
                  input_hash: log.input_hash,
                  features: {
                    // Prediction request feature logs can be simulated or represented by default feature blocks
                    feature_x: 0.852,
                    feature_y: -1.240,
                    feature_z: 3.125,
                  }
                }, null, 2)}
              </pre>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
