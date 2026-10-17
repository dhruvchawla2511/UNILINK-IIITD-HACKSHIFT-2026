import { useState } from 'react';
import { Check, Copy, KeyRound, Loader2, RefreshCw, X } from 'lucide-react';
import { apiPost, type ChatRoom } from '@/lib/supabase';

/** "482 913": easier to read out loud or type than six digits in a row. */
export const formatCode = (code: string) => (code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code);

/** Who can see a room, in a few words. */
export function roomScope(room: Pick<ChatRoom, 'room_type' | 'college'>): string {
  if (room.room_type === 'global') return 'Open to everyone';
  if (room.room_type === 'college') return `${room.college?.name ?? 'College'} students only`;
  return 'Private: invite code only';
}

/** The room's 6-digit code with a copy button, and (for people who manage the room) a button to make a new one. */
export function RoomCodeChip({ room, canRegenerate, onRegenerated }: { room: ChatRoom; canRegenerate: boolean; onRegenerated: (code: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(room.room_code);
    } catch {
      window.prompt('Copy this room code:', room.room_code);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const regenerate = async () => {
    const warn =
      room.room_type === 'private'
        ? 'Make a new code? People already in the room stay in, but the old code stops working.'
        : 'Make a new code? The old code stops working.';
    if (!window.confirm(warn)) return;
    setBusy(true);
    const { data, error } = await apiPost<{ room_code: string }>('/api/chat/room/code', { room_id: room.id });
    setBusy(false);
    if (error || !data) return window.alert(error?.message ?? 'Could not change the code');
    onRegenerated(data.room_code);
  };

  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        type="button"
        onClick={copy}
        title="Copy room code. Share it so others can join this room"
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-500/10 text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 rounded-xl text-xs font-mono font-semibold tracking-wider transition-colors"
      >
        <KeyRound className="w-3.5 h-3.5" />
        {formatCode(room.room_code)}
        {copied ? <Check className="w-3.5 h-3.5 text-accent-500" /> : <Copy className="w-3.5 h-3.5 opacity-60" />}
      </button>
      {canRegenerate && (
        <button
          type="button"
          onClick={regenerate}
          disabled={busy}
          title="New code"
          className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}

/** Type a 6-digit code to join a room somebody shared with you. */
export function JoinByCodeModal({ onClose, onJoined }: { onClose: () => void; onJoined: (room: ChatRoom) => void }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return setError('Enter the 6-digit room code');
    setLoading(true);
    setError(null);
    const { data, error } = await apiPost<ChatRoom>('/api/chat/room/join', { code });
    setLoading(false);
    if (error || !data) return setError(error?.message ?? 'Could not join that room');
    onJoined(data);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-heading font-semibold text-lg text-slate-900 dark:text-slate-100">Join with a room code</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Every room has a 6-digit code. Ask a member to share it. College rooms only open for verified students of that college.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <input
            autoFocus
            inputMode="numeric"
            autoComplete="off"
            maxLength={7}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="w-full px-3 py-3 text-center text-2xl font-mono font-semibold tracking-[0.4em] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2">{error}</div>
          )}
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join room'}
          </button>
        </form>
      </div>
    </div>
  );
}
