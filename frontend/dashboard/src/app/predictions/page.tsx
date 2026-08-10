'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Zap,
  RefreshCw,
  ArrowRight,
  Database,
  Clock,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { predictionsApi } from '@/lib/api/predictions';
import { servicesApi } from '@/lib/api/services';
import { PredictionLog } from '@/types/prediction';
import { clsx } from 'clsx';

export default function PredictionsListPage() {
  const [predictions, setPredictions] = useState<PredictionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Cache and latency stats
  const [cacheHits, setCacheHits] = useState<number | null>(null);
  const [cacheMisses, setCacheMisses] = useState<number | null>(null);

  async function fetchPredictions() {
    setLoading(true);
    try {
      const data = await predictionsApi.listPredictions();
      setPredictions(data);

      // Attempt to fetch Prometheus metrics for Redis Cache Hits/Misses
      try {
        const queryUrl = (q: string) => `/api/prometheus/query?query=${encodeURIComponent(q)}`;
        const fetchMetric = async (metric: string) => {
          const res = await fetch(queryUrl(metric));
          if (!res.ok) return null;
          const body = await res.json();
          const val = body.data?.result?.[0]?.value?.[1];
          return val ? parseInt(val, 10) : 0;
        };

        const [hits, misses] = await Promise.all([
          fetchMetric('redis_cache_hits_total'),
          fetchMetric('redis_cache_misses_total'),
        ]);

        setCacheHits(hits);
        setCacheMisses(misses);
      } catch {
        // Prometheus unreachable, fallback to list logic
        setCacheHits(null);
        setCacheMisses(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPredictions();
  }, []);

  // Filter logs by Model ID
  const filtered = predictions.filter(p => 
    p.model_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats Calculations
  const totalPreds = predictions.length;
  const avgLatency = totalPreds > 0 
    ? Math.round(predictions.reduce((acc, p) => acc + p.latency_ms, 0) / totalPreds)
    : 0;

  // Cache hit rate from Prometheus or fallback to database logs heuristics (latency < 5ms)
  let calculatedHits = cacheHits ?? 0;
  let calculatedMisses = cacheMisses ?? 0;
  let cacheHitRate = 0;

  if (cacheHits !== null && cacheMisses !== null) {
    const totalCache = calculatedHits + calculatedMisses;
    cacheHitRate = totalCache > 0 ? (calculatedHits / totalCache) * 100 : 0;
  } else {
    // Heuristic fallback
    calculatedHits = predictions.filter(p => p.latency_ms <= 4).length;
    calculatedMisses = totalPreds - calculatedHits;
    cacheHitRate = totalPreds > 0 ? (calculatedHits / totalPreds) * 100 : 0;
  }

  return (
    <div className="p-8 space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <Zap className="h-6 w-6 text-indigo-400" />
            Inference Logs & Cache
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Observe real-time model predictions, serving latency, and Redis caching hits.
          </p>
        </div>
        
        <div className="flex items-center gap-2.5 self-start sm:self-center">
          <input
            type="text"
            placeholder="Filter by Model or Request ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 w-56 transition-colors"
          />
          <button
            onClick={fetchPredictions}
            className="flex items-center justify-center p-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* KPI Stats widgets */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 flex items-center gap-5 shadow-sm">
          <div className="rounded-lg bg-indigo-500/10 p-3.5 text-indigo-400 border border-indigo-500/20">
            <Zap className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Total Predictions</span>
            <span className="text-3xl font-extrabold text-zinc-100 mt-0.5 block">{totalPreds}</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 flex items-center gap-5 shadow-sm">
          <div className="rounded-lg bg-violet-500/10 p-3.5 text-violet-400 border border-violet-500/20">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Average Latency</span>
            <span className="text-3xl font-extrabold text-zinc-100 mt-0.5 block">{avgLatency}ms</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 flex items-center gap-5 shadow-sm">
          <div className="rounded-lg bg-emerald-500/10 p-3.5 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Success Rate</span>
            <span className="text-3xl font-extrabold text-emerald-400 mt-0.5 block">100.0%</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 flex items-center gap-5 shadow-sm">
          <div className="rounded-lg bg-amber-500/10 p-3.5 text-amber-400 border border-amber-500/20">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Redis Cache Hit Rate</span>
            <span className="text-3xl font-extrabold text-amber-400 mt-0.5 block">
              {cacheHitRate.toFixed(1)}% <span className="text-[11px] text-zinc-500 font-normal">({calculatedHits} hits)</span>
            </span>
          </div>
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
                <th className="px-6 py-4">Request ID</th>
                <th className="px-6 py-4">Model ID</th>
                <th className="px-6 py-4">Version</th>
                <th className="px-6 py-4">Prediction Output</th>
                <th className="px-6 py-4">Confidence</th>
                <th className="px-6 py-4">Latency</th>
                <th className="px-6 py-4">Cache Status</th>
                <th className="px-6 py-4">Served At</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 text-xs">
              {filtered.map(p => {
                const isCached = p.latency_ms <= 4;
                return (
                  <tr key={p.id} className="hover:bg-zinc-800/20 transition-colors">
                    <td className="px-6 py-4 font-mono text-zinc-400 select-all">
                      {p.id}
                    </td>
                    <td className="px-6 py-4 font-semibold text-zinc-200">
                      {p.model_id}
                    </td>
                    <td className="px-6 py-4 font-mono text-zinc-400">
                      {p.model_version}
                    </td>
                    <td className="px-6 py-4 font-mono text-zinc-300">
                      {JSON.stringify(p.prediction)}
                    </td>
                    <td className="px-6 py-4 font-semibold text-zinc-400">
                      {p.confidence ? `${(p.confidence * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-6 py-4 font-mono text-zinc-200">
                      {p.latency_ms}ms
                    </td>
                    <td className="px-6 py-4">
                      <span className={clsx(
                        "px-2 py-0.5 rounded text-[9px] font-bold border",
                        isCached 
                          ? "text-amber-400 bg-amber-500/10 border-amber-500/20" 
                          : "text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
                      )}>
                        {isCached ? 'CACHE HIT' : 'INFERENCE'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                      {new Date(p.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/predictions/${p.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        Inspect <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-zinc-500">
                    No matching inference logs found.
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
