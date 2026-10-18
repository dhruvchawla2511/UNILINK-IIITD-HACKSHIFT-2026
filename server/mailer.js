// Sends transactional email (currently only address confirmation) through the Resend HTTP API,
// so no extra npm package is needed. Configure RESEND_API_KEY and MAIL_FROM (see .env.example).
// Without them, outside production the message is printed to the server console so you can still test;
// in production nothing is printed (links are credentials) and a warning explains what is missing.
let warned = false;

export const mailConfigured = () => !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

export async function sendMail({ to, subject, text }) {
  if (!mailConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      if (!warned) console.warn('[mail] RESEND_API_KEY / MAIL_FROM are not set: confirmation emails cannot be sent, so nobody can be verified by email.');
      warned = true;
    } else {
      console.log(`\n[mail:dev] To: ${to}\n[mail:dev] Subject: ${subject}\n${text}\n`);
    }
    return { sent: false };
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Mail provider answered ${response.status}`);
  return { sent: true };
}
