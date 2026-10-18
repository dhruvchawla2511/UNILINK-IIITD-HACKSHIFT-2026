// End-to-end check of college email verification against a throwaway database:
//   npm run test:college-email
// Starts the real server on a spare port with a temporary database and a fake Google token endpoint (no network needed).
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'unilink-test-'));
const dbFile = path.join(tmp, 'test.db');
const PORT = 3900 + Math.floor(Math.random() * 90);
const base = `http://127.0.0.1:${PORT}`;

// Unit checks of the domain matcher first (uses the same temp database).
process.env.CAMPUSCONNECT_DB = dbFile;
process.env.CAMPUSCONNECT_LOGOS = path.join(tmp, 'logos');
const { normalizeDomain, emailDomain, findCollegeForEmail } = await import('../server/collegeEmail.js');
assert.equal(normalizeDomain('https://www.Example.EDU/admissions?x=1'), 'example.edu');
assert.equal(normalizeDomain('www.iitd.ac.in'), 'iitd.ac.in');
assert.equal(normalizeDomain('iitd.ac.in:443'), 'iitd.ac.in');
assert.equal(normalizeDomain('student@iitd.ac.in'), '');
assert.equal(normalizeDomain('localhost'), '');
assert.equal(emailDomain('A@Students.Example.edu'), 'students.example.edu');
assert.equal(emailDomain('a@b@c.edu'), '');
assert.equal(emailDomain('nodomain'), '');
assert.equal(findCollegeForEmail('teacher@coeptech.ac.in')?.name, 'COEP Technological University', 'seeded official email-domain aliases should resolve to their college');
assert.equal(findCollegeForEmail('teacher@gmail.com'), null, 'public mail providers must never resolve to a college');
console.log('ok  domain normalization and seeded institutional aliases');

// A preload that fakes Google's tokeninfo endpoint: the "credential" is base64 JSON describing the Google account.
const preload = path.join(tmp, 'fake-google.mjs');
fs.writeFileSync(preload, `
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.startsWith('https://oauth2.googleapis.com/tokeninfo')) {
    const token = new URL(u).searchParams.get('id_token');
    const body = JSON.parse(Buffer.from(token, 'base64url').toString());
    return new Response(JSON.stringify(body), { status: 200 });
  }
  return realFetch(url, init);
};`);

const server = spawn(process.execPath, ['--import', preload, path.join(root, 'scripts', 'server.mjs')], {
  cwd: root,
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', APP_URL: base, GOOGLE_CLIENT_ID: 'test-client', RESEND_API_KEY: '', MAIL_FROM: '', NODE_ENV: 'test' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
server.stdout.on('data', (d) => (log += d));
server.stderr.on('data', (d) => (log += d));
const stop = () => { server.kill(); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ } };
process.on('exit', stop);

for (let i = 0; i < 100 && !log.includes('Unilink server:'); i++) await new Promise((r) => setTimeout(r, 100));
assert.ok(log.includes('Unilink server:'), `server did not start:\n${log}`);

const db = new DatabaseSync(dbFile);
const post = async (p, body, token) => {
  const r = await fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json() };
};
const linkFor = (email) => {
  const re = new RegExp(`To: ${email.replace(/[.+]/g, '\\$&')}\\n[^\\n]*\\n[\\s\\S]*?(${base}/api/auth/confirm-email\\?token=[0-9a-f]+)`, 'g');
  const all = [...log.matchAll(re)];
  return all.length ? all[all.length - 1][1] : null;
};
const wait = () => new Promise((r) => setTimeout(r, 150));
const profile = (email) => db.prepare('SELECT p.* FROM profiles p JOIN users u ON u.id = p.id WHERE u.email = ?').get(email);
const open = async (link) => { const r = await fetch(link, { redirect: 'manual' }); return { status: r.status, loc: r.headers.get('location') }; };
const google = (account) => post('/api/auth/google', { credential: Buffer.from(JSON.stringify({ aud: 'test-client', iss: 'https://accounts.google.com', email_verified: 'true', ...account })).toString('base64url') });

