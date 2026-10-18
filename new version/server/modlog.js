// Moderation log: a read-only, filterable history of every ban, mute, kick and warning, built from the
// room_sanctions and room_warnings tables (nothing is stored twice).
//
//   Website admins and the super admin : every room, optionally narrowed to one college
//   President and vice president       : only the college rooms of their own college, while verified there
//   Everyone else                      : refused
//
// The scope is decided here from the person's current profile, never from what the browser asks for.
import { db } from './db.js';
import { HttpError } from './rest.js';
import { COLLEGE_RANK } from './power.js';

export const LOG_PAGE = 50;
const ACTIONS = new Set(['ban', 'mute', 'kick', 'warn']);

/** One row per sanction or warning. `state` says where it stands now. */
const SOURCE = `
  SELECT s.id, s.kind AS action, s.created_at, s.room_id, s.user_id, s.issued_by, s.reason,
         s.expires_at, s.revoked_at, s.revoked_by, NULL AS cleared_at
    FROM room_sanctions s
  UNION ALL
  SELECT w.id, 'warn', w.created_at, w.room_id, w.user_id, w.issued_by, w.reason,
         NULL, NULL, NULL, w.cleared_at
    FROM room_warnings w`;

const likeEscape = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Who may open the log, and what it may cover. Returns { all: true } or { collegeId }. */
function scopeOf(userId) {
  const p = db.prepare('SELECT id, role, college_id, is_verified, college_role FROM profiles WHERE id = ?').get(userId);
  if (!p) throw new HttpError('Not signed in', 401);
  if (p.role === 'admin' || p.role === 'super_admin') return { all: true };
  if (p.is_verified && p.college_id && (COLLEGE_RANK[p.college_role] ?? 0) >= COLLEGE_RANK.vice_president) return { all: false, collegeId: p.college_id };
  throw new HttpError('Only website admins, presidents and vice presidents can open the moderation log', 403);
}

function stateOf(r, now) {
  if (r.action === 'warn') return r.cleared_at ? 'used' : 'counted';
  if (r.revoked_at) return 'lifted';
  if (!r.expires_at) return 'permanent';
  return r.expires_at > now ? 'active' : 'expired';
}

/** POST /api/moderation/log { action?, state?, q?, college_id?, cursor?, limit? } */
export function moderationLog(user, body) {
  const scope = scopeOf(user.id);
  const where = [];
  const params = [];

  if (scope.all) {
    const c = String(body.college_id ?? '');
    if (c) { where.push('r.college_id = ?'); params.push(c); }
  } else {
    where.push("r.room_type = 'college' AND r.college_id = ?"); // a college officer never sees global or private rooms
    params.push(scope.collegeId);
  }

  const action = String(body.action ?? '');
  if (action) {
    if (!ACTIONS.has(action)) throw new HttpError('Unknown action');
    where.push('e.action = ?');
    params.push(action);
  }

  const now = new Date().toISOString();
  const state = String(body.state ?? '');
  if (state === 'active') {
    // still in force: an unexpired, unlifted ban/mute/kick, or a warning that still counts towards the next mute
    where.push("((e.action <> 'warn' AND e.revoked_at IS NULL AND (e.expires_at IS NULL OR e.expires_at > ?)) OR (e.action = 'warn' AND e.cleared_at IS NULL))");
    params.push(now);
  } else if (state) {
    throw new HttpError('Unknown state');
  }

  const q = String(body.q ?? '').trim().slice(0, 100);
  if (q) {
    const like = `%${likeEscape(q)}%`;
    where.push("(t.full_name LIKE ? ESCAPE '\\' OR i.full_name LIKE ? ESCAPE '\\' OR e.reason LIKE ? ESCAPE '\\' OR r.name LIKE ? ESCAPE '\\')");
    params.push(like, like, like, like);
  }

  // newest first; the cursor is "created_at|id" of the last row of the previous page
  const cur = /^(.+)\|([^|]+)$/.exec(String(body.cursor ?? ''));
  if (cur) {
    where.push('(e.created_at < ? OR (e.created_at = ? AND e.id < ?))');
    params.push(cur[1], cur[1], cur[2]);
  }

  const limit = Math.min(Math.max(Number(body.limit) || LOG_PAGE, 1), 100);
  const rows = db
    .prepare(
      `SELECT e.*, r.name AS room_name, r.room_type, r.college_id, c.name AS college_name,
              t.full_name AS target_name, i.full_name AS issuer_name, rv.full_name AS revoker_name
         FROM (${SOURCE}) e
         JOIN chat_rooms r ON r.id = e.room_id
         LEFT JOIN colleges c ON c.id = r.college_id
         LEFT JOIN profiles t ON t.id = e.user_id
         LEFT JOIN profiles i ON i.id = e.issued_by
         LEFT JOIN profiles rv ON rv.id = e.revoked_by
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT ?`
    )
    .all(...params, limit + 1);

  const more = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    data: {
      scope: scope.all ? 'all' : 'college',
      entries: page.map((r) => ({
        id: r.id,
        action: r.action,
        state: stateOf(r, now),
        created_at: r.created_at,
        expires_at: r.expires_at,
        lifted_at: r.revoked_at,
        lifted_by: r.revoker_name,
        room_id: r.room_id,
        room_name: r.room_name,
        room_type: r.room_type,
        college_name: r.college_name,
        target_id: r.user_id,
        target_name: r.target_name ?? 'Deleted user',
        issuer_name: r.issuer_name ?? 'Deleted user',
        reason: r.reason,
      })),
      next_cursor: more && last ? `${last.created_at}|${last.id}` : null,
    },
  };
}
