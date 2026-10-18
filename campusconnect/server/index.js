// Unilink local server: auth, data API, realtime chat. Everything is stored in
// database/campusconnect.db. Run with `npm run server` (or `npm run dev` for server + website).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db, DB_PATH } from './db.js';
import { bearer, createSession, destroySession, hashPassword, publicUser, userFromToken, verifyPassword } from './auth.js';
import { run, HttpError } from './rest.js';
import { visibleRoomSql } from './policies.js';
import { saveUpload, sendFile, sweepUploads, MAX_UPLOAD_MB } from './uploads.js';
import { changeEmail, changePassword } from './account.js';
import { getProfileFields, saveProfileFields } from './profileFields.js';
import { createPoll, votePoll, setPollClosed, listPolls } from './chat.js';
import { joinByCode, regenerateCode, leaveRoom, removeMember } from './rooms.js';
import { resolveVerification } from './verify.js';
import { queueConfirmationEmail, confirmEmailToken, resendConfirmation } from './emailConfirm.js';
import { syncCollegeEmailVerification } from './collegeEmail.js';
import { listCommands, runCommand, powerInRoomId, listCommandPermissions, setCommandPermission } from './commands.js';
import { moderationLog } from './modlog.js';
import { dashboard } from './dashboard.js';
import { setTyping, markRead, listReads } from './presence.js';
import { listReactions, toggleReaction } from './chatReactions.js';
import { startConversation, listConversations, unreadSummary, markSeen, setBlocked, searchPeople, deleteConversation, friendAction, friendLists, setMessagePrivacy } from './dm.js';
import { isDirectRoom } from './dmGuards.js';
import { submitReport, listReports, reportSummary, resolveReport } from './reports.js';
import { resolveCollegeRequest, importColleges, saveLogo, removeLogo, sendLogo } from './colleges.js';
import { handleFeature } from './features.js';
import { collaboration } from './collaboration.js';
import { searchMentions } from './mentions.js';
import { listBadges, lookupBadges, saveBadge, deleteBadge, manageBadges, setBadge, searchPeopleForBadges } from './badges.js';
import { answerWithAI } from './assistant.js';
import { ensureDefaultRooms, ensureGeneralRoom } from './defaultRooms.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
ensureDefaultRooms();
const PORT = Number(process.env.PORT || 3001);
// Bind publicly by default so hosted services can reach the process. Set HOST=127.0.0.1 for local-only use.
const HOST = process.env.HOST || '0.0.0.0';

// Small in-memory abuse guard for credential endpoints. Limits are per IP and reset after the window.
const requestWindows = new Map();
function enforceRateLimit(req, key, limit, windowMs) {
  const ip = req.socket.remoteAddress || 'unknown';
  const id = `${ip}:${key}`;
  const now = Date.now();
  let entry = requestWindows.get(id);
  if (!entry || now - entry.startedAt >= windowMs) entry = { startedAt: now, count: 0 };
  entry.count += 1;
  requestWindows.set(id, entry);
  if (requestWindows.size > 5000) {
    for (const [k, v] of requestWindows) if (now - v.startedAt >= windowMs) requestWindows.delete(k);
  }
  if (entry.count > limit) throw new HttpError('Too many requests. Please wait a little and try again.', 429);
}

// ---------- realtime (Server-Sent Events) ----------
const streams = new Set(); // { res, user }
function broadcast(evt) {
  // Messages of a direct message are announced as 'dm_messages', so the room chat never sees them and they only
  // reach the two people in the conversation (the room-visibility check below).
  if (evt.table === 'messages' && isDirectRoom(evt.new?.room_id ?? evt.old?.room_id)) evt = { ...evt, table: 'dm_messages' };
  for (const s of streams) {
    if (evt.table === 'room_sanctions') {
      // Notices about /ban /mute /kick: the person it is about always gets it (even though a ban hides the room from them),
      // everyone else only if they can still see the room. The reason goes only to the person and to moderators.
      const current = userFromToken(s.token);
      if (!current) continue;
      const mine = current.id === evt.new.user_id;
      if (!mine) {
        const [sql, params] = visibleRoomSql({ user: current });
        if (!db.prepare(`SELECT 1 FROM chat_rooms WHERE id = ? AND ${sql}`).get(evt.new.room_id, ...params)) continue;
      }
      const detailed = mine || powerInRoomId(current, evt.new.room_id) >= 1;
      s.res.write(`data: ${JSON.stringify(detailed ? evt : { ...evt, new: { ...evt.new, reason: null } })}\n\n`);
      continue;
    }
    if (evt.table === 'message_reports') {
      // only moderators of that room hear about reports (and the event carries no message text)
      const current = userFromToken(s.token);
      if (!current || powerInRoomId(current, evt.new.room_id) < 1) continue;
    }
    if (evt.table === 'messages' || evt.table === 'polls' || evt.table === 'room_settings' || evt.table === 'typing' || evt.table === 'room_reads' || evt.table === 'chat_message_reactions' || evt.table === 'dm_messages') {
      const roomId = evt.new?.room_id ?? evt.old?.room_id;
      // Look the person up again each time, so a change of college or verification applies immediately.
      const current = userFromToken(s.token);
      if (!current) continue;
      const [sql, params] = visibleRoomSql({ user: current });
      const ok = db.prepare(`SELECT 1 FROM chat_rooms WHERE id = ? AND ${sql}`).get(roomId, ...params);
      if (!ok) continue;
    }
    s.res.write(`data: ${JSON.stringify(evt)}\n\n`);
  }
}

