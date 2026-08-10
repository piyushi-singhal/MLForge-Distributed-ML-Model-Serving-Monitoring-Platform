'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BrainCircuit,
  Zap,
  Activity,
  Settings,
  Server,
  Cpu,
  Layers,
  AlertTriangle,
  Terminal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { clsx } from 'clsx';

const NAV = [
  { href: '/',            label: 'Overview',        icon: LayoutDashboard },
  { href: '/models',       label: 'Models Registry', icon: BrainCircuit },
  { href: '/training',     label: 'Training Runs',   icon: Cpu },
  { href: '/predictions',  label: 'Predictions',     icon: Zap },
  { href: '/metrics',      label: 'Metrics Info',    icon: Activity },
  { href: '/services',     label: 'Services Status',  icon: Server },
  { href: '/messaging',    label: 'Messaging Queue', icon: Layers },
  { href: '/failures',     label: 'Failure Timeline',icon: AlertTriangle },
  { href: '/logs',         label: 'System Logs',     icon: Terminal },
  { href: '/settings',     label: 'Settings Ops',    icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={clsx(
        'h-screen flex flex-col transition-all duration-300 flex-shrink-0',
        'border-r border-zinc-800 bg-zinc-900/80 backdrop-blur-sm',
        collapsed ? 'w-20' : 'w-72'
      )}
    >
      {/* Logo */}
      <div className="flex h-20 items-center gap-3 border-b border-zinc-800 px-5">
        {!collapsed && (
          <>
            <span className="text-xl font-black tracking-tight text-indigo-400">⬡ MLForge</span>
            <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest text-indigo-300">
              ops
            </span>
          </>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={clsx(
            "p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors",
            collapsed ? "mx-auto" : "ml-auto"
          )}
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-6">
        {!collapsed && (
          <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-widest text-zinc-500">
            Navigation
          </p>
        )}
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={clsx(
                'flex items-center rounded-lg px-4 py-3 text-base font-semibold transition-colors gap-4',
                active
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
                collapsed && 'justify-center px-0'
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
              {!collapsed && active && (
                <span className="ml-auto h-2 w-2 rounded-full bg-indigo-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-800 p-5 text-center">
        <p className="text-xs text-zinc-600 font-mono">
          {collapsed ? 'v1' : 'MLForge Ops v1.0'}
        </p>
      </div>
    </aside>
  );
}
