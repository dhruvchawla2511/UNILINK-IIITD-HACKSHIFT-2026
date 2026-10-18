// Reports: anyone can report a message in a room they can see; the room's moderators get a queue and can act in one click.
//
// WHO SEES A REPORT is decided by the reporter's room, using the same "power" as the chat commands (server/power.js):
//   college room : secretary and above of that college, the creator of the room (committee heads), website admins
//   private room : the room owner, website admins
//   global room  : website admins only
// So a report in a college room reaches that college's officers and nobody from another college.
//
// The buttons call the same code as /mute, /ban and /clear (commands.js), so every rule there applies here too:
// you can only act on people ranked below you, and the command permissions the super admin set still count.
// Mutes and bans made here show up in the moderation log with the reason "Reported: ...".
import crypto from 'node:crypto';
import { db } from './db.js';
import { HttpError } from './rest.js';
import { visibleRoomSql, isAdminUser } from './policies.js';
import { COLLEGE_RANK, powerIn } from './power.js';
import { actorFor, commandBlock, deleteMessageAs, profileOf, sanctionUser, standingIn } from './commands.js';

export const REASONS = {
  spam: 'Spam',
  harassment: 'Harassment or bullying',
  hate: 'Hate or abuse',
  inappropriate: 'Inappropriate content',
  other: 'Something else',
};
const MAX_DETAILS = 300;
const MAX_NOTE = 200;
const MAX_REPORTS_PER_HOUR = 10;
const RESOLVED_PAGE = 50;
const MAX_MINUTES = 365 * 1440;
const ACTIONS = new Set(['dismiss', 'delete', 'mute', 'ban']);

const nameOf = (p) => p?.full_name?.trim() || 'Unnamed';

/** Tells every moderator of the room that the queue changed (they reload it). Carries no message text. */
const queueChanged = (broadcast, roomId, change) => broadcast({ eventType: change === 'new' ? 'INSERT' : 'UPDATE', table: 'message_reports', new: { room_id: roomId, change }, old: {} });

// ---------------------------------------------------------------- reporting

