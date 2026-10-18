import { useEffect, useState } from 'react';
import { BadgeCheck, Loader2, Mail, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiPost } from '@/lib/supabase';
import { emailConfirmNotice } from '@/lib/emailConfirmNotice';

/** Result of opening the emailed link, plus a reminder (with "Resend email") while the address is unconfirmed. */
export default function EmailConfirmationBanner() {
  const { user, refreshProfile } = useAuth();
  const [notice, setNotice] = useState(() => emailConfirmNotice());
  const [busy, setBusy] = useState(false);
  const [resendMsg, setResendMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const unconfirmed = user?.email_confirmed === false;

  // Opened the link on this device: the notice is shown once, then the status is re-read so the reminder disappears.
  useEffect(() => {
    if (notice?.ok) refreshProfile();
  }, [notice, refreshProfile]);

  // The link may have been opened in another tab or on a phone: re-check when the person comes back here.
  useEffect(() => {
    if (!unconfirmed) return;
    const check = () => { if (document.visibilityState === 'visible') refreshProfile(); };
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, [unconfirmed, refreshProfile]);

  const resend = async () => {
    setBusy(true); setResendMsg(null);
    const { data, error } = await apiPost<{ sent?: boolean; already_confirmed?: boolean }>('/api/auth/resend-confirmation', {});
    setBusy(false);
    if (error) setResendMsg({ ok: false, text: error.message });
    else if (data?.already_confirmed) { setResendMsg({ ok: true, text: 'Your email is already confirmed.' }); refreshProfile(); }
    else setResendMsg({ ok: true, text: 'Confirmation email sent. Check your inbox and spam folder.' });
  };

  if (!notice && !unconfirmed) return null;
  return (
    <div className="space-y-2 px-4 pt-3 sm:px-6">
      {notice && (
        <div role="status" className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${notice.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'}`}>
          {notice.ok && <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />}
          <p className="flex-1">{notice.text}</p>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="shrink-0 opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>
        </div>
      )}
      {unconfirmed && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <Mail className="h-4 w-4 shrink-0" />
          <p className="min-w-0 flex-1">Confirm <span className="font-semibold break-all">{user?.email}</span> using the link we emailed you. If it is your college email, confirming it verifies your college automatically.</p>
          <button type="button" onClick={resend} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Resend email
          </button>
          {resendMsg && <p className={`w-full text-xs ${resendMsg.ok ? '' : 'text-red-700 dark:text-red-300'}`}>{resendMsg.text}</p>}
        </div>
      )}
    </div>
  );
}
