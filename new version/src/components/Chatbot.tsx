import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Bot, Check, Copy, ExternalLink, RotateCcw, Send, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { GREETING, SUGGESTIONS, getReply, type BotPage, type Reply } from '@/lib/chatbotAnswers';
import { collegeAnswer, fetchWikipedia, loadColleges, matchColleges } from '@/lib/collegeInfo';
import { apiPost } from '@/lib/supabase';

interface Msg {
  from: 'bot' | 'me';
  text: string;
  page?: Reply['page'];
  /** A source link shown under the message (for example the Wikipedia article) */
  link?: { url: string; label: string };
  image?: string;
  createdAt?: number;
}

const STORAGE_KEY = 'unilink-helper-chat';
const START: Msg[] = [{ from: 'bot', text: GREETING, createdAt: Date.now() }];

function load(): Msg[] {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    const parsed = saved ? (JSON.parse(saved) as Msg[]) : null;
    return parsed && parsed.length ? parsed : START;
  } catch {
    return START;
  }
}

export default function Chatbot({ onNavigate, currentPage }: { onNavigate?: (page: BotPage) => void; currentPage?: string }) {
  const onConversationPage = currentPage === 'chat' || currentPage === 'messages';
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(load);
  const [followUps, setFollowUps] = useState<string[]>(SUGGESTIONS);
  const [copied, setCopied] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Record<number, 'up' | 'down' | undefined>>({});
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<number>();
  const request = useRef(0); // lets a new chat ignore an answer that was still loading

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing, open]);

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40))); } catch { /* storage unavailable */ }
  }, [messages]);

  // Let feature cards open the assistant without coupling the feature hub to its internal state.
  useEffect(() => {
    const openAssistant = () => setOpen(true);
    window.addEventListener('unilink:open-assistant', openAssistant);
    return () => window.removeEventListener('unilink:open-assistant', openAssistant);
  }, []);

  // Focus the box when the helper opens; Escape closes it.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const answer = (msg: Msg, next: string[], id: number) => {
    if (id !== request.current) return; // the chat was reset meanwhile
    setMessages((m) => [...m, { ...msg, createdAt: msg.createdAt ?? Date.now() }]);
    setFollowUps(next);
    setTyping(false);
    inputRef.current?.focus();
  };

  const ask = (text: string) => {
    const q = text.trim();
    if (!q || typing) return;
    const id = ++request.current;
    setMessages((m) => [...m, { from: 'me', text: q, createdAt: Date.now() }]);
    setInput('');
    setFollowUps([]);
    setTyping(true);

    // Is this about a college in the directory? Then show what Unilink has plus a Wikipedia summary.
    loadColleges().then(async (colleges) => {
      const found = matchColleges(q, colleges);
      if (found?.kind === 'one') {
        const wiki = await fetchWikipedia(found.college);
        answer(
          {
            from: 'bot',
            text: collegeAnswer(found.college, wiki, !wiki),
            page: { id: 'colleges', label: 'Open Colleges' },
            link: wiki ? { url: wiki.url, label: 'Read on Wikipedia' } : undefined,
            image: wiki?.thumbnail,
          },
          ['How do I get verified?', 'Show me events', 'Tips to prepare for placements'],
          id
        );
        return;
      }
      if (found?.kind === 'many') {
        answer(
          { from: 'bot', text: 'I found a few colleges that match. Which one do you mean? Tap a name, or type it in full.' },
          found.colleges.map((c) => c.name),
          id
        );
        return;
      }
      // Use a configured server-side AI provider when available. If it is not configured or is temporarily
      // unavailable, fall back to the built-in UniLink guidance rather than leaving the student without help.
      const history = messages.slice(-8).map((m) => ({ role: m.from === 'bot' ? 'assistant' as const : 'user' as const, content: m.text }));
      const ai = await apiPost<{ answer: string }>('/api/assistant', { question: q, messages: history });
      if (id !== request.current) return;
      if (ai.data?.answer) {
        answer({ from: 'bot', text: ai.data.answer }, ['How do I get verified?', 'Help me plan my week', 'How do I stay safe on the marketplace?'], id);
        return;
      }
      const reply = getReply(q);
      const delay = Math.min(250 + reply.text.length * 2, 900);
      timer.current = window.setTimeout(() => answer({ from: 'bot', text: reply.text, page: reply.page }, reply.followUps, id), delay);
    }).catch(() => {
      // Never leave the helper stuck in its typing state if a lookup unexpectedly fails.
      answer({ from: 'bot', text: 'I hit a temporary problem while checking that. Please try again, or ask me about chat rooms, verification, events, studying, or placements.' }, SUGGESTIONS.slice(0, 4), id);
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  const reset = () => {
    window.clearTimeout(timer.current);
    request.current++;
    setTyping(false);
    setMessages([{ from: 'bot', text: GREETING, createdAt: Date.now() }]);
    setFeedback({});
    setFollowUps(SUGGESTIONS);
    setInput('');
  };

  const copy = async (text: string, i: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      window.setTimeout(() => setCopied((c) => (c === i ? null : c)), 1500);
    } catch { /* clipboard blocked */ }
  };

  const go = (page: BotPage) => {
    onNavigate?.(page);
    setOpen(false);
  };

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Unilink helper"
          className={`fixed z-50 ${onConversationPage ? 'bottom-28 right-3 sm:right-5 h-[min(26rem,calc(100dvh-13rem))]' : 'bottom-24 right-3 sm:right-5 h-[min(36rem,calc(100dvh-8rem))]'} w-[calc(100vw-1.5rem)] sm:w-[25rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up`}
        >
          <div className="flex items-center gap-2.5 px-4 py-3 bg-brand-600 text-white">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center ring-1 ring-white/20">
              <Bot className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-heading font-semibold text-sm leading-tight">UniLink Assistant</p>
              <p className="text-[11px] text-white/80 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" /> Study plans · campus life · app help
              </p>
            </div>
            <button onClick={reset} aria-label="Start a new chat" title="New chat" className="text-white/80 hover:text-white">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button onClick={() => setOpen(false)} aria-label="Close helper" className="text-white/80 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 scrollbar-thin bg-gradient-to-b from-slate-50/70 to-white dark:from-slate-950/50 dark:to-slate-900" aria-live="polite">
            {messages.map((m, i) => (
              <div key={`${m.createdAt ?? i}-${i}`} className={`flex flex-col ${m.from === 'me' ? 'items-end' : 'items-start'}`}>
                <div className="group relative max-w-[88%]">
                  <div
                    className={`px-3 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed shadow-sm ${
                      m.from === 'me'
                        ? 'bg-brand-600 text-white rounded-br-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-sm border border-slate-200/80 dark:border-slate-700'
                    }`}
                  >
                    {m.image && (
                      <img src={m.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full max-h-40 object-cover rounded-xl mb-2 bg-white" />
                    )}
                    {m.text}
                  </div>
                  <div className={`mt-1 flex items-center gap-1.5 text-[10px] text-slate-400 ${m.from === 'me' ? 'justify-end pr-1' : 'pl-1'}`}>
                    <span>{new Date(m.createdAt ?? Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {m.from === 'bot' && i > 0 && <>
                      <button onClick={() => setFeedback((f) => ({ ...f, [i]: f[i] === 'up' ? undefined : 'up' }))} aria-label="Helpful answer" title="Helpful" className={`rounded p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 ${feedback[i] === 'up' ? 'text-emerald-600' : ''}`}><ThumbsUp className="w-3 h-3" /></button>
                      <button onClick={() => setFeedback((f) => ({ ...f, [i]: f[i] === 'down' ? undefined : 'down' }))} aria-label="Not helpful" title="Not helpful" className={`rounded p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 ${feedback[i] === 'down' ? 'text-rose-500' : ''}`}><ThumbsDown className="w-3 h-3" /></button>
                    </>}
                  </div>
                  {m.from === 'bot' && i > 0 && (
                    <button
                      onClick={() => copy(m.text, i)}
                      aria-label="Copy answer"
                      className="absolute -right-1 -bottom-2 w-6 h-6 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    >
                      {copied === i ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
                {m.link && (
                  <a
                    href={m.link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full border border-brand-200 dark:border-brand-500/30 text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-500/10"
                  >
                    {m.link.label} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {m.page && (
                  <button
                    onClick={() => go(m.page!.id)}
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full bg-brand-600 text-white hover:bg-brand-700 transition-colors"
                  >
                    {m.page.label} <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="px-3 py-3 rounded-2xl rounded-bl-sm bg-slate-100 dark:bg-slate-800 flex gap-1" aria-label="Helper is typing">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}
            {!typing && followUps.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1" aria-label="Suggested questions">
                {followUps.map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    className="text-xs px-3 py-2 rounded-xl border border-brand-200 dark:border-brand-500/30 bg-white/80 dark:bg-slate-800/80 text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <p className="px-3 pt-2 text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">AI can make mistakes. Verify important details and never share passwords, verification codes, or private student records.</p>
          <form onSubmit={submit} className="flex items-center gap-2 p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask UniLink anything…"
              maxLength={500}
              aria-label="Message UniLink Assistant"
              className="min-w-0 flex-1 px-3.5 py-3 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
            />
            <button
              type="submit"
              disabled={!input.trim() || typing}
              aria-label="Send"
              className="w-10 h-10 shrink-0 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-sm hover:bg-brand-700 disabled:opacity-40 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close helper' : 'Open helper'}
        className={`fixed z-50 ${onConversationPage ? 'bottom-28 right-4' : 'bottom-5 right-4'} w-14 h-14 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white shadow-xl shadow-brand-600/30 flex items-center justify-center transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-brand-500/30`}
      >
        {open ? <X className="w-5 h-5" /> : <span className="relative"><Bot className="w-6 h-6" /><Sparkles className="w-3 h-3 absolute -right-2 -top-1" /></span>}
      </button>
    </>
  );
}
