// Changing your own sign-in email and password. Both need the current password, so someone who
// finds a signed-in browser cannot take over the account.
import crypto from 'node:crypto';
import { db } from './db.js';
import { HttpError } from './rest.js';
import { hashPassword, verifyPassword } from './auth.js';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Wrong-password guesses are limited per account: 5 misses, then a 15 minute wait.
const MAX_MISSES = 5;
const LOCK_MS = 15 * 60_000;
const misses = new Map(); // userId -> { count, last, until }

function checkCurrentPassword(userId, password) {
  const m = misses.get(userId);
  if (m && m.until > Date.now()) throw new HttpError('Too many wrong passwords. Try again in a few minutes.', 429);
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
  if (!row || !verifyPassword(String(password || ''), row.password_hash)) {
    const count = (m && Date.now() - m.last < LOCK_MS ? m.count : 0) + 1;
    misses.set(userId, { count, last: Date.now(), until: count >= MAX_MISSES ? Date.now() + LOCK_MS : 0 });
    throw new HttpError('Your current password is incorrect', 400);
  }
  misses.delete(userId);
}

/** { current_password, new_password }. Every other signed-in device is signed out. */
export function changePassword(user, token, body) {
  const next = String(body.new_password || '');
  if (next.length < 6) throw new HttpError('New password must be at least 6 characters');
  if (next.length > 200) throw new HttpError('New password is too long');
  checkCurrentPassword(user.id, body.current_password);
  if (next === String(body.current_password)) throw new HttpError('Choose a password you have not used just now');
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), user.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?').run(user.id, sha256(token));
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { data: { ok: true } };
}

/** { new_email, current_password }. Updates the sign-in email and the copy on the profile. */
export function changeEmail(user, body) {
  const mail = String(body.new_email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail) || mail.length > 254) throw new HttpError('Enter a valid email address');
  checkCurrentPassword(user.id, body.current_password);
  if (mail === String(user.email).toLowerCase()) throw new HttpError('That is already your email address');
  if (db.prepare('SELECT 1 FROM users WHERE email = ? AND id <> ?').get(mail, user.id)) throw new HttpError('That email address is already in use', 409);
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE users SET email = ? WHERE id = ?').run(mail, user.id);
    db.prepare('UPDATE profiles SET email = ? WHERE id = ?').run(mail, user.id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { data: { email: mail } };
}
