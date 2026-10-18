// Typing indicators and read receipts.
//
// Typing is never stored: the browser says "I am typing" and the server passes it on to everyone who can see the room.
// Read receipts are stored as one row per person per room (room_reads.last_read_at = "has read up to here").
// A message is "seen" by someone when their last_read_at is at or after the message's created_at.
// Both go out over the same realtime stream as chat messages, so they follow the same room-visibility rules.
import { db } from './db.js';
import { HttpError } from './rest.js';
import { visibleRoomSql } from './policies.js';
import { postingBlock, notBannedSql } from './sanctions.js';

function assertCanSeeRoom(user, roomId) {
  const [sql, params] = visibleRoomSql({ user });
  if (!db.prepare(`SELECT 1 FROM chat_rooms WHERE id = ? AND ${sql}`).get(roomId, ...params)) throw new HttpError('You cannot use that room', 403);
}

const nameOf = (userId) => db.prepare('SELECT full_name FROM profiles WHERE id = ?').get(userId)?.full_name ?? '';

// One typing notice per person per room per second is plenty; anything faster is dropped.
const lastTyping = new Map(); // `${roomId}:${userId}` -> ms
function tooSoon(key, typing) {
  if (!typing) return false; // "stopped typing" always goes through
  const now = Date.now();
  if (now - (lastTyping.get(key) ?? 0) < 1000) return true;
  lastTyping.set(key, now);
  if (lastTyping.size > 5000) for (const [k, t] of lastTyping) if (now - t > 60_000) lastTyping.delete(k);
  return false;
}

/** { room_id, typing: true|false }. Nothing is saved; it is only passed on. */
export function setTyping(user, body, broadcast) {
  const roomId = String(body.room_id || '');
  const typing = body.typing !== false;
  assertCanSeeRoom(user, roomId);
  // Someone who cannot post (muted, locked room, slowmode) is not "typing" to everyone else.
  if (typing && postingBlock(roomId, user.id)) return { data: { ok: true } };
  if (tooSoon(`${roomId}:${user.id}`, typing)) return { data: { ok: true } };
  broadcast({ eventType: 'TYPING', table: 'typing', new: { room_id: roomId, user_id: user.id, name: nameOf(user.id), typing }, old: {} });
  return { data: { ok: true } };
}

/** { room_id, up_to, share }. "I have read this room up to the message sent at `up_to`."
 *  { share: false } (with or without a room_id) = "stop showing that I read things": my rows are removed. */
export function markRead(user, body, broadcast) {
  const roomId = String(body.room_id || '');
  if (body.share === false) {
    const mine = db.prepare(`SELECT room_id FROM room_reads WHERE user_id = ?${roomId ? ' AND room_id = ?' : ''}`).all(user.id, ...(roomId ? [roomId] : []));
    for (const r of mine) {
      db.prepare('DELETE FROM room_reads WHERE room_id = ? AND user_id = ?').run(r.room_id, user.id);
      broadcast({ eventType: 'DELETE', table: 'room_reads', new: {}, old: { room_id: r.room_id, user_id: user.id } });
    }
    return { data: { ok: true } };
  }
  assertCanSeeRoom(user, roomId);
  const newest = db.prepare('SELECT MAX(created_at) AS t FROM messages WHERE room_id = ?').get(roomId)?.t;
  if (!newest) return { data: { ok: true } };
  const asked = Date.parse(String(body.up_to || ''));
  // never later than the newest message in the room, so a browser cannot "read" the future
  const upTo = Number.isNaN(asked) ? newest : new Date(Math.min(asked, Date.parse(newest))).toISOString();
  const before = db.prepare('SELECT last_read_at FROM room_reads WHERE room_id = ? AND user_id = ?').get(roomId, user.id);
  if (before && before.last_read_at >= upTo) return { data: { ok: true } }; // only ever moves forward
  db.prepare(
    `INSERT INTO room_reads (room_id, user_id, last_read_at) VALUES (?, ?, ?)
     ON CONFLICT (room_id, user_id) DO UPDATE SET last_read_at = excluded.last_read_at`
  ).run(roomId, user.id, upTo);
  broadcast({ eventType: 'UPDATE', table: 'room_reads', new: { room_id: roomId, user_id: user.id, name: nameOf(user.id), last_read_at: upTo }, old: {} });
  return { data: { ok: true } };
}

/** { room_id }. Where everyone else has read up to (only people who share receipts, newest 300). */
export function listReads(user, body) {
  const roomId = String(body.room_id || '');
  assertCanSeeRoom(user, roomId);
  const rows = db
    .prepare(
      `SELECT r.user_id, p.full_name AS name, r.last_read_at
         FROM room_reads r JOIN profiles p ON p.id = r.user_id
        WHERE r.room_id = ? AND r.user_id != ?
        ORDER BY r.last_read_at DESC LIMIT 300`
    )
    .all(roomId, user.id);
  // leave out people who are banned or kicked from the room by now
  const visible = rows.filter((r) => {
    const [sql, params] = notBannedSql(r.user_id);
    return db.prepare(`SELECT 1 FROM chat_rooms WHERE id = ? AND ${sql}`).get(roomId, ...params);
  });
  return { data: visible };
}
