import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { apiPost } from '@/lib/supabase';
import { BADGE_COLORS, BADGE_ICONS, refreshBadges, type Badge } from '@/lib/badges';
import { BADGE_STYLES, BadgePill } from '@/components/UserBadges';
import BadgeAwardPanel from '@/components/BadgeAwardPanel';

type Person = { id: string; full_name: string; college_name: string | null };
const blank = { id: '', label: '', color: 'blue', icon: 'badge-check', description: '', officers_can_award: false };
const field = 'w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30';

/** Admin tab: create and edit badges, and award them to people. */
export default function BadgesManager() {
  const [badges, setBadges] = useState<Badge[] | null>(null);
  const [form, setForm] = useState<typeof blank | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [picked, setPicked] = useState<Person | null>(null);

  const load = useCallback(async () => {
    const { data } = await apiPost<Badge[]>('/api/badges/list', {});
    setBadges(data ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (q.trim().length < 2) { setPeople([]); return; }
    const t = setTimeout(async () => {
      const { data } = await apiPost<Person[]>('/api/badges/people', { q });
      setPeople(data ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    const { error: err } = await apiPost('/api/badges/save', { ...form, id: form.id || undefined });
    setSaving(false);
    if (err) return setError(err.message);
    setForm(null);
    await Promise.all([load(), refreshBadges()]);
  };

  const remove = async (b: Badge) => {
    if (!window.confirm(`Delete the "${b.label}" badge? It is removed from everyone who holds it.`)) return;
    const { error: err } = await apiPost('/api/badges/delete', { id: b.id });
    if (err) return setError(err.message);
    await Promise.all([load(), refreshBadges()]);
  };

  if (!badges) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading font-semibold text-lg text-slate-900 dark:text-slate-100">Profile badges</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Badges show next to a person&apos;s name in chat, posts, comments and member lists. Admins can award any badge. Badges marked &quot;officers can award&quot; can also be given by college secretaries, vice presidents and presidents to verified members of their own college.
        </p>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2">{error}</p>}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800">
        {badges.map((b) => (
          <div key={b.id} className="p-4 flex items-center gap-3">
            <BadgePill badge={b} />
            <p className="flex-1 min-w-0 text-xs text-slate-500 dark:text-slate-400 truncate">
              {b.description || 'No description'}{b.officers_can_award ? ' · officers can award' : ' · admins only'}
            </p>
            <button onClick={() => setForm({ ...b, description: b.description ?? '' })} title="Edit" className="p-1.5 text-slate-400 hover:text-brand-600 rounded-xl"><Pencil className="w-4 h-4" /></button>
            <button onClick={() => remove(b)} title="Delete" className="p-1.5 text-slate-400 hover:text-red-500 rounded-xl"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {badges.length === 0 && <p className="p-4 text-sm text-slate-400">No badges yet.</p>}
        <div className="p-3">
          <button onClick={() => setForm(blank)} className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl">
            <Plus className="w-4 h-4" /> New badge
          </button>
        </div>
      </div>

      {form && (
        <form onSubmit={save} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">{form.id ? 'Edit badge' : 'New badge'}</h3>
            <button type="button" onClick={() => setForm(null)} aria-label="Close" className="text-slate-400"><X className="w-4 h-4" /></button>
          </div>
          <input className={field} value={form.label} maxLength={24} required placeholder="Badge name (e.g. Club Lead)" onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <input className={field} value={form.description} maxLength={140} placeholder="What it means (shown on hover)" onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Colour">
            {BADGE_COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={form.color === c} onClick={() => setForm({ ...form, color: c })}
                className={`px-2 py-1 rounded-full text-[11px] font-semibold capitalize ${BADGE_STYLES[c]} ${form.color === c ? 'ring-2 ring-brand-500' : ''}`}>{c}</button>
            ))}
          </div>
          <select className={field} value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} aria-label="Icon">
            {BADGE_ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={form.officers_can_award} onChange={(e) => setForm({ ...form, officers_can_award: e.target.checked })} />
            College officers can award this badge (own college only)
          </label>
          <div className="flex items-center gap-3">
            <button disabled={saving} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl">{saving ? 'Saving…' : 'Save'}</button>
            <span className="text-xs text-slate-400">Preview:</span>
            <BadgePill badge={{ label: form.label || 'Badge', color: form.color, icon: form.icon, description: form.description }} />
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Award badges</h3>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className={`${field} pl-9`} value={q} onChange={(e) => { setQ(e.target.value); setPicked(null); }} placeholder="Search a person by name…" />
        </div>
        {!picked && people.map((p) => (
          <button key={p.id} onClick={() => setPicked(p)} className="block w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
            {p.full_name}{p.college_name && <span className="text-xs text-slate-400"> · {p.college_name}</span>}
          </button>
        ))}
        {picked && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{picked.full_name}</p>
            <BadgeAwardPanel userId={picked.id} />
          </div>
        )}
      </div>
    </div>
  );
}
