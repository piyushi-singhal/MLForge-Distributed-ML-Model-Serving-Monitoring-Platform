'use client';

import { useState, useEffect } from 'react';
import {
  Settings,
  RefreshCw,
  Sliders,
  Shield,
  Info,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { clsx } from 'clsx';

export default function SettingsPage() {
  const [healthPoll, setHealthPoll] = useState(10);
  const [trainingPoll, setTrainingPoll] = useState(5);
  const [predictionsPoll, setPredictionsPoll] = useState(5);
  const [metricsPoll, setMetricsPoll] = useState(10);
  const [logsPoll, setLogsPoll] = useState(3);
  
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load existing settings if saved in localStorage
    if (typeof window !== 'undefined') {
      const h = localStorage.getItem('poll_health');
      const t = localStorage.getItem('poll_training');
      const p = localStorage.getItem('poll_predictions');
      const m = localStorage.getItem('poll_metrics');
      const l = localStorage.getItem('poll_logs');
      if (h) setHealthPoll(parseInt(h, 10));
      if (t) setTrainingPoll(parseInt(t, 10));
      if (p) setPredictionsPoll(parseInt(p, 10));
      if (m) setMetricsPoll(parseInt(m, 10));
      if (l) setLogsPoll(parseInt(l, 10));
    }
  }, []);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      localStorage.setItem('poll_health', String(healthPoll));
      localStorage.setItem('poll_training', String(trainingPoll));
      localStorage.setItem('poll_predictions', String(predictionsPoll));
      localStorage.setItem('poll_metrics', String(metricsPoll));
      localStorage.setItem('poll_logs', String(logsPoll));
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function handleClearCache() {
    if (typeof window !== 'undefined') {
      localStorage.clear();
      alert('Local dashboard settings cache cleared successfully.');
    }
  }

  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
          <Settings className="h-6 w-6 text-indigo-400" />
          Settings Config
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Configure real-time polling telemetry rules and debug cache behaviors.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Form parameters */}
        <form onSubmit={handleSave} className="md:col-span-2 space-y-6">
          
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
            <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="h-4 w-4 text-indigo-400" />
              Controlled Polling Frequency (seconds)
            </h2>
            
            <div className="space-y-4 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 border-b border-zinc-800">
                <div>
                  <span className="text-zinc-300 font-semibold block">Service Health Interval</span>
                  <span className="text-[10px] text-zinc-500">Suggested: 5 - 15 seconds</span>
                </div>
                <input
                  type="number"
                  min={2}
                  max={60}
                  value={healthPoll}
                  onChange={(e) => setHealthPoll(parseInt(e.target.value, 10))}
                  className="bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-lg w-24 text-center font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 border-b border-zinc-800">
                <div>
                  <span className="text-zinc-300 font-semibold block">Training Pipelines Status</span>
                  <span className="text-[10px] text-zinc-500">Suggested: 5 seconds</span>
                </div>
                <input
                  type="number"
                  min={2}
                  max={60}
                  value={trainingPoll}
                  onChange={(e) => setTrainingPoll(parseInt(e.target.value, 10))}
                  className="bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-lg w-24 text-center font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 border-b border-zinc-800">
                <div>
                  <span className="text-zinc-300 font-semibold block">Prediction Logs Status</span>
                  <span className="text-[10px] text-zinc-500">Suggested: 5 seconds</span>
                </div>
                <input
                  type="number"
                  min={2}
                  max={60}
                  value={predictionsPoll}
                  onChange={(e) => setPredictionsPoll(parseInt(e.target.value, 10))}
                  className="bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-lg w-24 text-center font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 border-b border-zinc-800">
                <div>
                  <span className="text-zinc-300 font-semibold block">Telemetry Metrics Aggregation</span>
                  <span className="text-[10px] text-zinc-500">Suggested: 5 - 15 seconds</span>
                </div>
                <input
                  type="number"
                  min={2}
                  max={60}
                  value={metricsPoll}
                  onChange={(e) => setMetricsPoll(parseInt(e.target.value, 10))}
                  className="bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-lg w-24 text-center font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2">
                <div>
                  <span className="text-zinc-300 font-semibold block">Aggregated Logs Feed</span>
                  <span className="text-[10px] text-zinc-500">Suggested: 3 - 5 seconds</span>
                </div>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={logsPoll}
                  onChange={(e) => setLogsPoll(parseInt(e.target.value, 10))}
                  className="bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-lg w-24 text-center font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-500 text-zinc-100 font-bold rounded-lg text-xs hover:bg-indigo-600 transition-colors shadow-sm"
            >
              Save Parameters
            </button>
            
            {saved && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> Config saved.
              </span>
            )}
          </div>

        </form>

        {/* Right Column: Information card */}
        <div className="md:col-span-1 space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
            <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
              <Info className="h-4 w-4 text-zinc-400" />
              Platform Specs
            </h2>
            <div className="space-y-3 text-[10px] font-mono text-zinc-500">
              <div>Gateway Port: <span className="text-zinc-300">8000</span></div>
              <div>Prometheus Port: <span className="text-zinc-300">9090</span></div>
              <div>Grafana Port: <span className="text-zinc-300">3000</span></div>
              <div>Nginx Proxy Port: <span className="text-zinc-300">80</span></div>
              <div>Auth Type: <span className="text-zinc-300">Bearer JWT</span></div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
            <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
              <Shield className="h-4 w-4 text-zinc-400" />
              Maintenance Options
            </h2>
            <button
              onClick={handleClearCache}
              className="w-full py-2 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              Clear Local Cache
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
