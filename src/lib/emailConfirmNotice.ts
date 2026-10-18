// The emailed confirmation link ends on the website as /?email_confirmed=<outcome>.
// This reads the outcome once, removes it from the address bar, and remembers it for the rest of the page's life
// (so React's double rendering in development cannot lose it).
const MESSAGES: Record<string, { ok: boolean; text: string }> = {
  confirmed: { ok: true, text: 'Email confirmed. If it is your college email, your college is verified automatically.' },
  already: { ok: true, text: 'This email address was already confirmed.' },
  expired: { ok: false, text: 'That confirmation link has expired. Sign in and press "Resend email" to get a new one.' },
  invalid: { ok: false, text: 'That confirmation link is no longer valid (it may have been replaced, or the email address was changed). Sign in and press "Resend email" to get a new one.' },
};

let cached: { ok: boolean; text: string } | null | undefined;

export function emailConfirmNotice(): { ok: boolean; text: string } | null {
  if (cached !== undefined) return cached;
  cached = null;
  try {
    const url = new URL(window.location.href);
    const outcome = url.searchParams.get('email_confirmed');
    if (outcome) {
      cached = MESSAGES[outcome] ?? MESSAGES.invalid;
      url.searchParams.delete('email_confirmed');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }
  } catch {
    /* no window: nothing to read */
  }
  return cached;
}
