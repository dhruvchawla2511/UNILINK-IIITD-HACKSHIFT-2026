// Direct messages: private 1-on-1 conversations (server side: server/dm.js).
// A conversation is an ordinary private chat room under the hood, so messages, photos and files work like in a room;
// what is different is that there is no owner, no commands, no room code, and either person can block the other.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useDirectMessages } from '@/context/DirectMessageContext';
import { supabase, uploadFile, type Message } from '@/lib/supabase';
import { dmApi, listTime, type Conversation } from '@/lib/directMessages';
import { Avatar, PersonLine } from '@/components/dm/PersonBits';
import { NewMessageModal } from '@/components/dm/NewMessageModal';
import { FriendsPanel } from '@/components/dm/FriendsPanel';
import { UserInfoModal } from '@/components/chat/UserInfoModal';
import { ReportMessageModal } from '@/components/chat/Reports';
import {
  ImageViewer, MessageBody, StagedFiles, kindOfFile, MAX_FILE_MB, MAX_FILES_PER_MESSAGE, type StagedFile,
} from '@/components/chat/ChatExtras';
import {
  ArrowLeft, Ban, Flag, Loader2, MessageCircle, MessageSquarePlus, Paperclip, Search, Send, Trash2, UploadCloud, X,
} from 'lucide-react';

const PAGE_SIZE = 50;