/** POST /api/chat/report { message_id, reason, details? } */
export function submitReport(user, body, broadcast) {
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(String(body.message_id ?? ''));
  if (!msg) throw new HttpError('That message no longer exists', 404);
  const [sql, params] = visibleRoomSql({ user });
  const room = db.prepare(`SELECT * FROM chat_rooms WHERE id = ? AND ${sql}`).get(msg.room_id, ...params);
  if (!room) throw new HttpError('You cannot report messages in that room', 403); // also hides that the message exists

  const reason = String(body.reason ?? '');
  if (!Object.hasOwn(REASONS, reason)) throw new HttpError('Pick a reason for the report');
  const details = String(body.details ?? '').trim();
  if (details.length > MAX_DETAILS) throw new HttpError(`Keep the details under ${MAX_DETAILS} characters`);

  if (msg.sender_id === user.id) throw new HttpError("You can't report your own message");
  if (db.prepare('SELECT 1 FROM message_reports WHERE message_id = ? AND reporter_id = ?').get(msg.id, user.id)) {
    throw new HttpError('You already reported this message. The moderators will look at it', 409);
  }
  const since = new Date(Date.now() - 3600_000).toISOString();
  const recent = db.prepare('SELECT COUNT(*) AS n FROM message_reports WHERE reporter_id = ? AND created_at > ?').get(user.id, since).n;
  if (recent >= MAX_REPORTS_PER_HOUR) throw new HttpError('You have sent a lot of reports in the last hour. Please try again later', 429);

  db.prepare(
    `INSERT INTO message_reports (id, message_id, room_id, reporter_id, target_id, reason, details, content, msg_type, attachment_name, message_sent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), msg.id, room.id, user.id, msg.sender_id, reason, details || null, String(msg.content ?? '').slice(0, 1000), msg.msg_type, msg.attachment_name ?? null, msg.created_at);
  queueChanged(broadcast, room.id, 'new');
  return { data: { ok: true } };
}

// ---------------------------------------------------------------- the queue

/** Can this person ever see reports? Used to show or hide the queue button. */
function canReview(actor) {
  if (isAdminUser(actor)) return true;
  if (actor.is_verified && actor.college_id && (COLLEGE_RANK[actor.college_role] ?? 0) >= COLLEGE_RANK.committee_head) return true;
  return !!db.prepare("SELECT 1 FROM chat_rooms WHERE created_by = ? AND room_type = 'private' AND dm_key IS NULL").get(actor.id);
}

const REPORT_ROWS = `
  SELECT r.*, rm.name AS room_name, rm.room_type, rm.dm_key, rm.college_id, rm.created_by AS room_created_by, c.name AS college_name,
         rp.full_name AS reporter_name, t.full_name AS target_name, rv.full_name AS resolver_name,
         m.id AS live_message_id, m.attachment_url AS live_attachment_url
    FROM message_reports r
    JOIN chat_rooms rm ON rm.id = r.room_id
    LEFT JOIN colleges c ON c.id = rm.college_id
    LEFT JOIN profiles rp ON rp.id = r.reporter_id
    LEFT JOIN profiles t ON t.id = r.target_id
    LEFT JOIN profiles rv ON rv.id = r.resolved_by
    LEFT JOIN messages m ON m.id = r.message_id`;

/** Rows in rooms where this person moderates. Narrowed in SQL first, then checked with powerIn() like every command. */
function reviewableRows(actor, where, params, tail = '') {
  const scope = [];
  const scopeParams = [];
  if (!isAdminUser(actor)) {
    scope.push("((rm.room_type = 'college' AND rm.college_id = ?) OR rm.created_by = ?)");
    scopeParams.push(actor.college_id ?? '', actor.id);
  }
  const all = [...where, ...scope];
  const rows = db.prepare(`${REPORT_ROWS} ${all.length ? 'WHERE ' + all.join(' AND ') : ''} ${tail}`).all(...params, ...scopeParams);
  const power = new Map(); // per room
  return rows.filter((r) => {
    if (!power.has(r.room_id)) power.set(r.room_id, powerIn(actor, { id: r.room_id, room_type: r.room_type, dm_key: r.dm_key, college_id: r.college_id, created_by: r.room_created_by }));
    return power.get(r.room_id) >= 1;
  });
}

/** One entry per reported message (or per report, once the message is gone), with every report on it. */
function group(rows) {
  const groups = new Map();
  for (const r of rows) {
    // once the message is gone, reports about the same message are still recognised by room, author and send time
    const key = r.message_id ?? `${r.room_id}|${r.target_id}|${r.message_sent_at}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        report_ids: [],
        message_id: r.live_message_id ?? null,
        room_id: r.room_id,
        room_name: r.room_name,
        room_type: r.room_type,
        college_name: r.college_name,
        target_id: r.target_id,
        target_name: nameOf({ full_name: r.target_name }),
        content: r.content,
        msg_type: r.msg_type,
        attachment_name: r.attachment_name,
        attachment_url: r.live_attachment_url ?? null,
        message_sent_at: r.message_sent_at,
        status: r.status,
        action: r.action,
        message_deleted: !!r.message_deleted,
        resolved_at: r.resolved_at,
        resolved_by_name: r.resolver_name ?? null,
        resolution_note: r.resolution_note,
        latest_at: r.created_at,
        reports: [],
      };
      groups.set(key, g);
    }
    g.report_ids.push(r.id);
    if (r.created_at > g.latest_at) g.latest_at = r.created_at;
    g.reports.push({ id: r.id, reporter_name: nameOf({ full_name: r.reporter_name }), reason: r.reason, reason_label: REASONS[r.reason], details: r.details, created_at: r.created_at });
  }
  return [...groups.values()];
}

/** What this person may do with a reported message, and why a button is greyed out. */
function abilities(actor, g) {
  const room = db.prepare('SELECT * FROM chat_rooms WHERE id = ?').get(g.room_id);
  const target = profileOf(g.target_id);
  const why = (name, needsTarget) => (name === 'delete' ? (g.message_id ? commandBlock(actor, room, 'clear') : 'The message is already gone') : target ? commandBlock(actor, room, name, needsTarget ? target : null) : 'This person no longer has an account');
  const entry = (name, block) => ({ allowed: !block, why: block });
  return {
    delete: entry('delete', why('delete')),
    mute: entry('mute', why('mute', true)),
    ban: entry('ban', why('ban', true)),
    target_standing: target ? standingIn(g.room_id, g.target_id) : null,
  };
}

/** POST /api/chat/reports/summary : { can_review, open } for the badge on the queue button. */
export function reportSummary(user) {
  const actor = actorFor(user);
  if (!canReview(actor)) return { data: { can_review: false, open: 0 } };
  const rows = reviewableRows(actor, ["r.status = 'open'"], []);
  return { data: { can_review: true, open: group(rows).length } };
}