// ---------- helpers ----------
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 2_000_000) {
        reject(new HttpError('Request too large', 413));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(new HttpError('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}
const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

function sessionResponse(userId, email, emailConfirmed = false) {
  const token = createSession(userId);
  const user = { id: userId, email, email_confirmed: !!emailConfirmed };
  return { session: { access_token: token, user }, user };
}

// ---------- routes ----------
async function handleApi(req, res, url) {
  const route = `${req.method} ${url.pathname}`;

  // Lightweight liveness/readiness endpoint for deployment health checks. Never returns secrets or file paths.
  if (route === 'GET /api/health') {
    db.prepare('SELECT 1 AS ok').get();
    return send(res, 200, { status: 'ok', database: 'ok', timestamp: new Date().toISOString() });
  }

  if (route === 'POST /api/auth/signin' || route === 'POST /api/auth/signup') enforceRateLimit(req, 'auth', 10, 15 * 60 * 1000);

  if (route === 'POST /api/auth/signup') {
    const { email, password, full_name } = await readJson(req);
    const mail = String(email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) throw new HttpError('Enter a valid email address');
    if (String(password || '').length < 6) throw new HttpError('Password must be at least 6 characters');
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(mail)) throw new HttpError('User already registered', 409);
    const id = crypto.randomUUID();
    // The address is NOT confirmed yet: nobody can prove they own it by typing it. They can use the app right away,
    // but college email verification waits until they open the emailed link (server/emailConfirm.js).
    db.prepare('INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)').run(id, mail, hashPassword(password), String(full_name || '').trim());
    ensureGeneralRoom(); // the very first sign-up creates the global General room
    queueConfirmationEmail(id, mail);
    return send(res, 200, sessionResponse(id, mail, false));
  }

  if (route === 'POST /api/auth/google') {
    enforceRateLimit(req, 'google-auth', 10, 15 * 60 * 1000);
    if (!process.env.GOOGLE_CLIENT_ID) throw new HttpError('Google sign-in is not configured on this server', 503);
    const { credential } = await readJson(req);
    if (typeof credential !== 'string' || credential.length < 20 || credential.length > 10000) throw new HttpError('Invalid Google credential');
    let googleUser;
    try {
      const verifyResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
      if (!verifyResponse.ok) throw new Error('Google rejected this credential');
      googleUser = await verifyResponse.json();
    } catch {
      throw new HttpError('Could not verify your Google account. Please try again.', 401);
    }
    if (
      googleUser.aud !== process.env.GOOGLE_CLIENT_ID ||
      String(googleUser.email_verified) !== 'true' ||
      !googleUser.email ||
      !['accounts.google.com', 'https://accounts.google.com'].includes(googleUser.iss)
    ) {
      throw new HttpError('Google account verification failed', 401);
    }
    const mail = String(googleUser.email).trim().toLowerCase();
    const now = new Date().toISOString();
    let existing = db.prepare('SELECT id, email, email_confirmed_at FROM users WHERE email = ?').get(mail);
    if (!existing) {
      const id = crypto.randomUUID();
      const name = String(googleUser.name || mail.split('@')[0]).slice(0, 120);
      // Google proved the address, so it is confirmed from the start. The random password hash cannot be used as a password.
      db.prepare('INSERT INTO users (id, email, password_hash, full_name, email_confirmed_at) VALUES (?, ?, ?, ?, ?)').run(id, mail, hashPassword(crypto.randomBytes(48).toString('hex')), name, now);
      ensureGeneralRoom();
      existing = { id, email: mail };
    } else if (!existing.email_confirmed_at) {
      // Someone may have registered this address with a password before its real owner showed up (nothing proved
      // ownership then). Google has now proven it, so the owner takes the account over: the password that was set
      // by whoever typed the address and every session opened with it stop working.
      db.exec('BEGIN');
      try {
        db.prepare('UPDATE users SET email_confirmed_at = ?, password_hash = ? WHERE id = ?').run(now, hashPassword(crypto.randomBytes(48).toString('hex')), existing.id);
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);
        db.prepare('DELETE FROM email_confirmations WHERE user_id = ?').run(existing.id);
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    }
    // The address is confirmed here, so a college domain match can verify the account (also picks up domains added later).
    syncCollegeEmailVerification(existing.id);
    return send(res, 200, sessionResponse(existing.id, existing.email, true));
  }

  if (route === 'POST /api/auth/signin') {
    const { email, password } = await readJson(req);
    const u = db.prepare('SELECT id, email, email_confirmed_at, password_hash FROM users WHERE email = ?').get(String(email || '').trim().toLowerCase());
    if (!u || !verifyPassword(String(password || ''), u.password_hash)) throw new HttpError('Invalid login credentials', 400);
    return send(res, 200, sessionResponse(u.id, u.email, !!u.email_confirmed_at));
  }

  // The link in the confirmation email. Always answers with a redirect back to the website with the outcome.
  if (route === 'GET /api/auth/confirm-email') {
    enforceRateLimit(req, 'confirm-email', 30, 15 * 60 * 1000);
    const outcome = confirmEmailToken(url.searchParams.get('token'));
    res.writeHead(302, { Location: `/?email_confirmed=${outcome}`, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    return res.end();
  }

  if (route === 'POST /api/auth/signout') {
    const t = bearer(req);
    if (t) destroySession(t);
    return send(res, 200, { ok: true });
  }

  // College logos are part of the public directory: <img> cannot send a token, so no sign-in is needed to view one.
  const logo = /^\/api\/college-logos\/([^/]+)$/.exec(url.pathname);
  if (logo && req.method === 'GET') return sendLogo(res, logo[1]);

  const user = userFromToken(bearer(req) || url.searchParams.get('token'));

  if (route === 'GET /api/auth/user') {
    if (!user) throw new HttpError('Not signed in', 401);
    return send(res, 200, { user: publicUser(user) });
  }

  if (route === 'GET /api/realtime') {
    if (!user) throw new HttpError('Not signed in', 401);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform', // no-transform: stops proxies/CDNs from compressing (and so buffering) the stream
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // nginx and similar: send each event immediately
    });
    req.socket.setNoDelay(true);
    req.socket.setTimeout(0);
    res.flushHeaders?.();
    res.write('retry: 3000\n: connected\n\n');
    const s = { res, token: bearer(req) || url.searchParams.get('token') };
    streams.add(s);
    const ping = setInterval(() => res.write(': ping\n\n'), 15_000);
    req.on('close', () => {
      clearInterval(ping);
      streams.delete(s);
    });
    return;
  }

  if (route === 'POST /api/collaboration') {
    if (!user) throw new HttpError('Not signed in', 401);
    enforceRateLimit(req, `collab:${user.id}`, 120, 60_000);
    return send(res, 200, {data: collaboration(user, await readJson(req))});
  }
  if (route === 'POST /api/features') {
    if (!user) throw new HttpError('You must be signed in', 401);
    return send(res, 200, handleFeature(user, await readJson(req)));
  }
  if (route === 'POST /api/assistant') {
    if (!user) throw new HttpError('You must be signed in', 401);
    enforceRateLimit(req, `assistant:${user.id}`, 20, 60_000);
    return send(res, 200, await answerWithAI(await readJson(req)));
  }

  if (route === 'POST /api/rest') {
    if (!user) throw new HttpError('You must be signed in', 401);
    const body = await readJson(req);
    const out = run({ user }, body, broadcast);
    return send(res, 200, out);
  }

  // ---- chat files ----
  if (route === 'POST /api/upload') {
    if (!user) throw new HttpError('You must be signed in', 401);
    return send(res, 200, { data: await saveUpload(req, user) });
  }
  if (route === 'GET /api/config') return send(res, 200, { max_upload_mb: MAX_UPLOAD_MB });
  const file = /^\/api\/files\/([^/]+)$/.exec(url.pathname);
  if (file && req.method === 'GET') {
    if (!user) throw new HttpError('You must be signed in', 401);
    return sendFile(req, res, user, file[1], { download: url.searchParams.get('download') === '1' });
  }

  if (route === 'POST /api/auth/resend-confirmation') {
    if (!user) throw new HttpError('You must be signed in', 401);
    enforceRateLimit(req, 'resend-confirmation', 5, 15 * 60 * 1000);
    return send(res, 200, resendConfirmation(user));
  }

  // ---- account security ----
  if (route === 'POST /api/auth/change-password' || route === 'POST /api/auth/change-email') {
    if (!user) throw new HttpError('You must be signed in', 401);
    const body = await readJson(req);
    return send(res, 200, route.endsWith('password') ? changePassword(user, bearer(req), body) : changeEmail(user, body));
  }

  // ---- extra profile details ----
  if (route === 'POST /api/profile/fields' || route === 'POST /api/profile/fields/save') {
    if (!user) throw new HttpError('You must be signed in', 401);
    const body = await readJson(req);
    return send(res, 200, route.endsWith('/save') ? saveProfileFields(user, body) : getProfileFields(user, body));
  }

  // ---- chat polls ----
  if (route.startsWith('POST /api/chat/')) {
    if (!user) throw new HttpError('You must be signed in', 401);
    const body = await readJson(req);
    if (route === 'POST /api/chat/poll') return send(res, 200, createPoll(user, body, broadcast));
    if (route === 'POST /api/chat/poll/vote') return send(res, 200, votePoll(user, body, broadcast));
    if (route === 'POST /api/chat/poll/close') return send(res, 200, setPollClosed(user, body, broadcast));
    if (route === 'POST /api/chat/polls') return send(res, 200, listPolls(user, body));
    // ---- typing indicators and read receipts (see server/presence.js) ----
    if (route === 'POST /api/chat/typing') return send(res, 200, setTyping(user, body, broadcast));
    if (route === 'POST /api/chat/mentions') return send(res, 200, searchMentions(user, body));
    if (route === 'POST /api/chat/reactions') return send(res, 200, listReactions(user, body));
    if (route === 'POST /api/chat/reaction') return send(res, 200, toggleReaction(user, body, broadcast));
    if (route === 'POST /api/chat/read') return send(res, 200, markRead(user, body, broadcast));
    if (route === 'POST /api/chat/reads') return send(res, 200, listReads(user, body));
    // ---- direct messages (see server/dm.js) ----
    if (route === 'POST /api/chat/dm/start') return send(res, 200, startConversation(user, body));
    if (route === 'POST /api/chat/dm/delete') return send(res, 200, deleteConversation(user, body));
    if (route === 'POST /api/chat/dm/list') return send(res, 200, listConversations(user));
    if (route === 'POST /api/chat/dm/unread') return send(res, 200, unreadSummary(user));
    if (route === 'POST /api/chat/dm/seen') return send(res, 200, markSeen(user, body));
    if (route === 'POST /api/chat/dm/block') return send(res, 200, setBlocked(user, body, true));
    if (route === 'POST /api/chat/dm/unblock') return send(res, 200, setBlocked(user, body, false));
    if (route === 'POST /api/chat/dm/people') return send(res, 200, searchPeople(user, body));
    if (route === 'POST /api/chat/friends/list') return send(res, 200, friendLists(user));
    if (route === 'POST /api/chat/friends/request') return send(res, 200, friendAction(user, body, 'request'));
    if (route === 'POST /api/chat/friends/cancel') return send(res, 200, friendAction(user, body, 'cancel'));
    if (route === 'POST /api/chat/friends/accept') return send(res, 200, friendAction(user, body, 'accept'));
    if (route === 'POST /api/chat/friends/reject') return send(res, 200, friendAction(user, body, 'reject'));
    if (route === 'POST /api/chat/friends/remove') return send(res, 200, friendAction(user, body, 'remove'));
    if (route === 'POST /api/chat/message-privacy') return send(res, 200, setMessagePrivacy(user, body));
    // ---- reports: report a message, and the moderators' queue ----
    if (route === 'POST /api/chat/report') return send(res, 200, submitReport(user, body, broadcast));
    if (route === 'POST /api/chat/reports') return send(res, 200, listReports(user, body));
    if (route === 'POST /api/chat/reports/summary') return send(res, 200, reportSummary(user));
    if (route === 'POST /api/chat/report/resolve') return send(res, 200, resolveReport(user, body, broadcast));
    // ---- chat commands (/help /ban /mute ...) ----
    if (route === 'POST /api/chat/commands') return send(res, 200, listCommands(user, body));
    if (route === 'POST /api/chat/command') return send(res, 200, runCommand(user, body, broadcast));
    // ---- room codes ----
    if (route === 'POST /api/chat/room/join') return send(res, 200, joinByCode(user, body));
    if (route === 'POST /api/chat/room/code') return send(res, 200, regenerateCode(user, body));
    if (route === 'POST /api/chat/room/leave') return send(res, 200, leaveRoom(user, body));
    if (route === 'POST /api/chat/room/remove') return send(res, 200, removeMember(user, body));
  }

  // ---- who may use which chat command (super admin only; see server/commands.js) ----
  if (route === 'POST /api/admin/commands' || route === 'POST /api/admin/commands/set') {
    if (!user) throw new HttpError('You must be signed in', 401);
    const body = await readJson(req);
    return send(res, 200, route.endsWith('/set') ? setCommandPermission(user, body, broadcast) : listCommandPermissions(user));
  }

  // ---- profile badges (see server/badges.js) ----
  if (route.startsWith('POST /api/badges/')) {
    if (!user) throw new HttpError('You must be signed in', 401);
    const body = await readJson(req);
    if (route === 'POST /api/badges/list') return send(res, 200, listBadges());
    if (route === 'POST /api/badges/lookup') return send(res, 200, lookupBadges(user, body));
    if (route === 'POST /api/badges/save') return send(res, 200, saveBadge(user, body, broadcast));
    if (route === 'POST /api/badges/delete') return send(res, 200, deleteBadge(user, body, broadcast));
    if (route === 'POST /api/badges/manage') return send(res, 200, manageBadges(user, body));
    if (route === 'POST /api/badges/set') return send(res, 200, setBadge(user, body, broadcast));
    if (route === 'POST /api/badges/people') return send(res, 200, searchPeopleForBadges(user, body));
  }

  // ---- admin dashboard: counts and daily activity (website admins only; see server/dashboard.js) ----
  if (route === 'POST /api/admin/dashboard') {
    if (!user) throw new HttpError('You must be signed in', 401);
    return send(res, 200, dashboard(user, await readJson(req)));
  }

  // ---- moderation log (read-only; admins see everything, presidents and vice presidents their own college) ----
  if (route === 'POST /api/moderation/log') {
    if (!user) throw new HttpError('You must be signed in', 401);
    return send(res, 200, moderationLog(user, await readJson(req)));
  }

  // ---- colleges: logos, CSV import, requests for a missing college (admins only; see server/colleges.js) ----
  if (route === 'POST /api/colleges/logo') {
    if (!user) throw new HttpError('You must be signed in', 401);
    return send(res, 200, await saveLogo(req, user, url.searchParams.get('college_id') || ''));
  }
  if (route.startsWith('POST /api/colleges/')) {
    if (!user) throw new HttpError('You must be signed in', 401);
    const body = await readJson(req);
    if (route === 'POST /api/colleges/logo/remove') return send(res, 200, removeLogo(user, body));
    if (route === 'POST /api/colleges/import') return send(res, 200, importColleges(user, body));
    if (route === 'POST /api/colleges/requests/resolve') return send(res, 200, resolveCollegeRequest(user, body));
  }

  // ---- college verification (admins, and officers of the student's own college) ----
  if (route === 'POST /api/verifications/resolve') {
    if (!user) throw new HttpError('You must be signed in', 401);
    return send(res, 200, resolveVerification(user, await readJson(req)));
  }

  throw new HttpError('Not found', 404);
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2' };
function serveStatic(req, res, url) {
  if (!fs.existsSync(dist)) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('Unilink API is running. For the website run `npm run dev`, or `npm run build` once and reload this page.');
  }
  let file;
  try { file = path.resolve(dist, `.${decodeURIComponent(url.pathname)}`); } catch { file = path.join(dist, 'index.html'); }
  // Resolve within dist (a simple startsWith(dist) check also accepts sibling paths such as dist-backup).
  if ((file !== dist && !file.startsWith(`${dist}${path.sep}`)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  // Defensive defaults for API responses and static assets.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else serveStatic(req, res, url);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error(e);
    if (!res.headersSent) send(res, status, { error: { message: status === 500 ? 'Server error' : e.message } });
  }
});

sweepUploads();

server.listen(PORT, HOST, () => {
  console.log(`Unilink server: http://${HOST}:${PORT}`);
  console.log(`Database file:       ${DB_PATH}`);
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { server.close(); db.close(); process.exit(0); });
