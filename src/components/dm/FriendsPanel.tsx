import { useCallback, useEffect, useState } from 'react';
import { apiPost } from '@/lib/supabase';
import type { DmPerson } from '@/lib/directMessages';
import { Avatar } from './PersonBits';
import { Check, UserPlus, Users, X } from 'lucide-react';

type Lists = { friends: DmPerson[]; incoming: DmPerson[]; outgoing: DmPerson[] };
export function FriendsPanel({ onMessage }: { onMessage: (id: string) => void }) {
  const [lists, setLists] = useState<Lists>({ friends: [], incoming: [], outgoing: [] });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DmPerson[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const load = useCallback(async () => { const r = await apiPost<Lists>('/api/chat/friends/list', {}); if (r.data) setLists(r.data); }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    const timer = window.setTimeout(async () => { const r = await apiPost<{people:DmPerson[]}>('/api/chat/dm/people', { q }); if (r.data) setResults(r.data.people.filter(p => !lists.friends.some(f => f.id === p.id) && !lists.outgoing.some(f => f.id === p.id))); }, 250);
    return () => window.clearTimeout(timer);
  }, [query, lists.friends, lists.outgoing]);
  const act = async (action: string, id: string) => {
    setBusy(id); setNote(''); const r = await apiPost(`/api/chat/friends/${action}`, { user_id: id });
    if (r.error) setNote(r.error.message); else { setNote(action === 'request' ? 'Friend request sent.' : action === 'accept' ? 'Friend request accepted.' : action === 'reject' ? 'Request declined.' : action === 'cancel' ? 'Outgoing request cancelled.' : 'Friend removed.'); await load(); }
    setBusy(null);
  };
  const personRow = (p: DmPerson, controls: React.ReactNode) => <div key={p.id} className="flex items-center gap-2 py-2"><Avatar person={p}/><span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700 dark:text-slate-200">{p.full_name}</span>{controls}</div>;
  const small = 'rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40';
  return <section className="border-b border-slate-200 dark:border-slate-800 px-3 py-3">
    <button onClick={() => setExpanded(v => !v)} className="flex w-full items-center justify-between text-sm font-semibold text-slate-800 dark:text-slate-100"><span className="flex items-center gap-2"><Users className="h-4 w-4 text-brand-500"/> Friends & requests</span><span className="text-xs text-slate-400">{lists.friends.length} friends · {lists.incoming.length} new</span></button>
    {expanded && <div className="mt-3 space-y-3">
      <div className="relative"><UserPlus className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find people to add" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs dark:border-slate-700 dark:bg-slate-950"/></div>
      {results.map(p=>personRow(p,<button className={small} title="Send friend request" disabled={busy===p.id} onClick={()=>void act('request',p.id)}><UserPlus className="h-4 w-4"/></button>))}
      {!!lists.incoming.length && <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Incoming requests</p>{lists.incoming.map(p=>personRow(p,<div className="flex gap-1"><button className={small} title="Accept" disabled={busy===p.id} onClick={()=>void act('accept',p.id)}><Check className="h-4 w-4 text-emerald-600"/></button><button className={small} title="Reject" disabled={busy===p.id} onClick={()=>void act('reject',p.id)}><X className="h-4 w-4 text-rose-500"/></button></div>))}</div>}
      {!!lists.outgoing.length && <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Sent requests</p>{lists.outgoing.map(p=>personRow(p,<div className="flex items-center gap-1"><span className="text-[10px] text-slate-400">Pending</span><button className={small} title="Cancel request" disabled={busy===p.id} onClick={()=>void act('cancel',p.id)}><X className="h-3.5 w-3.5"/></button></div>))}</div>}
      {!!lists.friends.length && <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Your friends</p>{lists.friends.map(p=>personRow(p,<div className="flex gap-1"><button className="rounded-lg bg-brand-600 px-2 py-1.5 text-[11px] font-medium text-white" onClick={()=>onMessage(p.id)}>Message</button><button className={small} title="Remove friend" disabled={busy===p.id} onClick={()=>{if(window.confirm(`Remove ${p.full_name} from your friends?`)) void act('remove',p.id)}}><X className="h-3.5 w-3.5 text-rose-500"/></button></div>))}</div>}
      {note && <p className="text-xs text-slate-500" role="status">{note}</p>}
      {!lists.friends.length && !lists.incoming.length && !lists.outgoing.length && !results.length && <p className="text-xs text-slate-400">Search for people, send requests, and accept or reject incoming requests here.</p>}
    </div>}
  </section>;
}
