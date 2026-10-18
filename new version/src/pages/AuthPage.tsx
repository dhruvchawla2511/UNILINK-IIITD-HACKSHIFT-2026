import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { emailConfirmNotice } from '@/lib/emailConfirmNotice';
import { Loader2, Mail, Lock, User, ArrowRight, Sun, Moon, MessageSquare, CalendarDays, Building2, BadgeCheck, GraduationCap, BriefcaseBusiness, Lightbulb, Users } from 'lucide-react';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export default function AuthPage() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [selectedPortal, setSelectedPortal] = useState<'student' | 'teacher' | 'recruiter' | 'founder'>('student');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [confirmNotice] = useState(() => emailConfirmNotice());

  // Build-time value first; otherwise the server's runtime setting (GOOGLE_CLIENT_ID in .env / host settings).
  const [clientId, setClientId] = useState<string>((import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '');
  useEffect(() => {
    if (clientId) return;
    let alive = true;
    fetch('/api/config').then((r) => (r.ok ? r.json() : null)).then((c) => { if (alive && c?.googleClientId) setClientId(c.googleClientId); }).catch(() => {});
    return () => { alive = false; };
  }, [clientId]);

  useEffect(() => {
    if (!clientId || !googleButtonRef.current) return;
    let cancelled = false;
    const render = () => {
      if (cancelled || !googleButtonRef.current || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential?: string }) => {
          if (!response.credential) return;
          setError(null); setLoading(true);
          const result = await signInWithGoogle(response.credential);
          if (result.error) setError(result.error);
          setLoading(false);
        },
      });
      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleButtonRef.current, { theme: theme === 'dark' ? 'filled_black' : 'outline', size: 'large', shape: 'rectangular', text: mode === 'signup' ? 'signup_with' : 'signin_with', width: 340, logo_alignment: 'left' });
    };
    if (window.google?.accounts?.id) render();
    else {
      let script = document.querySelector<HTMLScriptElement>('script[data-google-identity]');
      if (!script) { script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.defer = true; script.dataset.googleIdentity = 'true'; document.head.appendChild(script); }
      script.addEventListener('load', render);
    }
    return () => { cancelled = true; };
  }, [mode, theme, signInWithGoogle, clientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'signup') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, fullName, selectedPortal);
      if (error) setError(error);
    } else {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    }
    setLoading(false);
  };

  const points = [
    { icon: MessageSquare, text: 'Chat in rooms with students from other colleges' },
    { icon: CalendarDays, text: 'Find fests, workshops and meetups before they fill up' },
    { icon: Building2, text: 'Get verified by your own college to unlock its spaces' },
  ];

  return (
    <div className="h-dvh overflow-hidden grid lg:grid-cols-[1.1fr_1fr] bg-white dark:bg-slate-950">
      <aside className="hidden lg:flex flex-col justify-between relative overflow-hidden bg-brand-950 text-white p-14">
        <div className="absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-brand-600/40 blur-3xl" />
        <div className="absolute -bottom-40 -right-20 w-[26rem] h-[26rem] rounded-full bg-accent-500/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <img src="/logo.png" alt="" className="w-10 h-10 object-contain" />
          <span className="font-heading text-xl font-semibold">Unilink</span>
        </div>
        <div className="relative max-w-lg">
          <h1 className="font-heading text-5xl font-semibold leading-[1.05]">Your campus is only the start.</h1>
          <p className="mt-5 text-lg text-brand-100/80 leading-relaxed">Meet people, join conversations and find opportunities across every college on Unilink.</p>
          <ul className="mt-10 space-y-4">
            {points.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3.5 text-brand-50">
                <span className="w-10 h-10 shrink-0 rounded-xl bg-white/10 flex items-center justify-center"><Icon className="w-5 h-5 text-brand-200" /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative mt-6 max-w-lg">
          <p className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-brand-200">Choose your portal</p>
          <div className="grid grid-cols-2 gap-3">
            {[{ id: 'teacher', label: 'Teacher portal', text: 'Mentor & guide', icon: GraduationCap }, { id: 'recruiter', label: 'Recruiter portal', text: 'Find talent', icon: BriefcaseBusiness }, { id: 'founder', label: 'Founder portal', text: 'Build & hire', icon: Lightbulb }, { id: 'student', label: 'Student portal', text: 'Campus community', icon: Users }].map(({ id, label, text, icon: Icon }) => <button key={id} type="button" onClick={() => setSelectedPortal(id as typeof selectedPortal)} className={`rounded-2xl border p-3 text-left transition ${selectedPortal === id ? 'border-white bg-white/15 ring-1 ring-white/60' : 'border-white/15 bg-white/5 hover:bg-white/10'}`}><Icon className="mb-2 h-5 w-5 text-brand-200"/><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block text-xs text-brand-100/70">{text}</span></button>)}
          </div>
        </div>
        <p className="relative mt-5 text-sm text-brand-200/60">Connect Beyond Campus</p>
      </aside>

      <main className="relative min-h-0 overflow-y-auto overscroll-contain scrollbar-thin">
        <button onClick={toggleTheme} className="fixed top-4 right-4 z-10 p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="Toggle dark mode">
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-amber-300" />}
        </button>
        <div className="flex min-h-full items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <img src="/logo.png" alt="" className="w-9 h-9 object-contain" />
            <span className="font-heading text-lg font-semibold">Unilink</span>
          </div>
          <h2 className="font-heading text-3xl font-semibold">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400 text-sm">
            {mode === 'signup' ? 'Already have one?' : 'New to Unilink?'}{' '}
            <button type="button" onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(null); }} className="font-semibold text-brand-600 dark:text-brand-400 hover:underline">
              {mode === 'signup' ? 'Sign in' : 'Create an account'}
            </button>
          </p>

          {confirmNotice && (
            <div role="status" className={`mt-5 rounded-xl border p-3 text-sm ${confirmNotice.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'}`}>
              {confirmNotice.text}{confirmNotice.ok ? ' Sign in to continue.' : ''}
            </div>
          )}
          {mode === 'signup' && (
            <div className="mt-5">
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">I’m joining as</label>
              <div className="grid grid-cols-2 gap-2">
                {[{ id: 'student', label: 'Student', icon: Users }, { id: 'teacher', label: 'Teacher', icon: GraduationCap }, { id: 'recruiter', label: 'Recruiter', icon: BriefcaseBusiness }, { id: 'founder', label: 'Founder', icon: Lightbulb }].map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setSelectedPortal(id as typeof selectedPortal)} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${selectedPortal === id ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300' : 'border-slate-200 text-slate-600 hover:border-brand-300 dark:border-slate-700 dark:text-slate-300'}`}><Icon className="h-4 w-4"/>{label}</button>)}
              </div>
              {selectedPortal !== 'student' && <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">Your account will open a dedicated professional workspace. Student tools stay out of this portal, and you can switch to the student side any time.</p>}
            </div>
          )}
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/60 dark:bg-emerald-950/30 p-3.5 flex items-start gap-3">
              <BadgeCheck className="w-5 h-5 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Use your official college email</p>
                <p className="mt-1 text-xs leading-relaxed text-emerald-800/80 dark:text-emerald-300/80">Once your email is confirmed, Unilink can automatically verify your college account when its domain is registered in our college directory. Personal email addresses may need manual verification.</p>
              </div>
            </div>
            <div ref={googleButtonRef} className="flex justify-center min-h-10" aria-label="Continue with Google" />
            {!clientId && <p className="text-xs text-center text-slate-400">Google sign-in needs a Google OAuth client ID in the environment settings.</p>}
            <div className="flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200 dark:bg-slate-700"/><span>or continue with email</span><span className="h-px flex-1 bg-slate-200 dark:bg-slate-700"/></div>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Full name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" className="w-full pl-10 pr-3 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm placeholder:text-slate-400 focus:border-brand-500 transition-colors" />
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@college.edu" className="w-full pl-10 pr-3 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm placeholder:text-slate-400 focus:border-brand-500 transition-colors" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="w-full pl-10 pr-3 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm placeholder:text-slate-400 focus:border-brand-500 transition-colors" />
              </div>
            </div>

            {error && (
              <div role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3.5 py-2.5 animate-fade-in">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-brand-600/25">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{mode === 'signup' ? 'Create account' : 'Sign in'}<ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        </div>
        </div>
      </main>
    </div>
  );
}