/** POST /api/chat/reports { status?: 'open' | 'resolved' } */
export function listReports(user, body) {
  const actor = actorFor(user);
  if (!canReview(actor)) throw new HttpError('Only moderators can open the report queue', 403);
  const resolved = body.status === 'resolved';
  const rows = reviewableRows(actor, [resolved ? "r.status <> 'open'" : "r.status = 'open'"], [], resolved ? 'ORDER BY r.resolved_at DESC' : 'ORDER BY r.created_at ASC');
  let groups = group(rows);
  if (resolved) groups = groups.slice(0, RESOLVED_PAGE);
  else groups.sort((a, b) => a.latest_at.localeCompare(b.latest_at)); // oldest waiting first
  return { data: { reasons: REASONS, items: groups.map((g) => ({ ...g, can: g.status === 'open' ? abilities(actor, g) : null })) } };
}

// ---------------------------------------------------------------- acting on a report

/** POST /api/chat/report/resolve { report_id, action: 'dismiss'|'delete'|'mute'|'ban', minutes?, delete_message?, note? }
 *  Handles every open report on the same message at once. */
export function resolveReport(user, body, broadcast) {
  const rep = db.prepare('SELECT * FROM message_reports WHERE id = ?').get(String(body.report_id ?? ''));
  const room = rep && db.prepare('SELECT * FROM chat_rooms WHERE id = ?').get(rep.room_id);
  const actor = actorFor(user);
  // anyone who may not review this report is told it does not exist
  if (!rep || !room || powerIn(actor, room) < 1) throw new HttpError('Report not found', 404);
  if (rep.status !== 'open') throw new HttpError('Someone already handled this report', 409);

  const action = String(body.action ?? '');
  if (!ACTIONS.has(action)) throw new HttpError('Unknown action');
  const note = String(body.note ?? '').trim().slice(0, MAX_NOTE) || null;

  let minutes = null; // mute: 10 minutes, ban: permanent, unless the moderator picked a time
  if (body.minutes != null && body.minutes !== '') {
    if (body.minutes === 'perm') minutes = Infinity;
    else {
      minutes = Number(body.minutes);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_MINUTES) throw new HttpError('Pick a time between 1 minute and 365 days');
    }
    if (action === 'mute' && minutes === Infinity) throw new HttpError('Choose how long to mute for');
  }

  // every open report on this message is settled together
  const group = rep.message_id
    ? db.prepare("SELECT id FROM message_reports WHERE message_id = ? AND status = 'open'").all(rep.message_id)
    : db.prepare("SELECT id FROM message_reports WHERE message_id IS NULL AND room_id = ? AND target_id = ? AND message_sent_at IS ? AND status = 'open'").all(rep.room_id, rep.target_id, rep.message_sent_at);
  const ids = group.map((r) => r.id);
  const liveMessage = rep.message_id ? db.prepare('SELECT id FROM messages WHERE id = ?').get(rep.message_id) : null;

  const wantsDelete = action === 'delete' || ((action === 'mute' || action === 'ban') && !!body.delete_message);
  if (action === 'delete' && !liveMessage) throw new HttpError('That message is already gone. Dismiss the report, or mute or ban the person', 409);
  if (wantsDelete && liveMessage) {
    const block = commandBlock(actor, room, 'clear');
    if (block) throw new HttpError(block, 403); // check first, so a failed delete does not leave a half-done action
  }

  const parts = [];
  if (action === 'mute' || action === 'ban') {
    const label = REASONS[rep.reason];
    parts.push(sanctionUser(actor, room, rep.target_id, action, minutes, `Reported: ${label}${note ? `. ${note}` : ''}`, broadcast));
  }
  let deleted = false;
  if (wantsDelete && liveMessage) {
    deleted = deleteMessageAs(actor, room, liveMessage.id, broadcast);
    if (deleted) parts.push('Deleted the message.');
  }
  if (action === 'dismiss') parts.push('Report dismissed.');

  const marks = ids.map(() => '?').join(',');
  db.prepare(
    `UPDATE message_reports SET status = ?, action = ?, message_deleted = ?, resolved_by = ?, resolved_at = ?, resolution_note = ?
      WHERE id IN (${marks}) AND status = 'open'`
  ).run(action === 'dismiss' ? 'dismissed' : 'actioned', action, deleted ? 1 : 0, actor.id, new Date().toISOString(), note, ...ids);

  queueChanged(broadcast, room.id, 'resolved');
  return { data: { text: parts.join(' ') || 'Done.', handled: ids.length } };
}
