// Typing indicators and read receipts for the chat (the server side is server/presence.js).
//
//  - Typing: while someone types, their browser tells the server (at most every 2.5 s). Others see "Alice is typing..."
//    and it disappears when she stops, sends, or after 6 s without an update. Nothing is stored.
//  - Read receipts: when a room is open on screen, the browser says "I have read up to this message". Each person has one
//    read position per room, and a message counts as seen by everyone whose position is at or after it.
//  - Anyone can turn receipts off (the eye button in the chat header). Then they stop sharing AND stop seeing others'.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCheck, Eye, EyeOff } from 'lucide-react';
import { apiPost, type Message } from '@/lib/supabase';

const TYPING_RESEND_MS = 2500; // how often "still typing" is repeated
const TYPING_IDLE_MS = 4000; // stop signalling after this long without a keystroke
const TYPING_EXPIRE_MS = 6000; // hide someone else's notice if no update arrives (closed tab, lost connection)
const PREF_KEY = 'unilink.readReceipts';

export type Reader = { user_id: string; name: string; last_read_at: string };
type RealtimePayload = { eventType: string; new: any; old: any }; // eslint-disable-line @typescript-eslint/no-explicit-any

/** "Send and show read receipts" setting. On by default; kept in this browser. */
export function useReceiptPref(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => {
    try { return localStorage.getItem(PREF_KEY) !== 'off'; } catch { return true; }
  });
  const set = useCallback((v: boolean) => {
    setOn(v);
    try { localStorage.setItem(PREF_KEY, v ? 'on' : 'off'); } catch { /* private mode: the choice lasts until reload */ }
  }, []);
  return [on, set];
}

type Options = { roomId: string | null; meId?: string; messages: Message[]; canPost: boolean; share: boolean };

export function usePresence({ roomId, meId, messages, canPost, share }: Options) {
  const [typing, setTyping] = useState<Record<string, string>>({}); // user id -> name
  const [reads, setReads] = useState<Record<string, Reader>>({});
  const timers = useRef<Record<string, number>>({});
  const meRef = useRef(meId);
  meRef.current = meId;
  const canPostRef = useRef(canPost);
  canPostRef.current = canPost;
  const roomRef = useRef(roomId);
  roomRef.current = roomId;

  // ---------- someone else typing ----------
  const dropTyper = useCallback((userId: string) => {
    window.clearTimeout(timers.current[userId]);
    delete timers.current[userId];
    setTyping((prev) => {
      if (!(userId in prev)) return prev;
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }, []);

  const onTypingEvent = useCallback((p: RealtimePayload) => {
    const { user_id: userId, name, typing: on } = p.new ?? {};
    if (!userId || userId === meRef.current) return;
    if (!on) return dropTyper(userId);
    setTyping((prev) => ({ ...prev, [userId]: String(name || 'Someone') }));
    window.clearTimeout(timers.current[userId]);
    timers.current[userId] = window.setTimeout(() => dropTyper(userId), TYPING_EXPIRE_MS);
  }, [dropTyper]);

  // ---------- my own typing ----------
  const sentAt = useRef(0);
  const active = useRef(false);
  const idle = useRef<number>();

  const stopTyping = useCallback((room?: string | null) => {
    window.clearTimeout(idle.current);
    const rid = room ?? roomRef.current;
    if (active.current && rid) apiPost('/api/chat/typing', { room_id: rid, typing: false });
    active.current = false;
    sentAt.current = 0;
  }, []);

  /** Call with the box's text on every keystroke. */
  const notifyTyping = useCallback((text: string) => {
    const rid = roomRef.current;
    if (!rid) return;
    // an empty box, a /command, or a muted person is not "typing a message"
    if (!text.trim() || (text.startsWith('/') && !text.startsWith('//')) || !canPostRef.current) return stopTyping();
    const now = Date.now();
    if (!active.current || now - sentAt.current > TYPING_RESEND_MS) {
      active.current = true;
      sentAt.current = now;
      apiPost('/api/chat/typing', { room_id: rid, typing: true });
    }
    window.clearTimeout(idle.current);
    idle.current = window.setTimeout(() => stopTyping(), TYPING_IDLE_MS);
  }, [stopTyping]);

  // ---------- read positions ----------
  const onReadEvent = useCallback((p: RealtimePayload) => {
    if (p.eventType === 'DELETE') {
      const id = p.old?.user_id;
      if (id) setReads((prev) => { const next = { ...prev }; delete next[id]; return next; });
      return;
    }
    const r = p.new;
    if (!r?.user_id || r.user_id === meRef.current) return;
    setReads((prev) => ({ ...prev, [r.user_id]: { user_id: r.user_id, name: r.name || 'Someone', last_read_at: r.last_read_at } }));
  }, []);

  // New room: forget the old room's notices, load where everyone has read up to
  useEffect(() => {
    Object.values(timers.current).forEach((t) => window.clearTimeout(t));
    timers.current = {};
    setTyping({});
    setReads({});
    if (!roomId) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await apiPost<Reader[]>('/api/chat/reads', { room_id: roomId });
      if (!cancelled && data) setReads(Object.fromEntries(data.map((r) => [r.user_id, r])));
    };
    load();
    // the live stream can miss updates while the tab sleeps, so look again when it wakes
    const wake = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', wake);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', wake);
      stopTyping(roomId); // tell the room I left it, not the one I am moving to
    };
  }, [roomId, stopTyping]);

  // Say "I have read up to here" while the room is open and the page is visible
  const lastMarked = useRef<{ room: string; at: string } | null>(null);
  useEffect(() => {
    if (!share) {
      lastMarked.current = null;
      apiPost('/api/chat/read', { share: false }); // also removes what I shared before
    }
  }, [share]);

  useEffect(() => {
    if (!roomId || !share) return;
    const newest = [...messages].reverse().find((m) => m.room_id === roomId && m.sender_id !== meId);
    if (!newest) return;
    const mark = () => {
      if (document.visibilityState !== 'visible') return;
      if (lastMarked.current?.room === roomId && lastMarked.current.at >= newest.created_at) return;
      lastMarked.current = { room: roomId, at: newest.created_at };
      apiPost('/api/chat/read', { room_id: roomId, up_to: newest.created_at, share: true });
    };
    const t = window.setTimeout(mark, 400);
    document.addEventListener('visibilitychange', mark);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('visibilitychange', mark);
    };
  }, [roomId, messages, meId, share]);

  const readers = useMemo(() => (share ? Object.values(reads) : []), [reads, share]);
  const seenBy = useCallback((m: Message) => readers.filter((r) => r.last_read_at >= m.created_at), [readers]);

  // the newest message of mine that someone has seen (the "Seen by ..." line goes under it)
  const lastSeenId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_id === meId && seenBy(messages[i]).length > 0) return messages[i].id;
    }
    return null;
  }, [messages, meId, seenBy]);

  return { typers: Object.values(typing), seenBy, lastSeenId, onTypingEvent, onReadEvent, dropTyper, notifyTyping, stopTyping };
}

