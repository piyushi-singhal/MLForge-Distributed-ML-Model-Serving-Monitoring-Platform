'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BrainCircuit,
  Zap,
  Activity,
  Settings,
  Server,
} from 'lucide-react';
import { clsx } from 'clsx';

const NAV = [
  { href: '/',            label: 'Overview',        icon: LayoutDashboard },
  { href: '/training',    label: 'Training Jobs',   icon: BrainCircuit },
  { href: '/predictions', label: 'Predictions',     icon: Zap },
  { href: '/metrics',     label: 'Metrics',         icon: Activity },
  { href: '/services',    label: 'Services',        icon: Server },
  { href: '/settings',    label: 'Settings',        icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className={clsx(
        'fixed inset-y-0 left-0 z-20 flex w-60 flex-col',
        'border-r border-zinc-800 bg-zinc-900/80 backdrop-blur-sm',
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-zinc-800 px-5">
        <span className="text-lg font-bold tracking-tight text-indigo-400">⬡ MLForge</span>
        <span className="ml-auto rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-indigo-300">
          ops
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          Navigation
        </p>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-800 px-5 py-4">
        <p className="text-[11px] text-zinc-600">MLForge Dashboard v1.0</p>
      </div>
    </aside>
  );
}
