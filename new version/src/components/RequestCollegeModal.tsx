import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, Loader2, Send, X, XCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type CollegeRequest } from '@/lib/supabase';

const input =
  'w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30';

/**
 * "My college is not listed": any signed-in person can ask for a college to be added.
 * An admin reviews it (Admin Panel > College requests). The person sees the answer in the list below the form.
 */
export default function RequestCollegeModal({ initialName = '', onClose }: { initialName?: string; onClose: () => void }) {
  const { profile } = useAuth();
  const [name, setName] = useState(initialName);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [domain, setDomain] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [mine, setMine] = useState<CollegeRequest[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from('college_requests').select('*').order('created_at', { ascending: false });
    if (data) setMine(data as CollegeRequest[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.from('college_requests').insert({
      name, city: city || null, state: state || null, country: country || null, domain: domain || null, note: note || null, requested_by: profile.id,
    });
    setLoading(false);
    if (error) return setError(error.message);
    setSent(name.trim());
    setName(''); setCity(''); setState(''); setCountry(''); setDomain(''); setNote('');
    load();
  };

  const withdraw = async (id: string) => {
    await supabase.from('college_requests').delete().eq('id', id);
    load();
  };

  const pending = mine.filter((r) => r.status === 'pending').length;

  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6 animate-slide-up max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-heading font-semibold text-lg text-slate-900 dark:text-slate-100">Request your college</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Can't find it in the directory? Tell us about it and an admin will add it. Search first, so you don't ask for one that is already there.</p>

        {sent && (
          <div className="mb-3 flex items-start gap-2 text-sm text-accent-700 dark:text-accent-300 bg-accent-50 dark:bg-accent-500/10 border border-accent-200 dark:border-accent-500/30 rounded-xl px-3 py-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Request for <strong>{sent}</strong> sent. Once an admin adds it, you can choose it on your profile.</span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <input required type="text" placeholder="College name" value={name} onChange={(e) => setName(e.target.value)} className={input} maxLength={120} />
          <div className="flex gap-2">
            <input type="text" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} className={`${input} flex-1 min-w-0`} />
            <input type="text" placeholder="State / region" value={state} onChange={(e) => setState(e.target.value)} className={`${input} flex-1 min-w-0`} />
          </div>
          <div className="flex gap-2">
            <input type="text" placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} className={`${input} flex-1 min-w-0`} />
            <input type="text" placeholder="Website (e.g. mit.edu)" value={domain} onChange={(e) => setDomain(e.target.value)} className={`${input} flex-1 min-w-0`} />
          </div>
          <textarea placeholder="Anything that helps us find it (optional)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} className={`${input} resize-none`} />
          {error && <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2">{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Send request</>}
          </button>
        </form>

        {mine.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Your requests{pending ? ` (${pending} waiting)` : ''}</h4>
            <div className="space-y-1.5">
              {mine.slice(0, 8).map((r) => (
                <div key={r.id} className="flex items-center gap-2 text-sm bg-slate-50 dark:bg-slate-950 rounded-xl px-3 py-2">
                  <span className="flex-1 min-w-0 truncate text-slate-800 dark:text-slate-200">{r.name}</span>
                  {r.status === 'pending' && (
                    <>
                      <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium shrink-0"><Clock className="w-3.5 h-3.5" /> Waiting</span>
                      <button onClick={() => withdraw(r.id)} title="Withdraw this request" className="text-slate-400 hover:text-red-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                    </>
                  )}
                  {r.status === 'approved' && <span className="flex items-center gap-1 text-xs text-accent-600 dark:text-accent-400 font-medium shrink-0"><CheckCircle2 className="w-3.5 h-3.5" /> Added</span>}
                  {r.status === 'rejected' && <span className="flex items-center gap-1 text-xs text-red-500 font-medium shrink-0"><XCircle className="w-3.5 h-3.5" /> Not added</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
