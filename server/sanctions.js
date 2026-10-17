// Bans, mutes and kicks in chat rooms: the lookups that the rest of the server uses to enforce them.
// Creating and lifting them happens in server/commands.js. This file only reads, and imports nothing from
// policies.js, so policies.js can use it without a circular import.
import { db } from './db.js';
import { isOfficerIn } from './power.js';
import { dmPostingBlock } from './dmGuards.js';

const nowIso = () => new Date().toISOString();

/** SQL (and params) that is true when the user has NO active ban/kick in the room `alias`. */
export function notBannedSql(userId, alias = 'chat_rooms') {
  return [
    `NOT EXISTS (SELECT 1 FROM room_sanctions bs WHERE bs.room_id = ${alias}.id AND bs.user_id = ? AND bs.kind IN ('ban','kick') AND bs.revoked_at IS NULL AND (bs.expires_at IS NULL OR bs.expires_at > ?))`,
    [userId, nowIso()],
  ];
}

/** The active sanction of one of these kinds (the one that lasts longest), or undefined. */
export function activeSanction(roomId, userId, kinds) {
  const marks = kinds.map(() => '?').join(',');
  return db
    .prepare(
      `SELECT * FROM room_sanctions
        WHERE room_id = ? AND user_id = ? AND kind IN (${marks}) AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)
        ORDER BY (expires_at IS NULL) DESC, expires_at DESC LIMIT 1`
    )
    .get(roomId, userId, ...kinds, nowIso());
}

/** Every active sanction in a room. */
export function activeSanctionsInRoom(roomId) {
  return db
    .prepare(`SELECT * FROM room_sanctions WHERE room_id = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?) ORDER BY created_at DESC`)
    .all(roomId, nowIso());
}

/** "You are muted until 3:45 PM (reason)". */
export function describeBlock(s, what) {
  const until = s.expires_at ? ` until ${new Date(s.expires_at).toUTCString().replace(' GMT', ' UTC')}` : ' permanently';
  return `${what}${until}${s.reason ? `. Reason: ${s.reason}` : ''}`;
}

/** Throws-free check used by message / poll creation. Returns an error string or null.
 *  Order: muted, then the room is locked (officers may still post), then slowmode (officers are exempt). */
export function postingBlock(roomId, userId) {
  const blocked = dmPostingBlock(roomId, userId); // direct messages: one of the two blocked the other
  if (blocked) return blocked;
  const mute = activeSanction(roomId, userId, ['mute']);
  if (mute) return describeBlock(mute, 'You are muted in this room');

  const room = db.prepare('SELECT id, room_type, college_id, created_by, is_locked, slowmode_seconds FROM chat_rooms WHERE id = ?').get(roomId);
  if (!room || (!room.is_locked && !room.slowmode_seconds)) return null;
  const who = db.prepare('SELECT id, role, is_owner, college_id, is_verified, college_role FROM profiles WHERE id = ?').get(userId);
  if (!who || isOfficerIn(who, room)) return null;

  if (room.is_locked) return 'This room is locked. Only officers can post right now.';
  const last = db.prepare('SELECT created_at FROM messages WHERE room_id = ? AND sender_id = ? ORDER BY created_at DESC LIMIT 1').get(roomId, userId);
  if (last) {
    const wait = Math.ceil((Date.parse(last.created_at) + room.slowmode_seconds * 1000 - Date.now()) / 1000);
    if (wait > 0) return `Slowmode is on. Wait ${wait} second${wait === 1 ? '' : 's'} before posting again.`;
  }
  return null;
}