const first = (name: string) => name.trim().split(/\s+/)[0] || 'Someone';

export function typingText(names: string[]): string {
  const n = names.map(first);
  if (n.length === 1) return `${n[0]} is typing`;
  if (n.length === 2) return `${n[0]} and ${n[1]} are typing`;
  if (n.length === 3) return `${n[0]}, ${n[1]} and ${n[2]} are typing`;
  return 'Several people are typing';
}

/** The strip above the message box. It always takes the same height, so the chat does not jump. */
export function TypingLine({ names }: { names: string[] }) {
  return (
    <div className="h-5 px-4 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 shrink-0" aria-live="polite">
      {names.length > 0 && (
        <>
          <span className="flex items-end gap-0.5" aria-hidden="true">
            {[0, 150, 300].map((d) => (
              <span key={d} className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </span>
          <span className="truncate">{typingText(names)}...</span>
        </>
      )}
    </div>
  );
}

/** One check = sent, two brand-coloured checks = seen by someone. */
export function ReceiptTick({ readers, showSeen }: { readers: Reader[]; showSeen: boolean }) {
  if (showSeen && readers.length > 0) {
    return (
      <span title={`Seen by ${readers.map((r) => r.name).join(', ')}`} aria-label="Seen">
        <CheckCheck className="w-3.5 h-3.5 text-brand-500" />
      </span>
    );
  }
  return (
    <span title="Sent" aria-label="Sent">
      <Check className="w-3.5 h-3.5 text-slate-400" />
    </span>
  );
}

export function SeenLine({ readers }: { readers: Reader[] }) {
  if (readers.length === 0) return null;
  const shown = readers.slice(0, 3).map((r) => first(r.name)).join(', ');
  const more = readers.length - 3;
  return <span className="text-[10px] text-slate-400 mt-0.5">Seen by {shown}{more > 0 ? ` +${more}` : ''}</span>;
}

export function ReceiptToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  const Icon = on ? Eye : EyeOff;
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      title={on ? 'Read receipts are on: others see when you have read their messages, and you see theirs. Click to turn off.' : 'Read receipts are off: nobody sees when you read, and you do not see others. Click to turn on.'}
      aria-label={on ? 'Turn read receipts off' : 'Turn read receipts on'}
      aria-pressed={on}
      className="p-2 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
