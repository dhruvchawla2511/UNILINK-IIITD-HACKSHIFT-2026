import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { apiPost } from '@/lib/supabase';
import { refreshBadges, type Badge } from '@/lib/badges';
import { BadgePill } from '@/components/UserBadges';

type Row = Badge & { has: boolean; can_change: boolean };

/** Toggle the badges one person holds. Only shows badges the signed-in person may change (the server decides). */
export default function BadgeAwardPanel({ userId, hideWhenNone = false }: { userId: string; hideWhenNone?: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await apiPost<{ badges: Row[] }>('/api/badges/manage', { user_id: userId });
    setRows(data?.badges ?? []);
  }, [userId]);
  useEffect(() => { void load(); }, [load]);

  const toggle = async (b: Row) => {
    setBusy(b.id);
    setError(null);
    const { error: err } = await apiPost('/api/badges/set', { user_id: userId, badge_id: b.id, on: !b.has });
    setBusy(null);
    if (err) return setError(err.message);
    await Promise.all([load(), refreshBadges()]);
  };

  if (!rows) return <div className="py-3 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>;
  const changeable = rows.filter((b) => b.can_change);
  if (!changeable.length) return hideWhenNone ? null : <p className="text-xs text-slate-400">No badges you can award to this person.</p>;

  return (
    <div>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Badges</p>
      <div className="flex flex-wrap gap-1.5">
        {changeable.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => toggle(b)}
            disabled={busy === b.id}
            aria-pressed={b.has}
            title={b.has ? `Remove ${b.label}` : `Award ${b.label}`}
            className={`inline-flex items-center gap-1 rounded-full border px-1 py-0.5 transition-opacity disabled:opacity-50 ${b.has ? 'border-brand-400 dark:border-brand-500' : 'border-dashed border-slate-300 dark:border-slate-600 opacity-60 hover:opacity-100'}`}
          >
            {busy === b.id ? <Loader2 className="w-3 h-3 animate-spin ml-1" /> : b.has ? <Check className="w-3 h-3 ml-1 text-brand-600" /> : null}
            <BadgePill badge={b} />
          </button>
        ))}
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
