import { useCallback, useEffect, useRef, useState } from 'react';
import { Ban, Loader2, Search, ShieldAlert, AlertTriangle, VolumeX, DoorOpen } from 'lucide-react';
import { apiPost, type College, type ModLogEntry, type Profile } from '@/lib/supabase';
import { COLLEGE_RANK, officerLevel } from '@/lib/collegeRoles';
import { formatWhen } from '@/components/chat/CommandHelp';

interface LogPage {
  scope: 'all' | 'college';
  entries: ModLogEntry[];
  next_cursor: string | null;
}

const ACTION = {
  ban: { label: 'Ban', icon: Ban, tone: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30' },
  mute: { label: 'Mute', icon: VolumeX, tone: 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30' },
  kick: { label: 'Kick', icon: DoorOpen, tone: 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/30' },
  warn: { label: 'Warning', icon: AlertTriangle, tone: 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-500/30' },
} as const;

function stateText(e: ModLogEntry): string {
  switch (e.state) {
    case 'permanent': return 'In force, permanent';
    case 'active': return `In force until ${formatWhen(e.expires_at!)}`;
    case 'expired': return e.action === 'kick' && e.room_type === 'private' ? 'Removed from the room' : `Ended ${formatWhen(e.expires_at!)}`;
    case 'lifted': return `Lifted by ${e.lifted_by ?? 'someone'} on ${formatWhen(e.lifted_at!)}`;
    case 'counted': return 'Counts towards an automatic mute';
    case 'used': return 'Led to an automatic mute';
  }
}

const field =
  'px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30';

/**
 * Read-only history of bans, mutes, kicks and warnings. The server decides what the viewer may see:
 * website admins get every room (and a college filter), presidents and vice presidents only their own college.
 */
export default function ModerationLog({ colleges, title = 'Moderation log' }: { colleges?: College[]; title?: string }) {
  const [entries, setEntries] = useState<ModLogEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [scope, setScope] = useState<'all' | 'college'>('college');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState('');
  const [state, setState] = useState('');
  const [collegeId, setCollegeId] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState(''); // the search box, once the person stops typing
  const latest = useRef(0);

  useEffect(() => {
    const id = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const fetchPage = useCallback(
    async (after: string | null) => {
      const ticket = ++latest.current;
      const { data, error: e } = await apiPost<LogPage>('/api/moderation/log', { action, state, q, college_id: collegeId, cursor: after });
      if (ticket !== latest.current) return; // a newer search has started
      if (e || !data) return setError(e?.message ?? 'Could not load the log');
      setError(null);
      setScope(data.scope);
      setCursor(data.next_cursor);
      setEntries((prev) => (after ? [...prev, ...data.entries] : data.entries));
    },
    [action, state, q, collegeId]
  );

  useEffect(() => {
    setLoading(true);
    fetchPage(null).finally(() => setLoading(false));
  }, [fetchPage]);

  const more = async () => {
    setLoadingMore(true);
    await fetchPage(cursor);
    setLoadingMore(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading font-semibold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-brand-500" /> {title}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {scope === 'all'
            ? 'Every ban, mute, kick and warning in every room, newest first. This is a read-only record.'
            : "Every ban, mute, kick and warning in your college's rooms, newest first. This is a read-only record."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[12rem]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search person, moderator, room or reason"
            aria-label="Search the moderation log"
            className={`${field} w-full pl-9`}
          />
        </div>
        <select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action" className={field}>
          <option value="">All actions</option>
          <option value="ban">Bans</option>
          <option value="mute">Mutes</option>
          <option value="kick">Kicks</option>
          <option value="warn">Warnings</option>
        </select>
        <select value={state} onChange={(e) => setState(e.target.value)} aria-label="Filter by status" className={field}>
          <option value="">Any status</option>
          <option value="active">Still in force</option>
        </select>
        {colleges && colleges.length > 0 && scope === 'all' && (
          <select value={collegeId} onChange={(e) => setCollegeId(e.target.value)} aria-label="Filter by college" className={`${field} max-w-[14rem]`}>
            <option value="">All colleges</option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : entries.length === 0 ? (
        <p className="text-center py-12 text-sm text-slate-400">{action || state || q || collegeId ? 'Nothing matches those filters.' : 'No moderation actions have been recorded yet.'}</p>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800">
          {entries.map((e) => {
            const a = ACTION[e.action];
            const Icon = a.icon;
            return (
              <div key={e.id} className="p-4 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                <span className={`inline-flex items-center gap-1.5 self-start text-xs font-medium border rounded-full px-2.5 py-1 shrink-0 ${a.tone}`}>
                  <Icon className="w-3.5 h-3.5" /> {a.label}
                </span>
                <div className="flex-1 min-w-0 text-sm">
                  <p className="text-slate-900 dark:text-slate-100">
                    <span className="font-medium">{e.target_name}</span>
                    <span className="text-slate-500 dark:text-slate-400"> in </span>
                    <span className="font-medium">{e.room_name}</span>
                    {e.college_name && <span className="text-slate-400"> · {e.college_name}</span>}
                    {e.room_type !== 'college' && <span className="text-slate-400"> · {e.room_type} room</span>}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    by {e.issuer_name} · {formatWhen(e.created_at)}
                  </p>
                  {e.reason && <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 break-words">Reason: {e.reason}</p>}
                  <p className="text-xs text-slate-400 mt-1">{stateText(e)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cursor && !loading && (
        <div className="flex justify-center">
          <button
            onClick={more}
            disabled={loadingMore}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 hover:bg-brand-100 dark:hover:bg-brand-500/20 rounded-full transition-colors disabled:opacity-60"
          >
            {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Load more
          </button>
        </div>
      )}
    </div>
  );
}

/** The smaller version for a college's president and vice president (Profile page). Renders nothing for anyone else. */
export function CollegeModerationLog({ viewer }: { viewer: Profile }) {
  if (officerLevel(viewer) < COLLEGE_RANK.vice_president) return null;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
      <ModerationLog title="College moderation log" />
    </div>
  );
}
