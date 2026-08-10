export default function SettingsPage() {
  return (
    <div className="p-8 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
        <p className="text-sm text-zinc-400">Configure dashboard options and API connections.</p>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center text-zinc-500">
        Dashboard configuration options will be rendered here.
      </div>
    </div>
  );
}
