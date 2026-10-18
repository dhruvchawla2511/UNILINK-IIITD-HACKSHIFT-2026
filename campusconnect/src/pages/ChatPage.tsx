import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, apiPost, uploadFile, type ChatRoom, type CommandResult, type Message, type Poll, type Profile, type ReportSummary, type RoomCommandInfo, type RoomSettingsEvent, type SanctionEvent } from '@/lib/supabase';
import {
  Send, Hash, Globe, Lock, Plus, Search, X,
  ArrowLeft, Loader2, Trash2, MessageSquare, Pencil,
  Paperclip, Image as ImageIcon, Film, FileText, BarChart3, UploadCloud, KeyRound, BadgeCheck, Users, LogOut, HelpCircle, VolumeX, Flag, ShieldAlert, SmilePlus
} from 'lucide-react';
import { UserInfoModal } from '@/components/chat/UserInfoModal';
import { ReceiptToggle, SeenLine, TypingLine, usePresence, useReceiptPref } from '@/components/chat/Presence';
import Avatar from '@/components/Avatar';
import UserBadges from '@/components/UserBadges';
import { canDeleteRoom, canEditRoom, canModerateMessage, isGlobalAdmin, rankLabel } from '@/lib/collegeRoles';
import { JoinByCodeModal, RoomCodeChip, roomScope } from '@/components/chat/RoomCodes';
import { RoomMembersModal } from '@/components/chat/RoomMembers';
import { ReportMessageModal, ReportQueueModal } from '@/components/chat/Reports';
import {
  HelpPanel, NoticeRow, RoomStatusBar, SuggestionList, describeSanction, describeSanctionForTarget, formatWhen, getSuggestions,
  type ChatNotice, type Suggestion
} from '@/components/chat/CommandHelp';
import OnboardingWizard, { type Step } from '@/components/onboarding/OnboardingWizard';
import GettingStarted from '@/components/onboarding/GettingStarted';
import {
  CreatePollModal, ImageViewer, MessageBody, StagedFiles, kindOfFile,
  MAX_FILE_MB, MAX_FILES_PER_MESSAGE, type StagedFile
} from '@/components/chat/ChatExtras';

const PAGE_SIZE = 50;
type ChatReaction = { message_id: string; user_id: string; emoji: string; name: string };
const REACTION_OPTIONS = ['👍', '❤️', '😂', '🎉', '😮', '🙏'];