const formatTime = (ts: string) => {
  const d = new Date(ts);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function MessagesPage({ targetUserId, onTargetHandled }: { targetUserId: string | null; onTargetHandled: () => void }) {
  const { profile } = useAuth();
  const { refreshUnread } = useDirectMessages();

  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileThread, setMobileThread] = useState(false);
  const [search, setSearch] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [infoUserId, setInfoUserId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{ id: string; author: string } | null>(null);
  const [viewer, setViewer] = useState<{ url: string; name: string } | null>(null);

  const activeRef = useRef<string | null>(null);
  activeRef.current = activeId;
  const fileInput = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const skipAutoScroll = useRef(false);
  const listTimer = useRef<number>();

  const active = convs.find((c) => c.room_id === activeId) ?? null;

  // ---------- the conversation list ----------
  const loadList = useCallback(async () => {
    const { data } = await dmApi.list();
    if (data) setConvs(data);
    setLoadingList(false);
  }, []);
  const reloadList = useCallback(() => {
    window.clearTimeout(listTimer.current);
    listTimer.current = window.setTimeout(loadList, 250);
  }, [loadList]);
  useEffect(() => {
    loadList();
    return () => window.clearTimeout(listTimer.current);
  }, [loadList]);

  // "I have read this": private to me (the other person is not told). Only while the page is on screen.
  const markSeen = useCallback(async (roomId: string) => {
    if (document.visibilityState !== 'visible') return;
    await dmApi.seen(roomId);
    setConvs((prev) => prev.map((c) => (c.room_id === roomId ? { ...c, unread: 0 } : c)));
    refreshUnread();
  }, [refreshUnread]);

  useEffect(() => {
    const wake = () => { if (activeRef.current) markSeen(activeRef.current); };
    document.addEventListener('visibilitychange', wake);
    return () => document.removeEventListener('visibilitychange', wake);
  }, [markSeen]);

  // ---------- starting or opening a conversation ----------
  const startWith = useCallback(async (userId: string) => {
    const { data, error } = await dmApi.start(userId);
    if (error || !data) {
      setBanner(error?.message ?? 'Could not start the conversation');
      return;
    }
    setBanner(null);
    await loadList();
    setActiveId(data.room_id);
    setMobileThread(true);
  }, [loadList]);

  // Opened from somebody's profile card ("Message")
  useEffect(() => {
    if (!targetUserId) return;
    startWith(targetUserId).finally(onTargetHandled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId]);

  // ---------- messages of the open conversation ----------
  const clearStaged = useCallback(() => {
    setStaged((prev) => {
      prev.forEach((s) => s.preview && URL.revokeObjectURL(s.preview));
      return [];
    });
  }, []);

  useEffect(() => {
    setMessages([]);
    setHasOlder(false);
    setSendError(null);
    setInput('');
    clearStaged();
    if (!activeId) return;
    let live = true;
    setLoadingMsgs(true);
    supabase
      .from('messages')
      .select('*')
      .eq('room_id', activeId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
      .then(({ data }: { data: Message[] | null }) => {
        if (!live) return;
        setLoadingMsgs(false);
        if (data) {
          setHasOlder(data.length === PAGE_SIZE);
          setMessages(data.slice().reverse());
          markSeen(activeId);
        }
      });
    return () => { live = false; };
  }, [activeId, clearStaged, markSeen]);

  const loadOlder = async () => {
    const oldest = messages[0];
    if (!activeId || !oldest || loadingOlder) return;
    setLoadingOlder(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', activeId)
      .lt('created_at', oldest.created_at)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    setLoadingOlder(false);
    if (!data) return;
    setHasOlder(data.length === PAGE_SIZE);
    const el = listRef.current;
    const before = el ? { height: el.scrollHeight, top: el.scrollTop } : null;
    skipAutoScroll.current = true;
    setMessages((prev) => {
      const have = new Set(prev.map((m) => m.id));
      return [...(data as Message[]).slice().reverse().filter((m) => !have.has(m.id)), ...prev];
    });
    requestAnimationFrame(() => { if (el && before) el.scrollTop = el.scrollHeight - before.height + before.top; });
  };

  useEffect(() => {
    if (skipAutoScroll.current) { skipAutoScroll.current = false; return; }
    // Scroll only the message list (scrollIntoView would also scroll the whole page)
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // ---------- live updates (the server only sends a conversation's messages to its two people) ----------
  const myId = profile?.id;
  useEffect(() => {
    const channel = supabase
      .channel('dm-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_messages' }, (p) => {
        const row = p.eventType === 'DELETE' ? p.old : p.new;
        if (row?.room_id && row.room_id === activeRef.current) {
          if (p.eventType === 'INSERT') {
            const m = p.new as Message;
            setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
            if (m.sender_id !== myId) markSeen(m.room_id);
          } else if (p.eventType === 'DELETE') {
            setMessages((prev) => prev.filter((x) => x.id !== p.old.id));
          }
        }
        reloadList();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [myId, markSeen, reloadList]);

  // ---------- sending ----------
  const addFiles = (list: FileList | File[]) => {
    const files = Array.from(list);
    if (!files.length) return;
    setSendError(null);
    const tooBig = files.filter((f) => f.size > MAX_FILE_MB * 1024 * 1024);
    const ok = files.filter((f) => f.size > 0 && f.size <= MAX_FILE_MB * 1024 * 1024);
    const take = ok.slice(0, Math.max(0, MAX_FILES_PER_MESSAGE - staged.length));
    const problems: string[] = [];
    if (tooBig.length) problems.push(`${tooBig.map((f) => f.name).join(', ')} ${tooBig.length > 1 ? 'are' : 'is'} over ${MAX_FILE_MB} MB`);
    if (ok.length > take.length) problems.push(`You can attach up to ${MAX_FILES_PER_MESSAGE} files at once`);
    if (problems.length) setSendError(problems.join('. ') + '.');
    setStaged((prev) => [
      ...prev,
      ...take.map((file) => {
        const kind = kindOfFile(file);
        return { key: crypto.randomUUID(), file, kind, preview: kind === 'image' ? URL.createObjectURL(file) : null, progress: 0, error: null } as StagedFile;
      }),
    ]);
  };
  const patchStaged = (key: string, patch: Partial<StagedFile>) => setStaged((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const removeStaged = (key: string) =>
    setStaged((prev) => {
      prev.filter((s) => s.key === key).forEach((s) => s.preview && URL.revokeObjectURL(s.preview));
      return prev.filter((s) => s.key !== key);
    });

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active || !profile || sending) return;
    const text = input.trim();
    if (!text && staged.length === 0) return;
    setSendError(null);

    if (staged.length === 0) {
      setInput('');
      const { error } = await supabase.from('messages').insert({ room_id: active.room_id, sender_id: profile.id, content: text });
      if (error) {
        setInput(text);
        setSendError(error.message);
      }
      return;
    }

    // files: upload each one, then send it as its own message (the typed text goes with the first)
    setSending(true);
    let caption = text;
    for (const item of [...staged]) {
      patchStaged(item.key, { progress: 0, error: null });
      const up = await uploadFile(item.file, (progress) => patchStaged(item.key, { progress }));
      if (!up.data) {
        patchStaged(item.key, { error: up.error?.message ?? 'Upload failed' });
        setSendError(`${item.file.name}: ${up.error?.message ?? 'Upload failed'}`);
        break;
      }
      const { error } = await supabase.from('messages').insert({ room_id: active.room_id, sender_id: profile.id, content: caption, attachment_url: up.data.url });
      if (error) {
        patchStaged(item.key, { error: error.message });
        setSendError(`${item.file.name}: ${error.message}`);
        break;
      }
      if (caption) { caption = ''; setInput(''); }
      removeStaged(item.key);
    }
    setSending(false);
  };

  const deleteMessage = async (id: string) => {
    await supabase.from('messages').delete().eq('id', id);
  };

  const toggleBlock = async () => {
    if (!active) return;
    const blocking = !active.blocked_by_me;
    if (blocking && !window.confirm(`Block ${active.peer.full_name}? Neither of you will be able to send messages in this conversation until you unblock them.`)) return;
    const { error } = await (blocking ? dmApi.block : dmApi.unblock)(active.peer.id);
    if (error) return setSendError(error.message);
    setSendError(null);
    loadList();
  };

  // Deletes the chat for you only; the other person keeps theirs.
  const deleteChat = async () => {
    if (!active) return;
    if (!window.confirm(`Delete this chat with ${active.peer.full_name}? Its messages will be removed for you only. ${active.peer.full_name} keeps their copy.`)) return;
    const { error } = await dmApi.remove(active.room_id);
    if (error) return setSendError(error.message);
    setSendError(null);
    setActiveId(null);
    setMobileThread(false);
    loadList();
  };

  const openConversation = (c: Conversation) => {
    setActiveId(c.room_id);
    setMobileThread(true);
  };

  const needle = search.trim().toLowerCase();
  const shown = convs.filter((c) => !needle || c.peer.full_name.toLowerCase().includes(needle));

  return (
    <div className="h-full min-h-0 flex overflow-hidden">
      {/* Conversations */}
      <div className={`w-72 shrink-0 min-h-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col ${mobileThread ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading font-semibold text-slate-900 dark:text-slate-100">Messages</h2>
            <button
              onClick={() => setShowNew(true)}
              title="New message"
              aria-label="New message"
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-brand-600 hover:bg-brand-700 text-white transition-colors"
            >
              <MessageSquarePlus className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations"
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
        </div>
        <FriendsPanel onMessage={(id) => { void startWith(id); }} />
        <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-0.5">
          {loadingList ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-brand-500" /></div>
          ) : shown.length === 0 ? (
            <div className="text-center py-10 px-4 text-slate-400 text-sm">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              {needle ? 'No conversations match' : 'No conversations yet'}
              {!needle && (
                <button onClick={() => setShowNew(true)} className="block mx-auto mt-3 text-brand-600 dark:text-brand-400 font-medium hover:underline">Start one</button>
              )}
            </div>
          ) : (
            shown.map((c) => (
              <button
                key={c.room_id}
                onClick={() => openConversation(c)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all ${
                  activeId === c.room_id ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Avatar person={c.peer} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm truncate flex-1 ${c.unread ? 'font-semibold text-slate-900 dark:text-slate-100' : 'font-medium text-slate-700 dark:text-slate-300'}`}>{c.peer.full_name}</p>
                    <span className="text-[10px] text-slate-400 shrink-0">{listTime(c.activity_at)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className={`text-xs truncate flex-1 ${c.unread ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
                      {c.last ? `${c.last.from_me ? 'You: ' : ''}${c.last.preview}` : 'No messages yet'}
                    </p>
                    {c.unread > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-brand-600 text-white text-[10px] font-semibold flex items-center justify-center shrink-0" aria-label={`${c.unread} unread`}>
                        {c.unread > 99 ? '99+' : c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Conversation */}
      <div
        className={`relative flex-1 min-w-0 min-h-0 flex flex-col bg-slate-50 dark:bg-slate-950 ${mobileThread ? 'flex' : 'hidden lg:flex'}`}
        onDragOver={(e) => { if (active && !active.blocked_by_me && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true); } }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (active && !active.blocked_by_me && e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
      >
        {dragOver && (
          <div className="absolute inset-0 z-20 bg-brand-500/10 border-2 border-dashed border-brand-500 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl shadow text-sm font-medium text-brand-600">
              <UploadCloud className="w-5 h-5" /> Drop files to attach
            </div>
          </div>
        )}
        {banner && (
          <div className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/30 px-4 py-2.5 shrink-0">
            <span className="flex-1">{banner}</span>
            <button type="button" onClick={() => setBanner(null)} aria-label="Dismiss"><X className="w-4 h-4" /></button>
          </div>
        )}

        {!active ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-xs">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center">
                <MessageCircle className="w-7 h-7 text-brand-600 dark:text-brand-400" />
              </div>
              <h3 className="font-heading font-semibold text-slate-900 dark:text-slate-100">Your messages</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Send a private message to a student, alumnus or administrator. Only the two of you can read it.</p>
              <button onClick={() => setShowNew(true)} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors">
                <MessageSquarePlus className="w-4 h-4" /> New message
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 gap-3 shrink-0">
              <button onClick={() => setMobileThread(false)} className="lg:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" aria-label="Back to conversations">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button onClick={() => setInfoUserId(active.peer.id)} className="flex items-center gap-3 min-w-0 flex-1 text-left" title="View profile">
                <Avatar person={active.peer} />
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">{active.peer.full_name}</h3>
                  <PersonLine person={active.peer} />
                </div>
              </button>
              <button
                onClick={toggleBlock}
                title={active.blocked_by_me ? 'Unblock' : 'Block'}
                aria-label={active.blocked_by_me ? 'Unblock' : 'Block'}
                className={`p-2 rounded-xl transition-colors ${active.blocked_by_me ? 'text-red-500 bg-red-50 dark:bg-red-500/10' : 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'}`}
              >
                <Ban className="w-4 h-4" />
              </button>
              <button
                onClick={deleteChat}
                title="Delete chat"
                aria-label="Delete chat"
                className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={listRef} className="chat-message-list min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin px-4 py-4 space-y-3">
              {hasOlder && (
                <div className="flex justify-center">
                  <button
                    onClick={loadOlder}
                    disabled={loadingOlder}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 hover:bg-brand-100 dark:hover:bg-brand-500/20 rounded-full transition-colors disabled:opacity-60"
                  >
                    {loadingOlder && <Loader2 className="w-3 h-3 animate-spin" />}
                    Load older messages
                  </button>
                </div>
              )}
              {loadingMsgs ? (
                <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-brand-500" /></div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  No messages yet. Say hello to {active.peer.full_name.split(' ')[0]}!
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.sender_id === profile?.id;
                  return (
                    <div key={msg.id} className={`flex animate-fade-in ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div className={`group max-w-[75%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                        <MessageBody
                          msg={msg}
                          isOwn={isOwn}
                          poll={undefined}
                          canManagePoll={false}
                          onOpenImage={(url, name) => setViewer({ url, name })}
                          onPollChanged={() => {}}
                        />
                        <div className="flex items-center gap-2.5 mt-1">
                          <span className="text-[10px] text-slate-400">{formatTime(msg.created_at)}</span>
                          {isOwn ? (
                            <button
                              onClick={() => deleteMessage(msg.id)}
                              title="Delete message"
                              aria-label="Delete message"
                              className="opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setReportTarget({ id: msg.id, author: active.peer.full_name })}
                              title="Report message"
                              aria-label="Report message"
                              className="opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100 text-slate-400 hover:text-amber-600 transition-opacity"
                            >
                              <Flag className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={endRef} />
            </div>

            {/* Composer */}
            {active.blocked_by_me ? (
              <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0 flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                <Ban className="w-4 h-4 text-red-500 shrink-0" />
                <span className="flex-1">You blocked {active.peer.full_name}. Neither of you can send messages here.</span>
                <button onClick={toggleBlock} className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium transition-colors">Unblock</button>
              </div>
            ) : (
              <form onSubmit={send} className="chat-composer flex-none p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
                {staged.length > 0 && <StagedFiles items={staged} disabled={sending} onRemove={removeStaged} />}
                {sendError && (
                  <div className="mb-2 flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2">
                    <span className="flex-1">{sendError}</span>
                    <button type="button" onClick={() => setSendError(null)} aria-label="Dismiss"><X className="w-3.5 h-3.5" /></button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={sending}
                    title="Attach files"
                    aria-label="Attach files"
                    className="w-10 h-10 flex items-center justify-center rounded-full text-slate-500 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors shrink-0"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <input ref={fileInput} type="file" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onPaste={(e) => {
                      if (e.clipboardData.files.length) {
                        e.preventDefault();
                        addFiles(e.clipboardData.files);
                      }
                    }}
                    placeholder={staged.length ? 'Add a caption...' : `Message ${active.peer.full_name.split(' ')[0]}`}
                    maxLength={4000}
                    className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                  <button
                    type="submit"
                    disabled={sending || (!input.trim() && staged.length === 0)}
                    aria-label="Send"
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white transition-colors shrink-0"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>

      {showNew && <NewMessageModal onClose={() => setShowNew(false)} onPick={(id) => { setShowNew(false); startWith(id); }} />}
      {infoUserId && <UserInfoModal userId={infoUserId} onClose={() => setInfoUserId(null)} />}
      {reportTarget && <ReportMessageModal messageId={reportTarget.id} authorName={reportTarget.author} onClose={() => setReportTarget(null)} />}
      {viewer && <ImageViewer url={viewer.url} name={viewer.name} onClose={() => setViewer(null)} />}
    </div>
  );
}