try {
  const college = db.prepare("SELECT id, name, domain FROM colleges WHERE domain IS NOT NULL AND trim(domain) <> '' LIMIT 1").get();
  assert.ok(college, 'seed data should contain a college with a domain');
  const dom = college.domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
  db.prepare("INSERT INTO colleges (id, name, domain) VALUES ('c-www', 'WWW College', 'https://www.wwwcollege.edu/')").run();
  db.prepare("INSERT INTO colleges (id, name, domain) VALUES ('c-pub', 'Public Mail College', 'gmail.com')").run();
  db.prepare("INSERT INTO colleges (id, name, domain) VALUES ('c-d1', 'Dup One', 'dup.example.org')").run();
  db.prepare("INSERT INTO colleges (id, name, domain) VALUES ('c-d2', 'Dup Two', 'DUP.example.org')").run();

  // first account becomes the admin; not part of the checks
  assert.equal((await post('/api/auth/signup', { email: 'owner@owner-mail.test', password: 'secret123', full_name: 'Owner' })).status, 200);

  // 1. password sign-up: unconfirmed, NOT verified, email sent
  const s1 = `student1@${dom}`;
  const r1 = await post('/api/auth/signup', { email: s1, password: 'secret123', full_name: 'S One' });
  assert.equal(r1.status, 200);
  assert.equal(r1.json.user.email_confirmed, false);
  await wait();
  assert.equal(profile(s1).is_verified, 0, 'typing a college address must not verify anyone');
  assert.equal(profile(s1).college_id, null);
  console.log('ok  sign-up with a college address does not verify before confirmation');

  // 2. confirmation link verifies + assigns the college; reuse is harmless
  const link1 = linkFor(s1);
  assert.ok(link1, `confirmation email for ${s1} not found in:\n${log}`);
  const o1 = await open(link1);
  assert.equal(o1.status, 302);
  assert.equal(o1.loc, '/?email_confirmed=confirmed');
  assert.equal(profile(s1).is_verified, 1);
  assert.equal(profile(s1).college_id, college.id);
  assert.equal((await open(link1)).loc, '/?email_confirmed=already');
  const me = await fetch(base + '/api/auth/user', { headers: { Authorization: `Bearer ${r1.json.session.access_token}` } });
  assert.equal((await me.json()).user.email_confirmed, true);
  console.log('ok  confirmed college email verifies and assigns the college');

  // 3. bad / malformed tokens
  assert.equal((await open(`${base}/api/auth/confirm-email?token=${'0'.repeat(64)}`)).loc, '/?email_confirmed=invalid');
  assert.equal((await open(`${base}/api/auth/confirm-email?token=abc`)).loc, '/?email_confirmed=invalid');
  console.log('ok  invalid tokens rejected');

  // 4. www./https:// in colleges.domain is normalized
  const s2 = 'kid@wwwcollege.edu';
  await post('/api/auth/signup', { email: s2, password: 'secret123', full_name: 'WWW Kid' });
  await wait();
  await open(linkFor(s2));
  assert.equal(profile(s2).college_id, 'c-www');
  assert.equal(profile(s2).is_verified, 1);
  console.log('ok  "https://www." domains match');

  // 5. public mail providers never verify, even if an admin registered one
  const s3 = 'someone@gmail.com';
  await post('/api/auth/signup', { email: s3, password: 'secret123', full_name: 'Gmail User' });
  await wait();
  await open(linkFor(s3));
  assert.equal(profile(s3).is_verified, 0);
  console.log('ok  gmail.com is never trusted');

  // 6. two colleges on one domain: refuse to guess
  const s4 = 'x@dup.example.org';
  await post('/api/auth/signup', { email: s4, password: 'secret123', full_name: 'Dup' });
  await wait();
  await open(linkFor(s4));
  assert.equal(profile(s4).is_verified, 0);
  console.log('ok  ambiguous domain is left for manual verification');

  // 7. changing email: unconfirmed again, old link dead, no verification before confirming the new address
  const pw = (await post('/api/auth/signin', { email: s3, password: 'secret123' })).json.session.access_token;
  const oldLink = link1;
  const ch = await post('/api/auth/change-email', { new_email: `moved@${dom}`, current_password: 'secret123' }, pw);
  assert.equal(ch.status, 200);
  await wait();
  assert.equal(db.prepare("SELECT email_confirmed_at FROM users WHERE email = ?").get(`moved@${dom}`).email_confirmed_at, null);
  assert.equal(profile(`moved@${dom}`).is_verified, 0, 'unconfirmed new address must not verify');
  assert.equal((await open(oldLink)).loc, '/?email_confirmed=already'); // an already-used link stays harmless
  await open(linkFor(`moved@${dom}`));
  assert.equal(profile(`moved@${dom}`).is_verified, 1);
  console.log('ok  changing email requires re-confirmation');

  // 8. resend: requires sign-in and is rate-limited per person
  assert.equal((await post('/api/auth/resend-confirmation', {})).status, 401);
  const s5 = `resend@${dom}`;
  const r5 = await post('/api/auth/signup', { email: s5, password: 'secret123', full_name: 'Resend' });
  const res1 = await post('/api/auth/resend-confirmation', {}, r5.json.session.access_token);
  assert.equal(res1.status, 429, 'a second email within a minute is refused');
  console.log('ok  resend needs sign-in and is rate limited');

  // 9. Google: confirmed from the start, verifies on a college domain
  const g1 = await google({ email: `guser@${dom}`, name: 'G User' });
  assert.equal(g1.status, 200);
  assert.equal(profile(`guser@${dom}`).is_verified, 1);
  assert.equal(profile(`guser@${dom}`).college_id, college.id);
  const gp = await google({ email: 'plain@gmail.com', name: 'Plain' });
  assert.equal(profile('plain@gmail.com').is_verified, 0);
  assert.equal(gp.json.user.email_confirmed, true);
  console.log('ok  Google sign-in verifies college domains only');

  // 10. Google rejects wrong audience / unverified email
  const bad1 = await google({ email: 'a@b.edu', aud: 'someone-else' });
  assert.equal(bad1.status, 401);
  const bad2 = await google({ email: 'a@b.edu', email_verified: 'false' });
  assert.equal(bad2.status, 401);
  console.log('ok  Google credentials with wrong audience / unverified email rejected');

  // 11. pre-hijack: attacker registered the victim's address with a password first
  const victim = `victim@${dom}`;
  const atk = await post('/api/auth/signup', { email: victim, password: 'attackerpw', full_name: 'Attacker' });
  assert.equal(atk.status, 200);
  assert.equal(profile(victim).is_verified, 0);
  const owner = await google({ email: victim, name: 'Real Owner' });
  assert.equal(owner.status, 200);
  assert.equal((await post('/api/auth/signin', { email: victim, password: 'attackerpw' })).status, 400, 'attacker password must stop working');
  const stale = await fetch(base + '/api/auth/user', { headers: { Authorization: `Bearer ${atk.json.session.access_token}` } });
  assert.equal(stale.status, 401, 'attacker session must be revoked');
  assert.equal(profile(victim).is_verified, 1);
  console.log('ok  pre-registered account is taken over safely by the Google owner');

  console.log('\nAll college email verification checks passed.');
} catch (e) {
  console.error('\nFAILED:', e.message);
  console.error('--- server log ---\n' + log.slice(-2500));
  process.exitCode = 1;
} finally {
  db.close();
  stop();
}
