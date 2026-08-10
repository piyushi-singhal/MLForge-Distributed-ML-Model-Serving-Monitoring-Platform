'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BrainCircuit,
  Plus,
  RefreshCw,
  ArrowRight,
  Shield,
  Calendar,
} from 'lucide-react';
import { modelsApi } from '@/lib/api/models';
import { Model, ModelVersion } from '@/types/model';
import { clsx } from 'clsx';

export default function ModelsListPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [activeVersions, setActiveVersions] = useState<Record<string, ModelVersion | null>>({});
  const [loading, setLoading] = useState(true);

  async function fetchModels() {
    setLoading(true);
    try {
      const data = await modelsApi.listModels();
      setModels(data);
      
      // Fetch active version for each model
      const activePromises = data.map(async model => {
        try {
          const act = await modelsApi.getActiveVersion(model.id);
          return { modelId: model.id, version: act };
        } catch {
          return { modelId: model.id, version: null };
        }
      });
      const resolved = await Promise.all(activePromises);
      const versionMap: Record<string, ModelVersion | null> = {};
      resolved.forEach(item => {
        versionMap[item.modelId] = item.version;
      });
      setActiveVersions(versionMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchModels();
  }, []);

  return (
    <div className="p-8 space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <BrainCircuit className="h-6 w-6 text-indigo-400" />
            Models Registry
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            View registered models, trace deployment status, and inspect model artifact metadata.
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={fetchModels}
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
                <th className="px-6 py-4">Model ID / Name</th>
                <th className="px-6 py-4">Active Version</th>
                <th className="px-6 py-4">Algorithm</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Created At</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {models.map(model => {
                const activeVer = activeVersions[model.id];
                return (
                  <tr key={model.id} className="hover:bg-zinc-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-zinc-200">{model.name}</div>
                      <div className="text-xs text-zinc-500 font-mono mt-0.5">{model.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      {activeVer ? (
                        <span className="font-mono text-zinc-300 font-semibold">{activeVer.version}</span>
                      ) : (
                        <span className="text-xs text-zinc-600 italic">No Active Version</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                      {activeVer ? activeVer.algorithm : '—'}
                    </td>
                    <td className="px-6 py-4">
                      {activeVer ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-500/20 text-emerald-400 bg-emerald-500/10">
                          {activeVer.status}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-zinc-800 text-zinc-500 bg-zinc-950">
                          DRAFT
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Calendar className="h-3.5 w-3.5 text-zinc-600" />
                        {new Date(model.created_at).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/models/${model.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        Inspect <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {models.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                    No models registered in the registry yet.
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
