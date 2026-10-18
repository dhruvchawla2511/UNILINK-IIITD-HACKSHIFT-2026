// Automatic college verification from a CONFIRMED email address.
//
// A person is verified for a college only when ALL of these hold:
//   1. the owner of the address has proven it (users.email_confirmed_at is set: emailed link, or Google
//      reporting the address as verified),
//   2. the address domain exactly equals the domain an admin registered for exactly one college
//      (colleges.domain), after removing "https://", paths and a leading "www.", and
//   3. the domain is not a public mail provider (gmail.com and similar).
// Anything else stays in the normal manual verification flow. Subdomains are NOT matched on purpose:
// register the domain students actually use (for example "students.example.edu" if that is the mail domain).
import { db } from './db.js';
import { ensureLobby } from './defaultRooms.js';

// Free providers anyone can register on. They can never prove a college affiliation, even if an admin
// accidentally typed one into colleges.domain.
export const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.in', 'yahoo.co.in', 'ymail.com', 'outlook.com', 'outlook.in',
  'hotmail.com', 'hotmail.co.uk', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me',
  'protonmail.com', 'pm.me', 'zoho.com', 'gmx.com', 'gmx.net', 'mail.com', 'yandex.com', 'yandex.ru', 'rediffmail.com',
  'fastmail.com', 'tutanota.com', 'tuta.io', 'hey.com',
]);

const DOMAIN_RE = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** "https://www.IITD.ac.in/admissions" -> "iitd.ac.in". Returns '' when the value is not a usable domain. */
export function normalizeDomain(raw) {
  let d = String(raw ?? '').trim().toLowerCase();
  if (!d || d.includes('@')) return ''; // an email address is not a domain
  d = d.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').split(/[/?#]/)[0].replace(/:\d+$/, '').replace(/\.$/, '').replace(/^www\./, '');
  return DOMAIN_RE.test(d) ? d : '';
}

/** Domain part of an email address, or '' when the address is malformed. */
export function emailDomain(email) {
  const parts = String(email ?? '').trim().toLowerCase().split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return '';
  return normalizeDomain(parts[1]);
}

/** The single college registered for this address's domain, else null (no match, ambiguous, or public provider). */
export function findCollegeForEmail(email) {
  const domain = emailDomain(email);
  if (!domain || PUBLIC_EMAIL_DOMAINS.has(domain)) return null;
  const legacyMatches = db
    .prepare("SELECT id, name, domain FROM colleges WHERE domain IS NOT NULL AND trim(domain) <> ''")
    .all()
    .filter((c) => normalizeDomain(c.domain) === domain);
  const aliasMatches = db.prepare(
    `SELECT c.id, c.name, ced.domain FROM college_email_domains ced
       JOIN colleges c ON c.id = ced.college_id WHERE lower(ced.domain) = ?`
  ).all(domain);
  // Deduplicate a college matching through both its website domain and an explicit email-domain alias.
  const matches = [...new Map([...legacyMatches, ...aliasMatches].map((c) => [c.id, c])).values()];
  // Two colleges claiming one domain are ambiguous, so refuse to guess, leave it to manual verification.
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Verifies the person for the matching college when their (confirmed) email allows it.
 * Reads the address and its confirmation from the database, never from the caller. People who are already
 * verified are left alone, so manual approvals are never overwritten.
 * Returns { verified, changed, college_id?, reason? }.
 */
export function syncCollegeEmailVerification(userId) {
  const u = db.prepare('SELECT id, email, email_confirmed_at FROM users WHERE id = ?').get(String(userId ?? ''));
  if (!u) return { verified: false, changed: false, reason: 'no-user' };
  if (!u.email_confirmed_at) return { verified: false, changed: false, reason: 'unconfirmed' };
  const profile = db.prepare('SELECT college_id, is_verified FROM profiles WHERE id = ?').get(u.id);
  if (!profile) return { verified: false, changed: false, reason: 'no-profile' };
  if (profile.is_verified) return { verified: true, changed: false, college_id: profile.college_id };
  const college = findCollegeForEmail(u.email);
  if (!college) return { verified: false, changed: false, reason: 'no-match' };

  db.exec('BEGIN');
  try {
    db.prepare('UPDATE profiles SET college_id = ?, is_verified = 1 WHERE id = ?').run(college.id, u.id);
    // A manual request for this college is now settled; do not leave it waiting for an officer.
    db.prepare("UPDATE verifications SET status = 'approved', resolved_at = ? WHERE user_id = ? AND college_id = ? AND status = 'pending'")
      .run(new Date().toISOString(), u.id, college.id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  ensureLobby(college.id);
  return { verified: true, changed: true, college_id: college.id };
}