export default function ChatPage({ initialRoomId = null, onInitialRoomHandled }: { initialRoomId?: string | null; onInitialRoomHandled?: () => void }) {
  const { profile } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [messageSearch, setMessageSearch] = useState('');
  const [reactionRows, setReactionRows] = useState<ChatReaction[]>([]);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [guideStep, setGuideStep] = useState<Step | null>(null);
  const [editingRoom, setEditingRoom] = useState(false);
  const [mobileChatView, setMobileChatView] = useState(false);
  const [polls, setPolls] = useState<Record<string, Poll>>({});
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showAttach, setShowAttach] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [viewer, setViewer] = useState<{ url: string; name: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [infoUserId, setInfoUserId] = useState<string | null>(null);
  // chat commands (/help /ban /mute /kick ...), see server/commands.js
  const [cmdInfo, setCmdInfo] = useState<RoomCommandInfo | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [notices, setNotices] = useState<ChatNotice[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  // reports: "Report message" for everyone, the queue for moderators (see server/reports.js)
  const [reportTarget, setReportTarget] = useState<{ id: string; author: string } | null>(null);
  const [showReports, setShowReports] = useState(false);
  const [reportSummary, setReportSummary] = useState<ReportSummary>({ can_review: false, open: 0 });
  const activeRef = useRef<ChatRoom | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const skipAutoScroll = useRef(false); // set while older messages are added at the top
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [shareReceipts, setShareReceipts] = useReceiptPref();
  const presence = usePresence({ roomId: activeRoom?.id ?? null, meId: profile?.id, messages, canPost: !cmdInfo?.mute, share: shareReceipts });

  const loadRooms = useCallback(async () => {
    const { data } = await supabase
      .from('chat_rooms')
      .select('*, college:colleges(*)')
      .order('created_at', { ascending: true });
    if (data) setRooms(data as ChatRoom[]);
    setLoading(false);
  }, []);

  // The NEWEST messages first (then shown oldest-to-newest). Older ones come with "Load older messages".
  const loadMessages = useCallback(async (roomId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(*)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    if (data) {
      setHasOlder(data.length === PAGE_SIZE);
      setMessages((data as Message[]).slice().reverse());
    }
  }, []);

  const loadOlder = async () => {
    const oldest = messages[0];
    if (!activeRoom || !oldest || loadingOlder) return;
    setLoadingOlder(true);
    const { data } = await supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(*)')
      .eq('room_id', activeRoom.id)
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
    // keep the same message under the reader's eyes after the older ones are added above it
    requestAnimationFrame(() => {
      if (el && before) el.scrollTop = el.scrollHeight - before.height + before.top;
    });
  };

  const loadPolls = useCallback(async (roomId: string) => {
    const { data } = await apiPost<Poll[]>('/api/chat/polls', { room_id: roomId });
    if (data) setPolls(Object.fromEntries(data.map((p) => [p.message_id, p])));
  }, []);

  const refreshCmdInfo = useCallback(async (roomId: string) => {
    const { data } = await apiPost<RoomCommandInfo>('/api/chat/commands', { room_id: roomId });
    // ignore the answer if the person has already moved to another room
    if (activeRef.current?.id === roomId) setCmdInfo(data);
  }, []);

  const addNotice = useCallback((n: Omit<ChatNotice, 'id'>) => {
    setNotices((prev) => [...prev.slice(-19), { ...n, id: crypto.randomUUID() }]);
  }, []);

  const clearStaged = useCallback(() => {
    setStaged((prev) => {
      prev.forEach((s) => s.preview && URL.revokeObjectURL(s.preview));
      return [];
    });
    setSendError(null);
  }, []);

  // Load rooms on mount, and again when the person's college or verification changes
  // (so college chats show up the moment they are approved)
  useEffect(() => {
    loadRooms();
  }, [loadRooms, profile?.is_verified, profile?.college_id]);

  // Subscribe to new messages in active room
  useEffect(() => {
    if (!activeRoom) return;

    setPolls({});
    setReactionRows([]);
    loadMessages(activeRoom.id);
    loadPolls(activeRoom.id);
    apiPost<ChatReaction[]>('/api/chat/reactions', { room_id: activeRoom.id }).then(({ data }) => { if (data) setReactionRows(data); });

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`messages:${activeRoom.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${activeRoom.id}` },
        async (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.msg_type === 'poll') loadPolls(activeRoom.id);
          // Fetch sender info
          const { data: senderData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newMsg.sender_id)
            .maybeSingle();
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, { ...newMsg, sender: senderData as Profile }];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'polls', filter: `room_id=eq.${activeRoom.id}` },
        () => loadPolls(activeRoom.id)
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `room_id=eq.${activeRoom.id}` },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'typing', filter: `room_id=eq.${activeRoom.id}` }, presence.onTypingEvent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_reads', filter: `room_id=eq.${activeRoom.id}` }, presence.onReadEvent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_message_reactions', filter: `room_id=eq.${activeRoom.id}` }, () => {
        apiPost<ChatReaction[]>('/api/chat/reactions', { room_id: activeRoom.id }).then(({ data }) => { if (data) setReactionRows(data); });
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeRoom, loadMessages, loadPolls, profile?.id, presence.onTypingEvent, presence.onReadEvent]);

  // Leaving a room drops files that were picked but not sent
  useEffect(() => {
    clearStaged();
    setShowAttach(false);
    setReactionRows([]);
    setReactionPickerFor(null);
  }, [activeRoom?.id, clearStaged]);

  activeRef.current = activeRoom;

  // What this person may type in the open room (and whether they are muted in it)
  useEffect(() => {
    setCmdInfo(null);
    setShowHelp(false);
    if (activeRoom) refreshCmdInfo(activeRoom.id);
  }, [activeRoom?.id, refreshCmdInfo]);

  // A mute ends by itself: look again when it runs out, so the message box unlocks without a reload
  const muteEnds = cmdInfo?.mute?.expires_at ?? null;
  useEffect(() => {
    if (!muteEnds || !activeRoom) return;
    const ms = new Date(muteEnds).getTime() - Date.now() + 500;
    const id = window.setTimeout(() => refreshCmdInfo(activeRoom.id), Math.min(Math.max(ms, 0), 2_000_000_000));
    return () => window.clearTimeout(id);
  }, [muteEnds, activeRoom, refreshCmdInfo]);

  // Bans, mutes, kicks and unbans, live. Everyone who can see the room gets a line in the chat;
  // the person it is about is also moved out of a room they were banned from.
  useEffect(() => {
    if (!profile) return;
    const me = profile.id;
    const channel = supabase
      .channel('sanctions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_sanctions' }, (payload) => {
        const e = payload.new as SanctionEvent;
        const mine = e.user_id === me;
        const open = activeRef.current?.id === e.room_id;
        if (open && e.actor_id !== me) addNotice({ roomId: e.room_id, tone: 'mod', text: mine ? describeSanctionForTarget(e) : describeSanction(e) });
        if (!mine) return;
        loadRooms();
        if (e.action === 'ban' || e.action === 'kick') {
          setBanner(describeSanctionForTarget(e));
          if (open) {
            setActiveRoom(null);
            setMessages([]);
            setMobileChatView(false);
          }
        } else if (e.action === 'unban' || e.action === 'warn') {
          setBanner(describeSanctionForTarget(e));
        }
        if (open && (e.action === 'mute' || e.action === 'unmute')) refreshCmdInfo(e.room_id);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, loadRooms, addNotice, refreshCmdInfo]); // eslint-disable-line react-hooks/exhaustive-deps

  // /slowmode, /lock, /unlock, /pin, /unpin and /clear, live: reload what the room shows and tell everyone else what happened.
  useEffect(() => {
    if (!profile) return;
    const me = profile.id;
    const channel = supabase
      .channel('room-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_settings' }, (payload) => {
        const e = payload.new as RoomSettingsEvent;
        if (activeRef.current?.id !== e.room_id) return;
        refreshCmdInfo(e.room_id);
        if (e.actor_id !== me) addNotice({ roomId: e.room_id, tone: 'mod', text: e.text });
      })
      // the super admin changed who may use a command: reload the help panel and suggestions
      .on('postgres_changes', { event: '*', schema: 'public', table: 'command_permissions' }, () => {
        if (activeRef.current) refreshCmdInfo(activeRef.current.id);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, addNotice, refreshCmdInfo]);

  // The report queue button: only moderators get it, with the number of open reports. Updates live.
  const loadReportSummary = useCallback(async () => {
    const { data } = await apiPost<ReportSummary>('/api/chat/reports/summary', {});
    if (data) setReportSummary(data);
  }, []);
  const setOpenReports = useCallback((open: number) => setReportSummary((prev) => ({ ...prev, open })), []);

  useEffect(() => {
    if (!profile) return;
    loadReportSummary();
    const channel = supabase
      .channel('report-summary')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reports' }, () => loadReportSummary())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, profile?.role, profile?.college_id, profile?.is_verified, profile?.college_role, loadReportSummary]); // eslint-disable-line react-hooks/exhaustive-deps

  // Notices (command replies, moderation lines) scroll into view like messages do
  useEffect(() => {
    const list = listRef.current;
    if (notices.length && list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  }, [notices]);

  // Auto-scroll
  useEffect(() => {
    if (skipAutoScroll.current) {
      skipAutoScroll.current = false;
      return;
    }
    // Scroll only the message list (scrollIntoView would also scroll the whole page)
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const addFiles = (list: FileList | File[]) => {
    const files = Array.from(list);
    if (!files.length) return;
    setSendError(null);
    const tooBig = files.filter((f) => f.size > MAX_FILE_MB * 1024 * 1024);
    const empty = files.filter((f) => f.size === 0);
    const ok = files.filter((f) => f.size > 0 && f.size <= MAX_FILE_MB * 1024 * 1024);
    const room = MAX_FILES_PER_MESSAGE - staged.length;
    const take = ok.slice(0, Math.max(0, room));
    const problems: string[] = [];
    if (tooBig.length) problems.push(`${tooBig.map((f) => f.name).join(', ')} ${tooBig.length > 1 ? 'are' : 'is'} over ${MAX_FILE_MB} MB`);
    if (empty.length) problems.push(`${empty.map((f) => f.name).join(', ')} ${empty.length > 1 ? 'are' : 'is'} empty`);
    if (ok.length > take.length) problems.push(`You can attach up to ${MAX_FILES_PER_MESSAGE} files at once`);
    if (problems.length) setSendError(problems.join('. ') + '.');
    setStaged((prev) => [
      ...prev,
      ...take.map((file) => {
        const kind = kindOfFile(file);
        return {
          key: crypto.randomUUID(),
          file,
          kind,
          preview: kind === 'image' ? URL.createObjectURL(file) : null,
          progress: 0,
          error: null,
        } as StagedFile;
      }),
    ]);
  };

  const patchStaged = (key: string, patch: Partial<StagedFile>) =>
    setStaged((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  const removeStaged = (key: string) =>
    setStaged((prev) => {
      prev.filter((s) => s.key === key).forEach((s) => s.preview && URL.revokeObjectURL(s.preview));
      return prev.filter((s) => s.key !== key);
    });

  const runCommand = async (text: string) => {
    if (!activeRoom) return;
    const roomId = activeRoom.id;
    const { data, error } = await apiPost<CommandResult>('/api/chat/command', { room_id: roomId, text });
    if (error) return addNotice({ roomId, tone: 'error', text: error.message, private: true });
    if (!data) return;
    if (data.panel === 'help') return setShowHelp(true);
    addNotice({ roomId, tone: data.kind === 'success' ? 'success' : 'info', text: data.text ?? '', items: data.items, private: true });
  };

  // People that /ban @... can suggest: whoever has spoken in the loaded part of this room
  const people = Array.from(new Map(messages.filter((m) => m.sender && m.sender_id !== profile?.id).map((m) => [m.sender_id, { id: m.sender_id, name: m.sender?.full_name ?? '' }])).values()).filter((p) => p.name);
  const commandSuggestions = getSuggestions(input, cmdInfo, people);
  // "@" in a normal message: suggest people who can see this room (the server checks that)
  const mentionQuery = input.startsWith('/') ? null : /(?:^|\s)@([\p{L}\p{N}_.'-]*(?: [\p{L}\p{N}_.'-]*)?)$/u.exec(input)?.[1] ?? null;
  const [mentionHits, setMentionHits] = useState<{ id: string; name: string; avatar_url: string | null }[]>([]);
  const mentionRoomId = activeRoom?.id;
  useEffect(() => {
    if (mentionQuery === null || !mentionRoomId) { setMentionHits([]); return; }
    let live = true;
    const t = setTimeout(async () => {
      const { data } = await apiPost<{ id: string; name: string; avatar_url: string | null }[]>('/api/chat/mentions', { room_id: mentionRoomId, q: mentionQuery });
      if (live) setMentionHits(data ?? []);
    }, 150);
    return () => { live = false; clearTimeout(t); };
  }, [mentionQuery, mentionRoomId]);
  const mentionSuggestions: Suggestion[] = mentionQuery === null ? [] : mentionHits.map((p) => ({
    key: p.id, label: p.name, hint: 'Mention', locked: false,
    apply: (text: string) => `${text.slice(0, text.lastIndexOf('@'))}@${p.name} `,
  }));
  const suggestions = commandSuggestions.length ? commandSuggestions : mentionSuggestions;
  const visibleMessages = messageSearch.trim() ? messages.filter((m) => `${m.content} ${m.sender?.full_name ?? ''}`.toLowerCase().includes(messageSearch.trim().toLowerCase())) : messages;
  const pickSuggestion = (s: Suggestion) => setInput(s.apply(input));

  const toggleMessageReaction = async (messageId: string, emoji: string) => {
    const { error } = await apiPost('/api/chat/reaction', { message_id: messageId, emoji });
    if (error) setSendError(error.message);
    setReactionPickerFor(null);
    if (activeRoom) {
      const { data } = await apiPost<ChatReaction[]>('/api/chat/reactions', { room_id: activeRoom.id });
      if (data) setReactionRows(data);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom || !profile || sending) return;
    const text = input.trim();
    if (!text && staged.length === 0) return;
    setSendError(null);
    presence.stopTyping(activeRoom.id);

    // a command: /help, /ban @name 1d reason ... (two slashes send a normal message that starts with a slash)
    if (staged.length === 0 && text.startsWith('/') && !text.startsWith('//')) {
      setInput('');
      await runCommand(text);
      return;
    }

    if (cmdInfo?.mute) {
      const until = cmdInfo.mute.expires_at ? `until ${formatWhen(cmdInfo.mute.expires_at)}` : 'permanently';
      setSendError(`You are muted ${until}. You can still use commands such as /help.`);
      return;
    }

    // plain text message
    if (staged.length === 0) {
      const body = text.startsWith('//') ? text.slice(1) : text;
      setInput('');
      const { error } = await supabase
        .from('messages')
        .insert({ room_id: activeRoom.id, sender_id: profile.id, content: body, reply_to_id: replyingTo?.id ?? null });
      if (error) {
        setInput(text);
        setSendError(error.message);
      } else {
        setReplyingTo(null);
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
      const { error } = await supabase
        .from('messages')
        .insert({ room_id: activeRoom.id, sender_id: profile.id, content: caption, attachment_url: up.data.url, reply_to_id: replyingTo?.id ?? null });
      if (error) {
        patchStaged(item.key, { error: error.message });
        setSendError(`${item.file.name}: ${error.message}`);
        break;
      }
      if (caption) {
        caption = '';
        setInput('');
      }
      removeStaged(item.key);
      setReplyingTo(null);
    }
    setSending(false);
  };

  const pickFrom = (ref: React.RefObject<HTMLInputElement>) => {
    setShowAttach(false);
    ref.current?.click();
  };

  const deleteMessage = async (id: string) => {
    await supabase.from('messages').delete().eq('id', id);
  };

  const deleteRoom = async () => {
    if (!activeRoom) return;
    if (!window.confirm(`Delete "${activeRoom.name}" and all of its messages? This cannot be undone.`)) return;
    const { data } = await supabase.from('chat_rooms').delete().eq('id', activeRoom.id).select('id');
    if (!data || data.length === 0) {
      window.alert('You are not allowed to delete this room.');
      return;
    }
    setActiveRoom(null);
    setMessages([]);
    setMobileChatView(false);
    loadRooms();
  };

  // Leave a room from its header: private rooms (if you are not the creator) and, for website admins, global and college rooms they joined.
  const leaveAdminRoom = async () => {
    if (!activeRoom || !window.confirm('Leave this room? It will disappear from your list. You can join again with the room code.')) return;
    const { error } = await apiPost('/api/chat/room/leave', { room_id: activeRoom.id });
    if (error) return setSendError(error.message);
    setActiveRoom(null);
    setMobileChatView(false);
    loadRooms();
  };

  const openRoom = (room: ChatRoom) => {
    setShowMembers(false);
    setActiveRoom(room);
    setMobileChatView(true);
  };

  // Opened from the new-user guide with a room to show (once the room list has loaded)
  useEffect(() => {
    if (!initialRoomId || rooms.length === 0) return;
    const room = rooms.find((r) => r.id === initialRoomId);
    if (room) {
      openRoom(room);
      onInitialRoomHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoomId, rooms]);

  // First visit: open the built-in global "General" room so nobody lands on an empty page. Desktop only (on a phone the
  // room list is the start screen), and only once, so it never overrides a room the person picked themselves.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current || initialRoomId || activeRef.current || rooms.length === 0) return;
    autoOpened.current = true;
    if (typeof window !== 'undefined' && window.innerWidth < 1024) return;
    const general = rooms.find((r) => (r as ChatRoom & { system_key?: string | null }).system_key === 'general');
    if (general) setActiveRoom(general);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, initialRoomId]);

  const codeChanged = (roomId: string, code: string) => {
    setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, room_code: code } : r)));
    setActiveRoom((prev) => (prev && prev.id === roomId ? { ...prev, room_code: code } : prev));
  };

  const canSeeCollegeChats = isGlobalAdmin(profile) || (!!profile?.is_verified && !!profile?.college_id);

  const filteredRooms = rooms.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  const roomIcon = (type: string) => {
    if (type === 'global') return <Globe className="w-4 h-4 text-brand-500" />;
    if (type === 'private') return <Lock className="w-4 h-4 text-slate-400" />;
    return <Hash className="w-4 h-4 text-accent-500" />;
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    // Fill the available app content area. The room list and message history scroll independently;
    // the room sidebar, chat toolbar/status area, and composer stay anchored in place.
    <div className="h-full min-h-0 flex overflow-hidden">
      {/* Rooms sidebar */}
      <div className={`chat-room-sidebar w-72 shrink-0 min-h-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col ${mobileChatView ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading font-semibold text-slate-900 dark:text-slate-100">Chat Rooms</h2>
            <div className="flex items-center gap-1.5">
              {reportSummary.can_review && (
                <button
                  onClick={() => setShowReports(true)}
                  title={reportSummary.open ? `${reportSummary.open} open report${reportSummary.open === 1 ? '' : 's'}` : 'Reports'}
                  className="relative w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  <ShieldAlert className="w-4 h-4" />
                  {reportSummary.open > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center">
                      {reportSummary.open > 99 ? '99+' : reportSummary.open}
                    </span>
                  )}
                </button>
              )}
              <button
                onClick={() => setShowJoin(true)}
                title="Join with a room code"
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-500/10 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
              >
                <KeyRound className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowCreate(true)}
                title="Create a room"
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10 hover:bg-brand-100 dark:hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rooms..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          {!canSeeCollegeChats && (
            <div className="mt-3 flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2">
              <BadgeCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-brand-500" />
              <div>
                <p>You can see global chats. Get verified for your college to see its college chats.</p>
                <button onClick={() => setGuideStep(profile?.college_id ? 2 : 1)} className="mt-1 font-medium text-brand-600 dark:text-brand-400 hover:underline">
                  {profile?.college_id ? 'Get verified' : 'Choose your college'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="chat-room-list min-h-0 flex-1 overflow-y-auto scrollbar-thin p-2 space-y-0.5">
          {filteredRooms.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No rooms found
            </div>
          ) : (
            filteredRooms.map((room) => (
              <button
                key={room.id}
                onClick={() => openRoom(room)}
                className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all ${
                  activeRoom?.id === room.id
                    ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-900 dark:text-brand-100'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="mt-0.5 shrink-0">{roomIcon(room.room_type)}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{room.name}</p>
                  {room.description && (
                    <p className="text-xs text-slate-400 truncate">{room.description}</p>
                  )}
                  {room.college && (
                    <p className="text-[10px] text-slate-400 mt-0.5">{room.college.name}</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div
        className={`relative flex-1 min-w-0 min-h-0 flex flex-col bg-slate-50 dark:bg-slate-950 ${mobileChatView ? 'flex' : 'hidden lg:flex'}`}
        onDragOver={(e) => { if (activeRoom && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true); } }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (activeRoom && e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
      >
        {dragOver && activeRoom && (
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
        {!activeRoom ? (
          profile ? (
            <GettingStarted
              profile={profile}
              quickRooms={rooms.filter((r) => r.room_type === 'global').slice(0, 3)}
              onOpenStep={setGuideStep}
              onOpenRoom={openRoom}
            />
          ) : null
        ) : (
          <>
            {/* Chat header */}
            <div className="chat-room-header flex-none h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 gap-3">
              <button onClick={() => setMobileChatView(false)} className="lg:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <ArrowLeft className="w-5 h-5" />
              </button>
              {roomIcon(activeRoom.room_type)}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">{activeRoom.name}</h3>
                <p className="text-xs text-slate-400 truncate">
                  {roomScope(activeRoom)}{activeRoom.description ? ` · ${activeRoom.description}` : ''}
                </p>
              </div>
              <RoomCodeChip
                room={activeRoom}
                canRegenerate={canEditRoom(profile, activeRoom) || isGlobalAdmin(profile)}
                onRegenerated={(code) => codeChanged(activeRoom.id, code)}
              />
              <ReceiptToggle on={shareReceipts} onChange={setShareReceipts} />
              <button onClick={() => { setMessageSearchOpen((v) => !v); setMessageSearch(''); }} title="Search messages" aria-label="Search messages"
                className="p-2 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                <Search className="w-4 h-4" />
              </button>
              <button onClick={() => setShowHelp(true)} title="Chat commands (/help)" aria-label="Chat commands"
                className="p-2 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                <HelpCircle className="w-4 h-4" />
              </button>
              {activeRoom.room_type === 'private' && (
                <button onClick={() => setShowMembers(true)} title="Members"
                  className="p-2 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                  <Users className="w-4 h-4" />
                </button>
              )}
              {profile && (activeRoom.room_type === 'private' ? activeRoom.created_by !== profile.id : isGlobalAdmin(profile)) && (
                <button onClick={leaveAdminRoom} title="Leave room" aria-label="Leave room"
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors">
                  <LogOut className="w-4 h-4" />
                </button>
              )}
              {canEditRoom(profile, activeRoom) && (
                <button onClick={() => setEditingRoom(true)} title="Edit room"
                  className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              {canDeleteRoom(profile, activeRoom) && (
                <button onClick={deleteRoom} title="Delete room"
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="chat-room-status flex-none"><RoomStatusBar info={cmdInfo} /></div>
            {messageSearchOpen && (
              <div className="chat-message-search flex-none px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input autoFocus value={messageSearch} onChange={(e) => setMessageSearch(e.target.value)} placeholder="Search loaded messages…" className="w-full pl-9 pr-9 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
                  <button type="button" onClick={() => { setMessageSearch(''); setMessageSearchOpen(false); }} aria-label="Close message search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X className="w-4 h-4" /></button>
                </div>
                {messageSearch.trim() && <p className="text-[11px] text-slate-400 mt-1">{visibleMessages.length} match{visibleMessages.length === 1 ? '' : 'es'} in loaded messages</p>}
              </div>
            )}

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
              {visibleMessages.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  {messageSearch.trim() ? 'No matching messages in the loaded history.' : 'No messages yet. Start the conversation!'}
                </div>
              ) : (
                visibleMessages.map((msg) => {
                  const isOwn = msg.sender_id === profile?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-2.5 animate-fade-in ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      <button
                        type="button"
                        onClick={() => setInfoUserId(msg.sender_id)}
                        title="View info"
                        className="rounded-full shrink-0 hover:ring-2 hover:ring-brand-300 transition-shadow"
                      >
                        <Avatar name={msg.sender?.full_name} url={msg.sender?.avatar_url} fallbackClass={isOwn ? 'bg-brand-500' : 'bg-slate-400'} />
                      </button>
                      <div className={`group max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <button
                            type="button"
                            onClick={() => setInfoUserId(msg.sender_id)}
                            title="View info"
                            className="text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 hover:underline"
                          >
                            {isOwn ? 'You' : msg.sender?.full_name ?? 'Unknown'}
                          </button>
                          {rankLabel(msg.sender) && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-accent-100 dark:bg-accent-500/20 text-accent-700 dark:text-accent-300">
                              {rankLabel(msg.sender)}
                            </span>
                          )}
                          <UserBadges userId={msg.sender_id} max={2} />
                          <span className="text-[10px] text-slate-400">{formatTime(msg.created_at)}</span>
                        </div>
                        {msg.reply_to_id && (() => { const original = messages.find((m) => m.id === msg.reply_to_id); return (
                          <div className="mb-1 max-w-full border-l-2 border-brand-400 bg-brand-50/70 dark:bg-brand-500/10 rounded-r-lg px-2.5 py-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                            <span className="font-semibold text-brand-700 dark:text-brand-300">Replying to {original?.sender_id === profile?.id ? 'you' : original?.sender?.full_name ?? 'a message'}</span>
                            <p className="truncate max-w-[280px]">{original?.content || (original ? 'Attachment' : 'Original message not loaded')}</p>
                          </div>
                        ); })()}
                        <MessageBody
                          msg={msg}
                          isOwn={isOwn}
                          poll={polls[msg.id]}
                          canManagePoll={canModerateMessage(profile, activeRoom, msg)}
                          onOpenImage={(url, name) => setViewer({ url, name })}
                          onPollChanged={(p) => setPolls((prev) => ({ ...prev, [p.message_id]: p }))}
                        />
                        {(() => {
                          const ownReactions = reactionRows.filter((r) => r.message_id === msg.id);
                          const grouped = REACTION_OPTIONS.map((emoji) => ({ emoji, count: ownReactions.filter((r) => r.emoji === emoji).length, mine: ownReactions.some((r) => r.emoji === emoji && r.user_id === profile?.id) })).filter((r) => r.count > 0);
                          return (grouped.length > 0 || reactionPickerFor === msg.id) ? (
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              {grouped.map((r) => <button key={r.emoji} type="button" onClick={() => toggleMessageReaction(msg.id, r.emoji)} title={`${r.count} reaction${r.count === 1 ? '' : 's'}`} className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${r.mine ? 'border-brand-300 bg-brand-50 dark:border-brand-500/50 dark:bg-brand-500/15' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}>{r.emoji} {r.count}</button>)}
                              {reactionPickerFor === msg.id && REACTION_OPTIONS.filter((emoji) => !grouped.some((r) => r.emoji === emoji)).map((emoji) => <button key={emoji} type="button" onClick={() => toggleMessageReaction(msg.id, emoji)} aria-label={`React ${emoji}`} className="rounded-full px-1.5 py-1 text-sm hover:bg-brand-50 dark:hover:bg-slate-800">{emoji}</button>)}
                            </div>
                          ) : null;
                        })()}
                        {presence.lastSeenId === msg.id && <SeenLine readers={presence.seenBy(msg)} />}
                        <div className="flex items-center gap-2.5 mt-1">
                          <button onClick={() => setReactionPickerFor((current) => current === msg.id ? null : msg.id)} title="Add reaction" aria-label="Add reaction" className="opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100 text-slate-400 hover:text-brand-600 transition-opacity"><SmilePlus className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { setReplyingTo(msg); messageInputRef.current?.focus(); }} title="Reply to message" aria-label="Reply to message" className="opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100 text-slate-400 hover:text-brand-600 transition-opacity">
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          {(isOwn || canModerateMessage(profile, activeRoom, msg)) && (
                            <button
                              onClick={() => deleteMessage(msg.id)}
                              title={isOwn ? 'Delete message' : 'Remove message'}
                              className="opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!isOwn && (
                            <button
                              onClick={() => setReportTarget({ id: msg.id, author: msg.sender?.full_name ?? 'Unknown' })}
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
              {notices.filter((n) => n.roomId === activeRoom.id).map((n) => (
                <NoticeRow key={n.id} notice={n} onDismiss={() => setNotices((prev) => prev.filter((x) => x.id !== n.id))} />
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="chat-typing-strip flex-none"><TypingLine names={presence.typers} /></div>

            {/* Input */}
            <form onSubmit={sendMessage} className="chat-composer flex-none relative p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
              {replyingTo && (
                <div className="mb-2 flex items-center gap-2 rounded-xl border border-brand-200 dark:border-brand-500/30 bg-brand-50/70 dark:bg-brand-500/10 px-3 py-2 text-xs">
                  <MessageSquare className="w-4 h-4 text-brand-600 dark:text-brand-300 shrink-0" />
                  <div className="min-w-0 flex-1"><p className="font-semibold text-brand-700 dark:text-brand-300">Replying to {replyingTo.sender_id === profile?.id ? 'yourself' : replyingTo.sender?.full_name ?? 'message'}</p><p className="truncate text-slate-500 dark:text-slate-400">{replyingTo.content || 'Attachment'}</p></div>
                  <button type="button" onClick={() => setReplyingTo(null)} aria-label="Cancel reply" className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X className="w-4 h-4" /></button>
                </div>
              )}
              <SuggestionList items={suggestions} onPick={pickSuggestion} />
              {cmdInfo?.mute && (
                <div className="mb-2 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-3 py-2">
                  <VolumeX className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    You are muted {cmdInfo.mute.expires_at ? `until ${formatWhen(cmdInfo.mute.expires_at)}` : 'permanently'}. You can read, but not post.
                    {cmdInfo.mute.reason ? ` Reason: ${cmdInfo.mute.reason}` : ''}
                  </span>
                </div>
              )}
              {staged.length > 0 && <StagedFiles items={staged} disabled={sending} onRemove={removeStaged} />}
              {sendError && (
                <div className="mb-2 flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2">
                  <span className="flex-1">{sendError}</span>
                  <button type="button" onClick={() => setSendError(null)} aria-label="Dismiss"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowAttach((v) => !v)}
                    disabled={sending || !!cmdInfo?.mute}
                    title="Attach"
                    aria-label="Attach"
                    className="w-10 h-10 flex items-center justify-center rounded-full text-slate-500 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  {showAttach && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowAttach(false)} />
                      <div className="absolute bottom-12 left-0 z-20 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg p-1.5 animate-fade-in">
                        {[
                          { label: 'Photos', icon: ImageIcon, color: 'text-purple-500', onClick: () => pickFrom(photoInput) },
                          { label: 'Videos', icon: Film, color: 'text-rose-500', onClick: () => pickFrom(videoInput) },
                          { label: 'File', icon: FileText, color: 'text-brand-500', onClick: () => pickFrom(fileInput) },
                          { label: 'Poll', icon: BarChart3, color: 'text-accent-500', onClick: () => { setShowAttach(false); setShowPoll(true); } },
                        ].map(({ label, icon: Icon, color, onClick }) => (
                          <button
                            key={label}
                            type="button"
                            onClick={onClick}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Icon className={`w-4 h-4 ${color}`} /> {label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
                  <input ref={videoInput} type="file" accept="video/*" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
                  <input ref={fileInput} type="file" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
                </div>
                <input
                  ref={messageInputRef}
                  type="text"
                  value={input}
                  onChange={(e) => { setInput(e.target.value); presence.notifyTyping(e.target.value); }}
                  onPaste={(e) => {
                    if (e.clipboardData.files.length) {
                      e.preventDefault();
                      addFiles(e.clipboardData.files);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab' && suggestions.length > 0) {
                      e.preventDefault();
                      pickSuggestion(suggestions[0]);
                    }
                  }}
                  placeholder={cmdInfo?.mute ? 'You are muted. Commands such as /help still work' : staged.length ? 'Add a caption...' : 'Type a message, or / for commands'}
                  maxLength={4000}
                  className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
                <button
                  type="submit"
                  disabled={sending || (!input.trim() && staged.length === 0)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white transition-colors shrink-0"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      {infoUserId && <UserInfoModal userId={infoUserId} onClose={() => setInfoUserId(null)} />}
      {viewer && <ImageViewer url={viewer.url} name={viewer.name} onClose={() => setViewer(null)} />}
      {showHelp && (
        <HelpPanel
          info={cmdInfo}
          onClose={() => setShowHelp(false)}
          onTry={(text) => { setInput(text); setShowHelp(false); }}
        />
      )}
      {showPoll && activeRoom && <CreatePollModal roomId={activeRoom.id} onClose={() => setShowPoll(false)} />}

      {editingRoom && activeRoom && (
        <EditRoomModal
          room={activeRoom}
          onClose={() => setEditingRoom(false)}
          onSaved={(updated) => { setActiveRoom(updated); loadRooms(); setEditingRoom(false); }}
        />
      )}

      {/* Create room modal */}
      {showCreate && profile && (
        <CreateRoomModal
          userId={profile.id}
          collegeId={profile.college_id}
          canCollege={canSeeCollegeChats}
          canGlobal={isGlobalAdmin(profile)}
          onClose={() => setShowCreate(false)}
          onCreated={(room) => { loadRooms(); if (room) openRoom(room); setShowCreate(false); }}
        />
      )}

      {reportTarget && <ReportMessageModal messageId={reportTarget.id} authorName={reportTarget.author} onClose={() => setReportTarget(null)} />}
      {showReports && <ReportQueueModal onClose={() => { setShowReports(false); loadReportSummary(); }} onCount={setOpenReports} />}

      {/* Private room members */}
      {showMembers && activeRoom && profile && (
        <RoomMembersModal
          room={activeRoom}
          viewerId={profile.id}
          canManage={activeRoom.created_by === profile.id || isGlobalAdmin(profile)}
          onClose={() => setShowMembers(false)}
          onLeft={() => { setShowMembers(false); setActiveRoom(null); setMobileChatView(false); loadRooms(); }}
        />
      )}

      {/* Getting-started guide (opened from the panel or the hint above the room list) */}
      {guideStep && (
        <OnboardingWizard
          initialStep={guideStep}
          onClose={() => setGuideStep(null)}
          onFinish={(room) => { setGuideStep(null); loadRooms(); if (room) openRoom(room); }}
        />
      )}

      {/* Join with a code */}
      {showJoin && (
        <JoinByCodeModal
          onClose={() => setShowJoin(false)}
          onJoined={(room) => { loadRooms(); openRoom(room); setShowJoin(false); }}
        />
      )}
    </div>
  );
}

function CreateRoomModal({
  userId,
  collegeId,
  canCollege,
  canGlobal,
  onClose,
  onCreated,
}: {
  userId: string;
  collegeId: string | null;
  canCollege: boolean;
  canGlobal: boolean;
  onClose: () => void;
  onCreated: (room?: ChatRoom) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [roomType, setRoomType] = useState<'global' | 'college' | 'private'>(canCollege ? 'college' : 'private');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const roomData: Record<string, unknown> = {
      name,
      description: description || null,
      room_type: roomType,
      created_by: userId,
    };

    if (roomType === 'college') {
      if (!collegeId || !canCollege) {
        setError('You need to be verified for a college to create a college chat. Choose your college in your profile and request verification first.');
        setLoading(false);
        return;
      }
      roomData.college_id = collegeId;
    }

    const { data, error } = await supabase.from('chat_rooms').insert(roomData).select('*, college:colleges(*)');
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    onCreated((data as ChatRoom[] | null)?.[0]);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-semibold text-lg text-slate-900 dark:text-slate-100">Create Chat Room</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Room Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Tech Club Meetup"
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this room about?"
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Room Type</label>
            <div className="space-y-2">
              <label className={`flex items-center gap-3 px-3 py-2.5 border rounded-xl transition-all ${
                !canCollege ? 'opacity-50 cursor-not-allowed border-slate-200 dark:border-slate-800' : 'cursor-pointer'
              } ${
                roomType === 'college' ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}>
                <input type="radio" name="roomType" value="college" disabled={!canCollege} checked={roomType === 'college'} onChange={() => setRoomType('college')} className="sr-only" />
                <Hash className="w-4 h-4 text-accent-500" />
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">College Chat</p>
                  <p className="text-xs text-slate-400">{canCollege ? 'Only verified students of your college can see it' : 'Get verified for your college first'}</p>
                </div>
              </label>
              <label className={`flex items-center gap-3 px-3 py-2.5 border rounded-xl cursor-pointer transition-all ${
                roomType === 'private' ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}>
                <input type="radio" name="roomType" value="private" checked={roomType === 'private'} onChange={() => setRoomType('private')} className="sr-only" />
                <Lock className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Private Room</p>
                  <p className="text-xs text-slate-400">Only people you give the 6-digit code to</p>
                </div>
              </label>
              {canGlobal && (
              <label className={`flex items-center gap-3 px-3 py-2.5 border rounded-xl cursor-pointer transition-all ${
                roomType === 'global' ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}>
                <input type="radio" name="roomType" value="global" checked={roomType === 'global'} onChange={() => setRoomType('global')} className="sr-only" />
                <Globe className="w-4 h-4 text-brand-500" />
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Global Chat</p>
                  <p className="text-xs text-slate-400">Everyone can see it, across all colleges</p>
                </div>
              </label>
              )}
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
              <><Plus className="w-4 h-4" /> Create Room</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function EditRoomModal({
  room,
  onClose,
  onSaved,
}: {
  room: ChatRoom;
  onClose: () => void;
  onSaved: (room: ChatRoom) => void;
}) {
  const [name, setName] = useState(room.name);
  const [description, setDescription] = useState(room.description ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('chat_rooms')
      .update({ name: name.trim(), description: description.trim() || null })
      .eq('id', room.id)
      .select('*, college:colleges(*)');
    setLoading(false);
    if (error) return setError(error.message);
    if (!data || data.length === 0) return setError('You are not allowed to edit this room');
    onSaved(data[0] as ChatRoom);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-semibold text-lg text-slate-900 dark:text-slate-100">Edit Room</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Room Name</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Description (optional)</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
          </div>
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2">
              {error}
            </div>
          )}
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
