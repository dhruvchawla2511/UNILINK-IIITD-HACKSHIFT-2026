import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  BarChart3, Check, Download, File as FileIcon, FileArchive, FileAudio, FileText, Film,
  Image as ImageIcon, Loader2, Lock, LockOpen, Megaphone, Plus, X
} from 'lucide-react';
import { apiPost, fileUrl, type Message, type Poll } from '@/lib/supabase';

export const MAX_FILE_MB = 50;
export const MAX_FILES_PER_MESSAGE = 10;

export function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

type Kind = 'image' | 'video' | 'audio' | 'file';

/** Same grouping the server uses (by extension), so the preview matches what gets sent. */
export function kindOfFile(file: File): Kind {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'].includes(ext)) return 'image';
  if (['mp4', 'm4v', 'webm', 'ogv', 'mov'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) return 'audio';
  return 'file';
}

function FileTypeIcon({ name, mime, className }: { name: string; mime: string; className?: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (mime.startsWith('audio/')) return <FileAudio className={className} />;
  if (mime.startsWith('video/')) return <Film className={className} />;
  if (mime.startsWith('image/')) return <ImageIcon className={className} />;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return <FileArchive className={className} />;
  if (['pdf', 'doc', 'docx', 'txt', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'md'].includes(ext)) return <FileText className={className} />;
  return <FileIcon className={className} />;
}

// ---------------------------------------------------------------- staged files (before sending)

export interface StagedFile {
  key: string;
  file: File;
  kind: Kind;
  preview: string | null; // object URL for images
  progress: number; // 0-100 while uploading
  error: string | null;
}

export function StagedFiles({ items, disabled, onRemove }: { items: StagedFile[]; disabled: boolean; onRemove: (key: string) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-2">
      {items.map((it) => (
        <div key={it.key} className="relative shrink-0 w-28 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 overflow-hidden">
          <div className="h-20 flex items-center justify-center bg-slate-100 dark:bg-slate-800">
            {it.preview ? (
              <img src={it.preview} alt="" className="w-full h-full object-cover" />
            ) : (
              <FileTypeIcon name={it.file.name} mime={it.kind === 'video' ? 'video/' : it.kind === 'audio' ? 'audio/' : ''} className="w-8 h-8 text-slate-400" />
            )}
          </div>
          <div className="px-2 py-1">
            <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate" title={it.file.name}>{it.file.name}</p>
            <p className={`text-[10px] ${it.error ? 'text-red-500' : 'text-slate-400'}`}>{it.error ?? formatSize(it.file.size)}</p>
          </div>
          {disabled && !it.error && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-200 dark:bg-slate-700">
              <div className="h-full bg-brand-500 transition-all" style={{ width: `${it.progress}%` }} />
            </div>
          )}
          {!disabled && (
            <button
              type="button"
              onClick={() => onRemove(it.key)}
              aria-label="Remove file"
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- full-screen picture viewer

export function ImageViewer({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="absolute top-4 right-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
        <a href={fileUrl(url, true)} className="p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Download" title="Download">
          <Download className="w-5 h-5" />
        </a>
        <button onClick={onClose} className="p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
      </div>
      <img src={fileUrl(url)} alt={name} className="max-w-full max-h-full object-contain rounded-xl" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

// ---------------------------------------------------------------- message body

export function MessageBody({
  msg, isOwn, poll, canManagePoll, onOpenImage, onPollChanged,
}: {
  msg: Message;
  isOwn: boolean;
  poll: Poll | undefined;
  canManagePoll: boolean;
  onOpenImage: (url: string, name: string) => void;
  onPollChanged: (poll: Poll) => void;
}) {
  const bubbleText = isOwn
    ? 'bg-brand-600 text-white rounded-tr-sm'
    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm';
  const caption = msg.content ? <p className="whitespace-pre-wrap break-words"><MentionText msg={msg} isOwn={isOwn} /></p> : null;
  const url = msg.attachment_url;
  const name = msg.attachment_name ?? 'file';

  if (msg.is_announcement) {
    return (
      <div className="rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-amber-950 dark:text-amber-100 px-3.5 py-2.5 text-sm max-w-full">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 mb-1">
          <Megaphone className="w-3.5 h-3.5" /> Announcement
        </p>
        {caption}
      </div>
    );
  }

  if (msg.msg_type === 'poll') {
    return <PollCard msg={msg} poll={poll} isOwn={isOwn} canManage={canManagePoll} onChanged={onPollChanged} />;
  }

  if (msg.msg_type === 'image' && url) {
    return (
      <div className={`rounded-2xl overflow-hidden border ${isOwn ? 'bg-brand-600 border-brand-600 rounded-tr-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-tl-sm'}`}>
        <button type="button" onClick={() => onOpenImage(url, name)} className="block">
          <img src={fileUrl(url)} alt={name} loading="lazy" className="max-h-72 max-w-full object-cover" />
        </button>
        {caption && <div className={`px-3.5 py-2 text-sm ${isOwn ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>{caption}</div>}
      </div>
    );
  }

  if (msg.msg_type === 'video' && url) {
    return (
      <div className={`rounded-2xl overflow-hidden border ${isOwn ? 'bg-brand-600 border-brand-600 rounded-tr-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-tl-sm'}`}>
        <video src={fileUrl(url)} controls preload="metadata" className="max-h-72 max-w-full bg-black" />
        <div className={`px-3.5 py-1.5 text-xs flex items-center gap-2 ${isOwn ? 'text-white/80' : 'text-slate-500'}`}>
          <span className="truncate">{name}</span>
          <a href={fileUrl(url, true)} className="ml-auto shrink-0 hover:underline" title="Download">Download</a>
        </div>
        {caption && <div className={`px-3.5 pb-2 text-sm ${isOwn ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>{caption}</div>}
      </div>
    );
  }

  if (msg.msg_type === 'audio' && url) {
    return (
      <div className={`px-3 py-2.5 rounded-2xl text-sm ${bubbleText}`}>
        <p className="text-xs mb-1.5 truncate opacity-80">{name}</p>
        <audio src={fileUrl(url)} controls preload="metadata" className="max-w-full h-9" />
        {caption && <div className="mt-1.5">{caption}</div>}
      </div>
    );
  }

  if (msg.msg_type === 'file' && url) {
    return (
      <div className={`rounded-2xl text-sm overflow-hidden ${bubbleText}`}>
        <a
          href={fileUrl(url, true)}
          className={`flex items-center gap-3 px-3.5 py-2.5 ${isOwn ? 'hover:bg-white/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800'} transition-colors`}
          title="Download"
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isOwn ? 'bg-white/15' : 'bg-brand-50 dark:bg-brand-500/10'}`}>
            <FileTypeIcon name={name} mime={msg.attachment_mime ?? ''} className={`w-5 h-5 ${isOwn ? 'text-white' : 'text-brand-600 dark:text-brand-400'}`} />
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate max-w-[14rem]">{name}</p>
            <p className={`text-xs ${isOwn ? 'text-white/70' : 'text-slate-400'}`}>{formatSize(msg.attachment_size)}</p>
          </div>
          <Download className="w-4 h-4 shrink-0 opacity-70" />
        </a>
        {caption && <div className="px-3.5 pb-2.5">{caption}</div>}
      </div>
    );
  }

  return <div className={`px-3.5 py-2 rounded-2xl text-sm ${bubbleText}`}>{caption ?? msg.content}</div>;
}

// ---------------------------------------------------------------- poll card

function PollCard({ msg, poll, isOwn, canManage, onChanged }: {
  msg: Message; poll: Poll | undefined; isOwn: boolean; canManage: boolean; onChanged: (p: Poll) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!poll) {
    return (
      <div className="px-3.5 py-2.5 rounded-2xl text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 flex items-center gap-2">
        <BarChart3 className="w-4 h-4" /> {msg.content}
      </div>
    );
  }

  const vote = async (optionId: string) => {
    if (busy || poll.is_closed) return;
    let next: string[];
    if (poll.multiple) next = poll.my_votes.includes(optionId) ? poll.my_votes.filter((v) => v !== optionId) : [...poll.my_votes, optionId];
    else next = poll.my_votes.includes(optionId) ? [] : [optionId];

    // show the change right away, the server confirms it
    const before = poll;
    const options = poll.options.map((o) => ({
      ...o,
      votes: o.votes + (next.includes(o.id) ? 1 : 0) - (poll.my_votes.includes(o.id) ? 1 : 0),
    }));
    const hadVoted = poll.my_votes.length > 0;
    const willVote = next.length > 0;
    onChanged({ ...poll, options, my_votes: next, total_voters: poll.total_voters + (willVote ? 1 : 0) - (hadVoted ? 1 : 0) });

    setBusy(true);
    setError(null);
    const { error } = await apiPost('/api/chat/poll/vote', { poll_id: poll.id, option_ids: next });
    setBusy(false);
    if (error) {
      setError(error.message);
      onChanged(before);
    }
  };

  const toggleClosed = async () => {
    setBusy(true);
    setError(null);
    const { error } = await apiPost('/api/chat/poll/close', { poll_id: poll.id, closed: !poll.is_closed });
    setBusy(false);
    if (error) setError(error.message);
    else onChanged({ ...poll, is_closed: !poll.is_closed });
  };

  const totalVotes = poll.options.reduce((n, o) => n + o.votes, 0);

  return (
    <div className="w-72 max-w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 p-3.5 shadow-sm">
      <div className="flex items-start gap-2 mb-1">
        <BarChart3 className="w-4 h-4 mt-0.5 text-brand-500 shrink-0" />
        <p className="font-semibold text-sm break-words">{poll.question}</p>
      </div>
      <p className="text-[11px] text-slate-400 mb-2.5 ml-6">
        {poll.is_closed ? 'Poll closed' : poll.multiple ? 'Select one or more' : 'Select one'}
      </p>

      <div className="space-y-1.5">
        {poll.options.map((o) => {
          const mine = poll.my_votes.includes(o.id);
          const pct = totalVotes ? Math.round((o.votes / totalVotes) * 100) : 0;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => vote(o.id)}
              disabled={poll.is_closed}
              className={`relative w-full text-left rounded-xl border overflow-hidden px-3 py-2 text-sm transition-colors ${
                mine ? 'border-brand-500' : 'border-slate-200 dark:border-slate-700'
              } ${poll.is_closed ? 'cursor-default' : 'hover:border-brand-400'}`}
            >
              <div className={`absolute inset-y-0 left-0 transition-all ${mine ? 'bg-brand-100 dark:bg-brand-500/25' : 'bg-slate-100 dark:bg-slate-800'}`} style={{ width: `${pct}%` }} />
              <div className="relative flex items-center gap-2">
                <span className={`w-4 h-4 shrink-0 border flex items-center justify-center ${poll.multiple ? 'rounded' : 'rounded-full'} ${mine ? 'bg-brand-600 border-brand-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                  {mine && <Check className="w-3 h-3" />}
                </span>
                <span className="flex-1 break-words min-w-0">{o.text}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">{o.votes} · {pct}%</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-2.5 text-[11px] text-slate-400">
        <span>{poll.total_voters} {poll.total_voters === 1 ? 'person' : 'people'} voted</span>
        {(canManage || isOwn) && (
          <button type="button" onClick={toggleClosed} disabled={busy} className="inline-flex items-center gap-1 hover:text-brand-600 dark:hover:text-brand-400 disabled:opacity-50">
            {poll.is_closed ? <><LockOpen className="w-3 h-3" /> Reopen</> : <><Lock className="w-3 h-3" /> Close poll</>}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- create poll dialog

export function CreatePollModal({ roomId, onClose }: { roomId: string; onClose: () => void }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filled = options.map((o) => o.trim()).filter(Boolean);
  const canSend = question.trim().length > 0 && filled.length >= 2;

  const setOption = (i: number, v: string) => setOptions((prev) => prev.map((o, idx) => (idx === i ? v : o)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    setLoading(true);
    setError(null);
    const { error } = await apiPost('/api/chat/poll', { room_id: roomId, question: question.trim(), options: filled, multiple });
    setLoading(false);
    if (error) return setError(error.message);
    onClose();
  };

  const inputCls = 'w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6 animate-slide-up max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-semibold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-brand-500" /> Create Poll
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Question</label>
            <input type="text" autoFocus maxLength={200} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask something..." className={inputCls} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Options</label>
            <div className="space-y-2">
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="text" maxLength={100} value={o} onChange={(e) => setOption(i, e.target.value)} placeholder={`Option ${i + 1}`} className={inputCls} />
                  {options.length > 2 && (
                    <button type="button" onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove option" className="p-1.5 text-slate-400 hover:text-red-500 shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 10 && (
              <button type="button" onClick={() => setOptions((prev) => [...prev, ''])} className="mt-2 inline-flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 hover:underline">
                <Plus className="w-4 h-4" /> Add option
              </button>
            )}
          </div>

          <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
            <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} className="w-4 h-4 rounded accent-brand-600" />
            Allow multiple answers
          </label>

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2">{error}</div>
          )}

          <button type="submit" disabled={loading || !canSend} className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Poll'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- @mentions

type Mentioned = { id: string; name: string };
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Message text with @Name highlighted for the people the server recognised as mentioned. */
export function MentionText({ msg, isOwn }: { msg: Pick<Message, 'content' | 'mentions'>; isOwn: boolean }) {
  const { profile } = useAuth();
  const text = msg.content ?? '';
  let list: Mentioned[] = [];
  try { list = msg.mentions ? (JSON.parse(msg.mentions) as Mentioned[]) : []; } catch { /* plain text */ }
  if (!list.length) return <>{text}</>;

  const byName = new Map<string, Mentioned>();
  for (const m of list) { byName.set(m.name.toLowerCase(), m); byName.set(m.name.toLowerCase().replace(/\s+/g, '_'), m); }
  const names = [...byName.keys()].sort((a, b) => b.length - a.length).map(escapeRe);
  const re = new RegExp(`@(${names.join('|')})(?![\\p{L}\\p{N}_])`, 'giu');

  const parts: ReactNode[] = [];
  let last = 0;
  for (const hit of text.matchAll(re)) {
    const at = hit.index ?? 0;
    if (at > last) parts.push(text.slice(last, at));
    const who = byName.get(hit[1].toLowerCase());
    const me = who?.id === profile?.id;
    parts.push(
      <span key={at} className={`rounded px-1 font-semibold ${me ? 'bg-amber-200 text-amber-900 dark:bg-amber-400/30 dark:text-amber-100' : isOwn ? 'bg-white/20 text-white' : 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'}`}>
        {hit[0]}
      </span>
    );
    last = at + hit[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
