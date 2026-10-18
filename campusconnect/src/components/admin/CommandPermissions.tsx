import { useCallback, useEffect, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { apiPost, type CommandPermission, type PermissionLevel } from '@/lib/supabase';

interface Data {
  levels: PermissionLevel[];
  commands: CommandPermission[];
}

/** Super admin: choose the minimum rank for each chat command (the server enforces it, see server/commands.js). */
export default function CommandPermissions() {
  const [data, setData] = useState<Data | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: d, error: e } = await apiPost<Data>('/api/admin/commands', {});
    if (e) setError(e.message);
    else setData(d);
  }, []);
  useEffect(() => { load(); }, [load]);

  const change = async (name: string, min: number | null) => {
    setSaving(name);
    setError(null);
    const { data: d, error: e } = await apiPost<Data>('/api/admin/commands/set', { command: name, min_power: min });
    setSaving(null);
    if (e) return setError(e.message);
    if (d) setData(d);
  };

  if (!data) {
    return error ? (
      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
    ) : (
      <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
    );
  }

  const label = (v: number) => data.levels.find((l) => l.value === v)?.label ?? String(v);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading font-semibold text-lg text-slate-900 dark:text-slate-100">Chat commands</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Choose the lowest rank that may use each command. Ranks only count inside the person&apos;s own college (and for the owner of a private room); website admins can always moderate every room. People can still only act on someone ranked below them, and the change applies straight away.
        </p>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2">{error}</p>}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800">
        {data.commands.map((c) => {
          const changed = c.min !== c.default_min;
          return (
            <div key={c.name} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 min-w-0">
                <code className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100 break-words">{c.usage}</code>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{c.summary}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {c.fixed ? (
                  <span className="text-xs text-slate-400">Always everyone</span>
                ) : (
                  <>
                    <select
                      value={c.min}
                      disabled={saving === c.name}
                      onChange={(e) => change(c.name, Number(e.target.value))}
                      aria-label={`Minimum rank for /${c.name}`}
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    >
                      {data.levels.filter((l) => l.value >= c.floor).map((l) => (
                        <option key={l.value} value={l.value}>{l.label}{l.value === c.default_min ? ' (default)' : ''}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => change(c.name, null)}
                      disabled={!changed || saving === c.name}
                      title={`Back to the default: ${label(c.default_min)}`}
                      aria-label={`Reset /${c.name} to its default`}
                      className="p-2 text-slate-400 hover:text-brand-600 disabled:opacity-30 disabled:hover:text-slate-400"
                    >
                      {saving === c.name ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-400">Commands that act on people (/mute, /kick, /ban, /warn and their undo commands) need at least room creator, because nobody can act on someone of the same rank. /help is always open to everyone.</p>
    </div>
  );
}
