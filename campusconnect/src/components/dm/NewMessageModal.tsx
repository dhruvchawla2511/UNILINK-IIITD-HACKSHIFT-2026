import { useEffect, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { dmApi, type DmPerson } from '@/lib/directMessages';
import { Avatar, PersonLine } from '@/components/dm/PersonBits';

/** Find a person by name (or pick an admin) and start a conversation with them. */
export function NewMessageModal({ onPick, onClose }: { onPick: (userId: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [people, setPeople] = useState<DmPerson[]>([]);
  const [suggested, setSuggested] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    const t = window.setTimeout(async () => {
      const { data } = await dmApi.people(q);
      if (!live) return;
      setLoading(false);
      if (data) {
        setPeople(data.people);
        setSuggested(data.suggested);
      }
    }, q.trim().length >= 2 ? 250 : 0);
    return () => { live = false; window.clearTimeout(t); };
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const searching = q.trim().length >= 2;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <h3 className="font-heading font-semibold text-slate-900 dark:text-slate-100">New message</h3>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search people by name"
              maxLength={60}
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-3 min-h-[8rem]">
          {!searching && people.length > 0 && <p className="px-2 pb-1 text-[11px] font-medium text-slate-400">{suggested ? 'Administrators' : 'People'}</p>}
          {loading ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-brand-500" /></div>
          ) : people.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">{searching ? 'No one found with that name' : 'Type at least 2 letters to search'}</p>
          ) : (
            people.map((p) => (
              <button key={p.id} onClick={() => onPick(p.id)} className="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <Avatar person={p} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{p.full_name}</p>
                  <PersonLine person={p} />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
