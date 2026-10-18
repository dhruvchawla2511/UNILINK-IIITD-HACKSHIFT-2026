import { Ban, HelpCircle, Lock, Pin, ShieldCheck, Timer, VolumeX, X } from 'lucide-react';
import type { RoomCommandInfo, SanctionEvent, SanctionListItem } from '@/lib/supabase';

// The server decides who may use which command (server/commands.js) and sends the list with a lock flag on each
// command, so the help panel and the suggestions below never have to repeat the rank rules.

// ---------------------------------------------------------------- notices shown inside the chat

export type ChatNotice = {
  id: string;
  roomId: string;
  tone: 'info' | 'success' | 'error' | 'mod';
  text: string;
  items?: SanctionListItem[];
  /** a reply to your own command: nobody else sees it */
  private?: boolean;
};

export const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const withReason = (text: string, reason: string | null) => (reason ? `${text} Reason: ${reason}` : text);

const strikeText = (e: SanctionEvent) => (e.strikes && e.strike_limit ? ` (warning ${e.strikes} of ${e.strike_limit})` : '');

/** The line everyone in the room sees when a moderator acts. */
export function describeSanction(e: SanctionEvent): string {
  const dur = e.duration_text ? ` for ${e.duration_text}` : '';
  switch (e.action) {
    case 'ban': return withReason(`${e.target_name} was banned${e.duration_text ? dur : ''} by ${e.actor_name}.`, e.reason);
    case 'mute': return withReason(`${e.target_name} was muted${dur} by ${e.actor_name}.`, e.reason);
    case 'kick': return withReason(`${e.target_name} was kicked by ${e.actor_name}.`, e.reason);
    case 'unban': return `${e.target_name} was let back in by ${e.actor_name}.`;
    case 'unmute': return `${e.target_name} was unmuted by ${e.actor_name}.`;
    case 'warn': return withReason(`${e.target_name} was warned by ${e.actor_name}${strikeText(e)}.`, e.reason);
  }
}

/** The line the affected person sees. */
export function describeSanctionForTarget(e: SanctionEvent): string {
  const dur = e.duration_text ? ` for ${e.duration_text}` : '';
  switch (e.action) {
    case 'ban': return withReason(`You were banned from "${e.room_name}"${e.duration_text ? dur : ' permanently'} by ${e.actor_name}.`, e.reason);
    case 'mute': return withReason(`You were muted${dur} by ${e.actor_name}. You can read the room but not post.`, e.reason);
    case 'kick': return withReason(`You were kicked from "${e.room_name}" by ${e.actor_name}.`, e.reason);
    case 'unban': return `You can use "${e.room_name}" again. ${e.actor_name} lifted your ban.`;
    case 'unmute': return `${e.actor_name} unmuted you. You can post again.`;
    case 'warn': return withReason(`You were warned in "${e.room_name}" by ${e.actor_name}${strikeText(e)}.`, e.reason);
  }
}

const KIND_LABEL = { ban: 'Banned', kick: 'Kicked', mute: 'Muted' } as const;

export function NoticeRow({ notice, onDismiss }: { notice: ChatNotice; onDismiss: () => void }) {
  const tone =
    notice.tone === 'error'
      ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300'
      : notice.tone === 'success'
        ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
        : notice.tone === 'mod'
          ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300';
  return (
    <div className="flex justify-center animate-fade-in">
      <div className={`max-w-[90%] sm:max-w-[70%] border rounded-xl px-3 py-2 text-xs ${tone}`}>
        <div className="flex items-start gap-2">
          <p className="flex-1 whitespace-pre-line">{notice.text}</p>
          <button type="button" onClick={onDismiss} aria-label="Dismiss" className="opacity-60 hover:opacity-100 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {notice.items && notice.items.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {notice.items.map((it, i) => (
              <li key={`${it.user_id}-${it.kind}-${i}`} className="text-slate-700 dark:text-slate-200">
                <span className="font-medium">{it.name}</span> · {KIND_LABEL[it.kind]} {it.expires_at ? `until ${formatWhen(it.expires_at)}` : 'permanently'} · by {it.by}
                {it.reason ? ` · ${it.reason}` : ''}
              </li>
            ))}
          </ul>
        )}
        {notice.private && <p className="mt-1 text-[10px] opacity-60">Only you can see this</p>}
      </div>
    </div>
  );
}

