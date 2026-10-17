import { useState } from 'react';
import { CheckCircle2, KeyRound, Loader2, Mail } from 'lucide-react';
import { apiPost } from '@/lib/supabase';

const input = 'w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30';
const label = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5';
const button = 'flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors';

function Status({ error, done }: { error: string | null; done: string | null }) {
  if (error) return <div role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2">{error}</div>;
  if (done) return <p className="text-sm text-accent-600 dark:text-accent-400 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {done}</p>;
  return null;
}

/** Change sign-in email and password. Both ask for the current password. */
export function AccountSecurity({ email, onEmailChanged }: { email: string; onEmailChanged: () => Promise<void> | void }) {
  const [newEmail, setNewEmail] = useState('');
  const [emailPw, setEmailPw] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [emailDone, setEmailDone] = useState<string | null>(null);

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwDone, setPwDone] = useState<string | null>(null);

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailErr(null); setEmailDone(null); setEmailBusy(true);
    const { error } = await apiPost('/api/auth/change-email', { new_email: newEmail, current_password: emailPw });
    setEmailBusy(false);
    if (error) { setEmailErr(error.message); return; }
    setNewEmail(''); setEmailPw('');
    setEmailDone('Email updated. Use it the next time you sign in.');
    await onEmailChanged();
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwErr(null); setPwDone(null);
    if (newPw !== confirmPw) { setPwErr('The new passwords do not match'); return; }
    setPwBusy(true);
    const { error } = await apiPost('/api/auth/change-password', { current_password: curPw, new_password: newPw });
    setPwBusy(false);
    if (error) { setPwErr(error.message); return; }
    setCurPw(''); setNewPw(''); setConfirmPw('');
    setPwDone('Password changed. Your other devices have been signed out.');
  };

  return (
    <div className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-8">
      <form onSubmit={submitEmail} className="space-y-4">
        <h3 className="font-heading font-semibold text-slate-900 dark:text-slate-100">Change email</h3>
        <p className="text-xs text-slate-400">Current email: {email}</p>
        <div>
          <label htmlFor="new-email" className={label}>New email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input id="new-email" type="email" required autoComplete="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={`${input} pl-10`} />
          </div>
        </div>
        <div>
          <label htmlFor="email-pw" className={label}>Current password</label>
          <input id="email-pw" type="password" required autoComplete="current-password" value={emailPw} onChange={(e) => setEmailPw(e.target.value)} className={input} />
        </div>
        <Status error={emailErr} done={emailDone} />
        <button type="submit" disabled={emailBusy} className={button}>
          {emailBusy && <Loader2 className="w-4 h-4 animate-spin" />} Update email
        </button>
      </form>

      <form onSubmit={submitPassword} className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
        <h3 className="font-heading font-semibold text-slate-900 dark:text-slate-100">Change password</h3>
        <div>
          <label htmlFor="cur-pw" className={label}>Current password</label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input id="cur-pw" type="password" required autoComplete="current-password" value={curPw} onChange={(e) => setCurPw(e.target.value)} className={`${input} pl-10`} />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="new-pw" className={label}>New password</label>
            <input id="new-pw" type="password" required minLength={6} autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className={input} />
          </div>
          <div>
            <label htmlFor="confirm-pw" className={label}>Confirm new password</label>
            <input id="confirm-pw" type="password" required minLength={6} autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className={input} />
          </div>
        </div>
        <p className="text-xs text-slate-400">At least 6 characters.</p>
        <Status error={pwErr} done={pwDone} />
        <button type="submit" disabled={pwBusy} className={button}>
          {pwBusy && <Loader2 className="w-4 h-4 animate-spin" />} Change password
        </button>
      </form>
    </div>
  );
}
