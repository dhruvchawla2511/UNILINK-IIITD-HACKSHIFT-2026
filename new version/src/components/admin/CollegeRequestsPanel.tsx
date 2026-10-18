import { useState } from 'react';
import { CheckCircle2, Clock, Loader2, MapPin, XCircle, GraduationCap } from 'lucide-react';
import { apiPost, type CollegeRequest } from '@/lib/supabase';
import { placeLine } from '@/components/TierBadge';

const input =
  'w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30';

/** "My college is not listed" requests. Approving adds the college; the admin can correct the details first. */
export default function CollegeRequestsPanel({ requests, onChanged }: { requests: CollegeRequest[]; onChanged: () => void }) {
  const pending = requests.filter((r) => r.status === 'pending');
  const done = requests.filter((r) => r.status !== 'pending');

  if (requests.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">No college requests yet. Students can ask for a missing college from the Colleges page or the new-user guide.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pending.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">Nothing waiting. All requests have been answered.</p>
      ) : (
        <div className="space-y-3">{pending.map((r) => <PendingRequest key={r.id} request={r} onChanged={onChanged} />)}</div>
      )}

      {done.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Answered</h3>
          <div className="space-y-1.5">
            {done.slice(0, 20).map((r) => (
              <div key={r.id} className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
                <span className="flex-1 min-w-0 truncate text-sm text-slate-700 dark:text-slate-300">{r.name}</span>
                <span className="text-xs text-slate-400 truncate hidden sm:block">{r.requester?.full_name}</span>
                {r.status === 'approved'
                  ? <span className="flex items-center gap-1 text-xs text-accent-600 dark:text-accent-400 font-medium shrink-0"><CheckCircle2 className="w-3.5 h-3.5" /> Added</span>
                  : <span className="flex items-center gap-1 text-xs text-red-500 font-medium shrink-0"><XCircle className="w-3.5 h-3.5" /> Rejected</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PendingRequest({ request: r, onChanged }: { request: CollegeRequest; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: r.name, domain: r.domain ?? '', city: r.city ?? '', state: r.state ?? '', country: r.country ?? '', tier: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const resolve = async (status: 'approved' | 'rejected') => {
    setBusy(true);
    setError(null);
    const { error } = await apiPost('/api/colleges/requests/resolve', { id: r.id, status, ...(status === 'approved' ? form : {}) });
    setBusy(false);
    if (error) return setError(error.message);
    onChanged();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 animate-fade-in">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{r.name}</p>
          {placeLine(r) && <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {placeLine(r)}</p>}
          {r.domain && <p className="text-xs text-slate-400 mt-0.5">{r.domain}</p>}
          {r.note && <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 bg-slate-50 dark:bg-slate-950 rounded-xl px-2.5 py-1.5">{r.note}</p>}
          <p className="text-xs text-slate-400 mt-1.5">
            Asked by {r.requester?.full_name ?? 'someone'}{r.requester?.email ? ` (${r.requester.email})` : ''} on {new Date(r.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-2">
          <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium"><Clock className="w-3.5 h-3.5" /> Pending</span>
          {!editing && (
            <div className="flex gap-2">
              <button onClick={() => setEditing(true)} disabled={busy}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-accent-50 dark:bg-accent-500/10 hover:bg-accent-100 dark:hover:bg-accent-500/20 text-accent-700 dark:text-accent-300 text-xs font-medium rounded-xl transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5" /> Review
              </button>
              <button onClick={() => window.confirm(`Reject the request for ${r.name}?`) && resolve('rejected')} disabled={busy}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium rounded-xl transition-colors">
                <XCircle className="w-3.5 h-3.5" /> Reject
              </button>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">Check the details, then add the college. You can edit it later in the Colleges tab (logo included).</p>
          <input className={input} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="College name" />
          <div className="flex gap-2">
            <input className={`${input} flex-1 min-w-0`} value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="City" />
            <input className={`${input} flex-1 min-w-0`} value={form.state} onChange={(e) => set('state', e.target.value)} placeholder="State / region" />
          </div>
          <div className="flex gap-2">
            <input className={`${input} flex-1 min-w-0`} value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="Country" />
            <input className={`${input} flex-1 min-w-0`} value={form.domain} onChange={(e) => set('domain', e.target.value)} placeholder="Website domain" />
            <select className={`${input} flex-1 min-w-0`} value={form.tier} onChange={(e) => set('tier', e.target.value)}>
              <option value="">No tier</option>
              <option value="Tier 1">Tier 1</option>
              <option value="Tier 2">Tier 2</option>
              <option value="Elite">Elite</option>
            </select>
          </div>
          {error && <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2">{error}</div>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditing(false)} disabled={busy} className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Cancel</button>
            <button onClick={() => resolve('approved')} disabled={busy || !form.name.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-medium rounded-xl transition-colors">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Add college
            </button>
          </div>
        </div>
      )}
      {!editing && error && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p>}
    </div>
  );
}
