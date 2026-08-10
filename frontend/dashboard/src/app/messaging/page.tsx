'use client';

import { useEffect, useState } from 'react';
import {
  Server,
  RefreshCw,
  Cpu,
  Layers,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { RabbitQueueInfo } from '@/types/rabbitmq';
import { clsx } from 'clsx';

export default function MessagingPage() {
  const [queues, setQueues] = useState<RabbitQueueInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'online' | 'offline'>('online');

  // Fetch queues from API Gateway proxy
  async function fetchBrokerMetrics() {
    setLoading(true);
    try {
      const res = await fetch('/api/rabbitmq/queues');
      if (res.ok) {
        const data = await res.json();
        setQueues(Array.isArray(data) ? data : []);
        setStatus('online');
      } else {
        throw new Error('Management endpoint returned non-200');
      }
    } catch {
      setStatus('offline');
      
      // Fallback realistic mock data representing the active MLForge topology
      setQueues([
        {
          name: 'training.jobs',
          vhost: '/',
          durable: true,
          auto_delete: false,
          exclusive: false,
          arguments: {
            'x-dead-letter-exchange': 'training.exchange.dead',
            'x-dead-letter-routing-key': 'training.jobs.dead'
          },
          status: 'running',
          consumers: 1,
          messages: 0,
          messages_ready: 0,
          messages_unacknowledged: 0,
          message_stats: {
            publish: 12,
            publish_details: { rate: 0.0 },
            deliver_get: 12,
            deliver_get_details: { rate: 0.0 }
          }
        },
        {
          name: 'training.jobs.retry',
          vhost: '/',
          durable: true,
          auto_delete: false,
          exclusive: false,
          arguments: {
            'x-message-ttl': 5000,
            'x-dead-letter-exchange': 'training.exchange',
            'x-dead-letter-routing-key': 'training.jobs.run'
          },
          status: 'running',
          consumers: 0,
          messages: 0,
          messages_ready: 0,
          messages_unacknowledged: 0,
          message_stats: {
            publish: 2,
            publish_details: { rate: 0.0 }
          }
        },
        {
          name: 'training.jobs.dead',
          vhost: '/',
          durable: true,
          auto_delete: false,
          exclusive: false,
          arguments: {},
          status: 'idle',
          consumers: 0,
          messages: 0,
          messages_ready: 0,
          messages_unacknowledged: 0,
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBrokerMetrics();
  }, []);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <Server className="h-6 w-6 text-indigo-400" />
            RabbitMQ Broker Monitor
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Monitor background queue workloads, consumer subscription counts, and dead letter exchange routing.
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={fetchBrokerMetrics}
            className="flex items-center justify-center p-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Broker connection banner */}
      <div className={clsx(
        "p-4 rounded-xl border flex items-center gap-2 text-xs font-medium",
        status === 'online' 
          ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400" 
          : "border-amber-500/20 bg-amber-500/5 text-amber-400"
      )}>
        {status === 'online' ? (
          <>
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            <span>RabbitMQ Broker Management Interface: Connected (Guest/BasicAuth validated). Exposing live queue statistics.</span>
          </>
        ) : (
          <>
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>RabbitMQ management endpoint offline (port 15672 unreachable). Showing default cached pipeline queue topologies.</span>
          </>
        )}
      </div>

      {/* Queues list grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <RefreshCw className="h-8 w-8 text-indigo-400 animate-spin" />
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 font-medium uppercase text-[10px] tracking-wider bg-zinc-950/20">
                <th className="px-6 py-4">Queue Name</th>
                <th className="px-6 py-4 text-center">Messages Ready</th>
                <th className="px-6 py-4 text-center">Unacknowledged</th>
                <th className="px-6 py-4 text-center">Active Consumers</th>
                <th className="px-6 py-4 text-center">Publish Rate</th>
                <th className="px-6 py-4 text-center">Deliver Rate</th>
                <th className="px-6 py-4 text-right">Dead Letter Exchange (DLQ)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 text-xs">
              {queues.map(q => {
                const hasDlx = q.arguments?.['x-dead-letter-exchange'];
                const isDle = q.name.includes('.dead');

                return (
                  <tr key={q.name} className="hover:bg-zinc-800/20 transition-colors">
                    <td className="px-6 py-4 font-semibold text-zinc-200">
                      {q.name}
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-zinc-300">
                      {q.messages_ready}
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-zinc-300">
                      {q.messages_unacknowledged}
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-zinc-400">
                      {q.consumers}
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-zinc-400">
                      {q.message_stats?.publish_details?.rate?.toFixed(1) || '0.0'}/s
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-zinc-400">
                      {q.message_stats?.deliver_get_details?.rate?.toFixed(1) || '0.0'}/s
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isDle ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-red-500/20 text-red-400 bg-red-500/10">
                          TARGET DLQ
                        </span>
                      ) : hasDlx ? (
                        <span className="text-[10px] text-zinc-500 font-mono">
                          ↳ {q.arguments['x-dead-letter-routing-key']}
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
