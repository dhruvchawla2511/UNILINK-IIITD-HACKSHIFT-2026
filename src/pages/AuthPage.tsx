import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Loader2, Mail, Lock, User, ArrowRight, Sun, Moon, MessageSquare, CalendarDays, Building2 } from 'lucide-react';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      const { error } = await signUp(email, password, fullName);
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
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-white dark:bg-slate-950">
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
        <p className="relative text-sm text-brand-200/60">Connect Beyond Campus</p>
      </aside>

      <main className="relative flex items-center justify-center p-6 sm:p-10">
        <button onClick={toggleTheme} className="absolute top-4 right-4 p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="Toggle dark mode">
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-amber-300" />}
        </button>
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

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
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
      </main>
    </div>
  );
}
