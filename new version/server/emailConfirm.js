// Proving that a person owns their email address. Signing up (or changing email) mails a one-time link;
// opening it sets users.email_confirmed_at and then runs the college-domain check (collegeEmail.js).
import crypto from 'node:crypto';
import { db } from './db.js';
import { HttpError } from './rest.js';
import { sendMail } from './mailer.js';
import { syncCollegeEmailVerification } from './collegeEmail.js';

const TOKEN_TTL_MS = 24 * 3600_000;
const RESEND_COOLDOWN_MS = 60_000;
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const lastSent = new Map(); // userId -> time of the last email

// Where the emailed link points. Set APP_URL to the public address of the website (with Vite in development
// that is http://localhost:5173, which proxies /api to this server).
const baseUrl = () => (process.env.APP_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/+$/, '');

/** Creates a fresh link for this address; earlier unused links for the person stop working. */
function createConfirmation(userId, email) {
  const token = crypto.randomBytes(32).toString('hex');
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM email_confirmations WHERE user_id = ? AND used_at IS NULL').run(userId);
    db.prepare('DELETE FROM email_confirmations WHERE expires_at < ?').run(new Date(Date.now() - 7 * 86400_000).toISOString());
    db.prepare('INSERT INTO email_confirmations (token_hash, user_id, email, expires_at) VALUES (?, ?, ?, ?)')
      .run(sha256(token), userId, email.toLowerCase(), new Date(Date.now() + TOKEN_TTL_MS).toISOString());
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return token;
}

/** Creates the link and emails it in the background. Never throws: signing up must not fail because mail is down. */
export function queueConfirmationEmail(userId, email) {
  try {
    const token = createConfirmation(userId, email);
    lastSent.set(userId, Date.now());
    const link = `${baseUrl()}/api/auth/confirm-email?token=${token}`;
    sendMail({
      to: email,
      subject: 'Confirm your email for Unilink',
      text: `Welcome to Unilink!\n\nConfirm that this is your email address:\n${link}\n\nThe link works once and expires in 24 hours. If you did not create a Unilink account, ignore this email.`,
    }).catch((e) => console.error('[mail] could not send confirmation email:', e.message));
  } catch (e) {
    console.error('[mail] could not create confirmation:', e.message);
  }
}

/** Handles the emailed link. Returns 'confirmed' | 'already' | 'expired' | 'invalid'. */
export function confirmEmailToken(token) {
  if (!/^[0-9a-f]{64}$/.test(String(token ?? ''))) return 'invalid';
  const row = db.prepare('SELECT * FROM email_confirmations WHERE token_hash = ?').get(sha256(token));
  if (!row) return 'invalid';
  const u = db.prepare('SELECT id, email, email_confirmed_at FROM users WHERE id = ?').get(row.user_id);
  // The address may have been changed since this email was sent: the old link must not confirm the new address.
  if (!u || u.email.toLowerCase() !== row.email) return 'invalid';
  if (row.used_at) return u.email_confirmed_at ? 'already' : 'invalid';
  if (row.expires_at < new Date().toISOString()) return 'expired';
  const now = new Date().toISOString();
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE email_confirmations SET used_at = ? WHERE token_hash = ?').run(now, row.token_hash);
    db.prepare('UPDATE users SET email_confirmed_at = ? WHERE id = ?').run(now, u.id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  syncCollegeEmailVerification(u.id);
  return 'confirmed';
}

/** POST /api/auth/resend-confirmation for the signed-in person. */
export function resendConfirmation(user) {
  const u = db.prepare('SELECT id, email, email_confirmed_at FROM users WHERE id = ?').get(user.id);
  if (!u) throw new HttpError('Not signed in', 401);
  if (u.email_confirmed_at) return { data: { already_confirmed: true } };
  if (Date.now() - (lastSent.get(u.id) ?? 0) < RESEND_COOLDOWN_MS) throw new HttpError('A confirmation email was just sent. Please wait a minute before asking again.', 429);
  queueConfirmationEmail(u.id, u.email);
  return { data: { sent: true } };
}
