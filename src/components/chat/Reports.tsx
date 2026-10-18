import { useCallback, useEffect, useState } from 'react';
import { Ban, CheckCircle2, FileText, Flag, Loader2, ShieldAlert, Trash2, VolumeX, X } from 'lucide-react';
import { apiPost, fileUrl, supabase, type ReportItem, type ReportReason } from '@/lib/supabase';
import { formatWhen } from '@/components/chat/CommandHelp';

const REASONS: { value: ReportReason; label: string; hint: string }[] = [
  { value: 'spam', label: 'Spam', hint: 'Ads, scams, repeated junk' },
  { value: 'harassment', label: 'Harassment or bullying', hint: 'Targeting or threatening someone' },
  { value: 'hate', label: 'Hate or abuse', hint: 'Slurs, discrimination, abusive language' },
  { value: 'inappropriate', label: 'Inappropriate content', hint: 'Adult, violent or unsafe content' },
  { value: 'other', label: 'Something else', hint: 'Tell the moderators more below' },
];

const modalShell = 'fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in';

/** "Report message": pick a reason, optionally add details. The room's moderators get it in their queue. */
export function ReportMessageModal({ messageId, authorName, onClose }: { messageId: string; authorName: string; onClose: () => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!reason) return setError('Pick a reason first');
    setBusy(true);
    setError(null);
    const { error } = await apiPost('/api/chat/report', { message_id: messageId, reason, details });
    setBusy(false);
    if (error) return setError(error.message);
    setSent(true);
  };

  return (
    <div className={modalShell} onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-y-auto scrollbar-thin animate-slide-up" onClick={(e) => e.stopPropagation()}>
        {sent ? (
          <div className="p-6 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-accent-500" />
            <h3 className="font-heading font-semibold text-lg text-slate-900 dark:text-slate-100">Report sent</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Thanks. The moderators of this room will take a look. The person is not told who reported them.</p>
            <button onClick={onClose} className="mt-5 w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors">Done</button>
          </div>
        ) : (
          <div className="p-6">
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-heading font-semibold text-lg text-slate-900 dark:text-slate-100">Report message</h3>
              <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">A message from <span className="font-medium text-slate-700 dark:text-slate-300">{authorName}</span>. Why are you reporting it?</p>
            <div className="space-y-1.5">
              {REASONS.map((r) => (
                <label key={r.value} className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors ${reason === r.value ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                  <input type="radio" name="report-reason" checked={reason === r.value} onChange={() => setReason(r.value)} className="mt-1 accent-brand-600" />
                  <span>
                    <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">{r.label}</span>
                    <span className="block text-xs text-slate-400">{r.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, 300))}
              placeholder="Add details (optional)"
              rows={2}
              className="mt-3 w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none"
            />
            <p className="text-xs text-slate-400 mt-1">Moderators see your name with the report. Please only report real problems.</p>
            {error && <div className="mt-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2">{error}</div>}
            <div className="flex gap-2 mt-4">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancel</button>
              <button onClick={submit} disabled={busy || !reason} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />} Send report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- moderators' queue

const MUTE_TIMES = [{ v: 10, l: '10 min' }, { v: 60, l: '1 hour' }, { v: 1440, l: '1 day' }, { v: 10080, l: '7 days' }];
const BAN_TIMES: { v: number | 'perm'; l: string }[] = [{ v: 'perm', l: 'Permanent' }, { v: 1440, l: '1 day' }, { v: 10080, l: '7 days' }, { v: 43200, l: '30 days' }];
const ACTION_LABEL = { delete: 'Message deleted', mute: 'Muted', ban: 'Banned', dismiss: 'Dismissed' } as const;

function ReportCard({ item, onChanged }: { item: ReportItem; onChanged: () => void }) {
  const [muteMins, setMuteMins] = useState(10);
  const [banMins, setBanMins] = useState<number | 'perm'>('perm');
  const [alsoDelete, setAlsoDelete] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = item.status === 'open';
  const can = item.can;
  const canDeleteToo = !!item.message_id && !!can?.delete.allowed;

  const act = async (action: 'dismiss' | 'delete' | 'mute' | 'ban') => {
    setBusy(action);
    setError(null);
    const minutes = action === 'mute' ? muteMins : action === 'ban' ? banMins : undefined;
    const { error } = await apiPost('/api/chat/report/resolve', {
      report_id: item.report_ids[0],
      action,
      minutes,
      delete_message: (action === 'mute' || action === 'ban') && canDeleteToo && alsoDelete,
    });
    setBusy(null);
    if (error) return setError(error.message);
    onChanged();
  };

  const isImage = item.msg_type === 'image' && item.attachment_url;
  const btn = 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const select = 'text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-1.5 py-1.5 focus:outline-none';

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
        <span className="font-medium text-slate-600 dark:text-slate-300">{item.room_name}</span>
        {item.college_name && <span>· {item.college_name}</span>}
        {item.message_sent_at && <span>· sent {formatWhen(item.message_sent_at)}</span>}
        <span className="ml-auto px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-medium">
          {item.reports.length} {item.reports.length === 1 ? 'report' : 'reports'}
        </span>
      </div>

      <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border-l-4 border-red-300 dark:border-red-500/50 px-3 py-2.5">
        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
          {item.target_name}
          {open && can?.target_standing && (
            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-medium">
              already {can.target_standing}
            </span>
          )}
        </p>
        {isImage && <img src={fileUrl(item.attachment_url!)} alt={item.attachment_name ?? 'Reported image'} className="max-h-40 rounded-md mb-1.5" />}
        {!isImage && item.attachment_name && (
          <p className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300"><FileText className="w-4 h-4 shrink-0" /> {item.attachment_name}</p>
        )}
        {item.content && <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">{item.content}</p>}
        {!item.content && !item.attachment_name && <p className="text-sm italic text-slate-400">{item.msg_type === 'poll' ? 'A poll' : 'No text'}</p>}
        {!item.message_id && open && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">This message has already been deleted.</p>}
      </div>

      <ul className="space-y-1">
        {item.reports.map((r) => (
          <li key={r.id} className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-300">{r.reason_label}</span> · {r.reporter_name} · {formatWhen(r.created_at)}
            {r.details && <span className="block text-slate-500 dark:text-slate-400 italic">"{r.details}"</span>}
          </li>
        ))}
      </ul>

      {open && can ? (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => act('delete')} disabled={!!busy || !can.delete.allowed || !item.message_id} title={can.delete.why ?? 'Delete this message'} className={`${btn} bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20`}>
              {busy === 'delete' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
            </button>
            <span className="flex items-center gap-1">
              <select aria-label="Mute for" value={muteMins} onChange={(e) => setMuteMins(Number(e.target.value))} disabled={!!busy || !can.mute.allowed} className={select}>
                {MUTE_TIMES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
              <button onClick={() => act('mute')} disabled={!!busy || !can.mute.allowed} title={can.mute.why ?? `Mute ${item.target_name}`} className={`${btn} bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20`}>
                {busy === 'mute' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <VolumeX className="w-3.5 h-3.5" />} Mute
              </button>
            </span>
            <span className="flex items-center gap-1">
              <select aria-label="Ban for" value={String(banMins)} onChange={(e) => setBanMins(e.target.value === 'perm' ? 'perm' : Number(e.target.value))} disabled={!!busy || !can.ban.allowed} className={select}>
                {BAN_TIMES.map((t) => <option key={t.v} value={String(t.v)}>{t.l}</option>)}
              </select>
              <button onClick={() => act('ban')} disabled={!!busy || !can.ban.allowed} title={can.ban.why ?? `Ban ${item.target_name} from this room`} className={`${btn} bg-red-600 hover:bg-red-700 text-white`}>
                {busy === 'ban' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />} Ban
              </button>
            </span>
            <button onClick={() => act('dismiss')} disabled={!!busy} title="Nothing wrong here. Close the report" className={`${btn} ml-auto bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700`}>
              {busy === 'dismiss' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />} Dismiss
            </button>
          </div>
          {canDeleteToo && (
            <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
              <input type="checkbox" checked={alsoDelete} onChange={(e) => setAlsoDelete(e.target.checked)} className="accent-brand-600" />
              Also delete the message when muting or banning
            </label>
          )}
          {(!can.mute.allowed && can.mute.why) && <p className="text-xs text-slate-400">{can.mute.why}</p>}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-700 dark:text-slate-300">{item.action ? ACTION_LABEL[item.action] : 'Resolved'}</span>
          {item.action && item.action !== 'delete' && item.action !== 'dismiss' && item.message_deleted ? ' and message deleted' : ''}
          {item.resolved_by_name ? ` by ${item.resolved_by_name}` : ''}{item.resolved_at ? ` · ${formatWhen(item.resolved_at)}` : ''}
          {item.resolution_note ? ` · ${item.resolution_note}` : ''}
        </p>
      )}
    </div>
  );
}

/** The moderators' report queue. Open reports come with one-click Delete, Mute, Ban and Dismiss. */
export function ReportQueueModal({ onClose, onCount }: { onClose: () => void; onCount: (open: number) => void }) {
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [items, setItems] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await apiPost<{ items: ReportItem[] }>('/api/chat/reports', { status: tab });
    setLoading(false);
    if (error) return setError(error.message);
    setError(null);
    setItems(data?.items ?? []);
    if (tab === 'open') onCount(data?.items.length ?? 0);
  }, [tab, onCount]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // someone reported something, or another moderator handled a report: reload live
  useEffect(() => {
    const channel = supabase.channel('report-queue').on('postgres_changes', { event: '*', schema: 'public', table: 'message_reports' }, () => load()).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return (
    <div className={modalShell} onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[88vh] flex flex-col animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div>
            <h3 className="flex items-center gap-2 font-heading font-semibold text-lg text-slate-900 dark:text-slate-100"><ShieldAlert className="w-5 h-5 text-red-500" /> Reports</h3>
            <p className="text-xs text-slate-400">Messages people reported in rooms you moderate. Mutes and bans here also appear in the moderation log.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex gap-1 px-6 border-b border-slate-200 dark:border-slate-800">
          {(['open', 'resolved'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              {t === 'open' ? 'Open' : 'Handled'}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4 space-y-3">
          {loading ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-brand-500" /></div>
          ) : error ? (
            <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              {tab === 'open' ? 'No open reports. All clear.' : 'Nothing handled yet.'}
            </div>
          ) : (
            items.map((it) => <ReportCard key={it.key} item={it} onChanged={load} />)
          )}
        </div>
      </div>
    </div>
  );
}