/** "30 seconds", "2 minutes", "1 hour" for the slowmode chip. */
export function formatSeconds(sec: number): string {
  if (sec % 3600 === 0) return `${sec / 3600} hour${sec === 3600 ? '' : 's'}`;
  if (sec % 60 === 0) return `${sec / 60} minute${sec === 60 ? '' : 's'}`;
  return `${sec} second${sec === 1 ? '' : 's'}`;
}

/** The strip under the room header: the pinned message, and a note while the room is locked or in slowmode. */
export function RoomStatusBar({ info }: { info: RoomCommandInfo | null }) {
  if (!info) return null;
  const { is_locked, slowmode_seconds } = info.room;
  if (!info.pinned && !is_locked && !slowmode_seconds) return null;
  const chip = 'inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300';
  return (
    <div className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2 space-y-2">
      {(is_locked || slowmode_seconds > 0) && (
        <div className="flex flex-wrap gap-2">
          {is_locked && <span className={chip}><Lock className="w-3 h-3" /> Locked: only officers can post</span>}
          {slowmode_seconds > 0 && <span className={chip}><Timer className="w-3 h-3" /> Slowmode: one message every {formatSeconds(slowmode_seconds)}</span>}
        </div>
      )}
      {info.pinned && (
        <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
          <Pin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-brand-500" />
          <p className="min-w-0 break-words">
            <span className="font-medium text-slate-800 dark:text-slate-100">{info.pinned.sender_name}:</span>{' '}
            {info.pinned.text || (info.pinned.msg_type === 'poll' ? 'Poll' : 'Attachment')}
            {info.pinned.pinned_by_name && <span className="text-slate-400"> · pinned by {info.pinned.pinned_by_name}</span>}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- suggestions while typing

export type Person = { id: string; name: string };
export type Suggestion = { key: string; label: string; hint: string; locked: boolean; apply: (input: string) => string };

const NEEDS_PERSON = new Set(['ban', 'unban', 'mute', 'unmute', 'kick', 'warn']);
const underscored = (name: string) => name.trim().replace(/\s+/g, '_');

/** What to offer under the message box: command names after "/", people after "@". */
export function getSuggestions(input: string, info: RoomCommandInfo | null, people: Person[]): Suggestion[] {
  if (!info || !input.startsWith('/') || input.startsWith('//')) return [];

  const typing = /^\/([a-zA-Z]*)$/.exec(input);
  if (typing) {
    const q = typing[1].toLowerCase();
    return info.commands
      .filter((c) => c.name.startsWith(q))
      .sort((a, b) => Number(b.allowed) - Number(a.allowed))
      .map((c) => ({ key: c.name, label: c.usage, hint: c.allowed ? c.summary : `Locked. ${c.who}`, locked: !c.allowed, apply: () => `/${c.name} ` }));
  }

  const mention = /^\/(\w+)[^@]*@([^\s"]*)$/.exec(input);
  if (mention && NEEDS_PERSON.has(mention[1].toLowerCase())) {
    const frag = mention[2];
    const q = frag.toLowerCase().replace(/_/g, ' ');
    const found = people.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6);
    return found.map((p) => {
      const twin = people.some((o) => o.id !== p.id && o.name.trim().toLowerCase() === p.name.trim().toLowerCase());
      const handle = `@${underscored(p.name)}${twin ? `#${p.id.slice(0, 4)}` : ''}`;
      return { key: p.id, label: p.name, hint: handle, locked: false, apply: (text: string) => text.slice(0, text.length - frag.length - 1) + handle + ' ' };
    });
  }
  return [];
}

export function SuggestionList({ items, onPick }: { items: Suggestion[]; onPick: (s: Suggestion) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="absolute bottom-full left-3 right-3 mb-1 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg p-1 max-h-60 overflow-y-auto scrollbar-thin animate-fade-in">
      {items.map((s, i) => (
        <button
          key={s.key}
          type="button"
          onMouseDown={(e) => e.preventDefault()} // keep focus in the message box
          onClick={() => onPick(s)}
          className={`w-full flex items-baseline gap-3 px-3 py-1.5 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-slate-800 ${s.locked ? 'opacity-50' : ''}`}
        >
          <span className="text-sm font-mono text-slate-800 dark:text-slate-100 shrink-0">{s.label}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 truncate flex-1">{s.hint}</span>
          {s.locked && <Lock className="w-3 h-3 text-slate-400 shrink-0" />}
          {i === 0 && <span className="text-[10px] text-slate-400 shrink-0">Tab</span>}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- the help panel (/help)

export function HelpPanel({ info, onClose, onTry }: { info: RoomCommandInfo | null; onClose: () => void; onTry: (text: string) => void }) {
  const usable = info?.commands.filter((c) => c.allowed) ?? [];
  const locked = info?.commands.filter((c) => !c.allowed) ?? [];

  const card = (c: RoomCommandInfo['commands'][number]) => (
    <div key={c.name} className={`border rounded-xl p-3 ${c.allowed ? 'border-slate-200 dark:border-slate-800' : 'border-dashed border-slate-200 dark:border-slate-800 opacity-70'}`}>
      <div className="flex items-start gap-2">
        <code className="flex-1 text-sm font-mono font-semibold text-slate-900 dark:text-slate-100 break-words">{c.usage}</code>
        {c.allowed ? (
          <button
            type="button"
            onClick={() => onTry(c.example ? c.example.split(' ')[0] + ' ' : `/${c.name}`)}
            className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline shrink-0"
          >
            Use
          </button>
        ) : (
          <Lock className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
        )}
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{c.summary}</p>
      {c.example && <p className="text-xs text-slate-400 mt-1">Example: <code className="font-mono">{c.example}</code></p>}
      <p className="text-[11px] text-slate-400 mt-1">Who can: {c.who}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col animate-slide-up" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Chat commands">
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div>
            <h3 className="font-heading font-semibold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-brand-500" /> Chat commands
            </h3>
            {info && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> In <span className="font-medium">{info.room.name}</span> you are: <span className="font-medium">{info.title}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto scrollbar-thin px-5 pb-5 space-y-4">
          {!info ? (
            <p className="text-sm text-slate-500">Open a room to see the commands you can use there.</p>
          ) : (
            <>
              <section>
                <h4 className="text-xs font-semibold text-slate-400 mb-2">You can use</h4>
                <div className="space-y-2">{usable.map(card)}</div>
              </section>
              {locked.length > 0 && (
                <section>
                  <h4 className="text-xs font-semibold text-slate-400 mb-2">Locked in this room</h4>
                  <div className="space-y-2">{locked.map(card)}</div>
                </section>
              )}
              <section className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 space-y-1.5">
                <p className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200"><Ban className="w-3.5 h-3.5" /> Tips</p>
                <p><span className="font-mono">@name</span>: type <span className="font-mono">@</span> after a command to pick someone. Use <span className="font-mono">_</span> for spaces (<span className="font-mono">@Priya_Sharma</span>), or quotes: <span className="font-mono">@"Priya Sharma"</span>.</p>
                <p className="flex items-start gap-1.5"><VolumeX className="w-3.5 h-3.5 mt-0.5 shrink-0" /> <span>Time: <span className="font-mono">10m</span>, <span className="font-mono">2h</span>, <span className="font-mono">1d</span>, <span className="font-mono">1w</span>, <span className="font-mono">1d12h</span>, or <span className="font-mono">perm</span>.</span></p>
                <p>You can only act on people ranked below you. Presidents, vice presidents and secretaries act in their own college's rooms; website admins act everywhere.</p>
                <p>To send a message that starts with a slash, type two: <span className="font-mono">//like this</span>.</p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
