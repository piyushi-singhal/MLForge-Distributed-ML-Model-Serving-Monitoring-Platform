export default function LogsPage() {
  return (
    <div className="p-8 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Aggregated Logs</h1>
        <p className="text-sm text-zinc-400">Observe real-time system log outputs and errors from services.</p>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center text-zinc-500">
        Aggregated logs stream will be rendered here.
      </div>
    </div>
  );
}
