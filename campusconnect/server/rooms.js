// Room codes. Every chat room has a 6-digit code that can be shared to bring people into it.
//   global  room : anyone signed in can join with the code (they can see it anyway)
//   college room : only verified students of that college (website admins too, and joining adds it to their list)
//   private room : anyone with the code joins and becomes a member
// A person who is not allowed in gets the same "no room" answer as for a wrong code, so codes cannot be
// used to find out which rooms exist. Wrong guesses are limited, because there are only 900,000 codes.
import { db, newRoomCode } from './db.js';
import { HttpError } from './rest.js';
import { policies, isAdminUser, visibleRoomSql } from './policies.js';
import { activeSanction, describeBlock } from './sanctions.js';

const MAX_FAILS = 10;
const WINDOW_MS = 10 * 60_000;
const fails = new Map(); // user id -> { n, resetAt }

function checkNotLocked(userId) {
  const f = fails.get(userId);
  if (f && f.resetAt > Date.now() && f.n >= MAX_FAILS) {
    const mins = Math.ceil((f.resetAt - Date.now()) / 60_000);
    throw new HttpError(`Too many wrong codes. Try again in ${mins} minute${mins === 1 ? '' : 's'}`, 429);
  }
}
function recordFail(userId) {
  const now = Date.now();
  const f = fails.get(userId);
  if (!f || f.resetAt <= now) fails.set(userId, { n: 1, resetAt: now + WINDOW_MS });
  else f.n += 1;
}

const NOT_FOUND = 'No room found with that code. College rooms can only be joined by verified students of that college';

/** Joins the room with this code. Returns the room (with its college) so the page can open it. */
export function joinByCode(user, body) {
  checkNotLocked(user.id);
  const code = String(body.code ?? '').replace(/[\s-]/g, '');
  if (!/^\d{6}$/.test(code)) throw new HttpError('Enter the 6-digit room code');

  const room = db.prepare('SELECT * FROM chat_rooms WHERE room_code = ?').get(code);
  const allowed =
    room &&
    !room.dm_key && // a direct message can never be joined with a code
    (room.room_type === 'global' ||
      room.room_type === 'private' ||
      isAdminUser(user) ||
      (room.system_key === 'lobby' && !!user.college_id && user.college_id === room.college_id) ||
      (user.is_verified && !!user.college_id && user.college_id === room.college_id));
  if (!allowed) {
    recordFail(user.id);
    throw new HttpError(NOT_FOUND, 404);
  }
  fails.delete(user.id);

  // Banned (or kicked, for now) people cannot come back with the code.
  const ban = activeSanction(room.id, user.id, ['ban', 'kick']);
  if (ban) throw new HttpError(describeBlock(ban, ban.kind === 'kick' ? 'You were kicked from this room' : 'You are banned from this room'), 403);

  // Private rooms always record who joined. Website admins also get a membership in global and college rooms:
  // that is what makes those rooms show up for them (they do not see rooms they have not joined, see policies.js).
  if (room.room_type === 'private' || isAdminUser(user)) db.prepare('INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)').run(room.id, user.id);
  const college = room.college_id ? db.prepare('SELECT * FROM colleges WHERE id = ?').get(room.college_id) : null;
  return { data: { ...room, college } };
}

/** Makes a new code for a room (the old one stops working). Only people who can edit the room, and admins. */
export function regenerateCode(user, body) {
  const roomId = String(body.room_id ?? '');
  if (db.prepare('SELECT 1 FROM chat_rooms WHERE id = ? AND dm_key IS NOT NULL').get(roomId)) throw new HttpError('Direct messages have no room code', 400);
  const [seeSql, seeParams] = visibleRoomSql({ user });
  if (!db.prepare(`SELECT 1 FROM chat_rooms WHERE id = ? AND ${seeSql}`).get(roomId, ...seeParams)) throw new HttpError('Room not found', 404);
  const [editSql, editParams] = policies.chat_rooms.update({ user });
  const canEdit = isAdminUser(user) || db.prepare(`SELECT 1 FROM chat_rooms WHERE id = ? AND ${editSql}`).get(roomId, ...editParams);
  if (!canEdit) throw new HttpError('You are not allowed to change this room\'s code', 403);
  const code = newRoomCode();
  db.prepare('UPDATE chat_rooms SET room_code = ? WHERE id = ?').run(code, roomId);
  return { data: { room_id: roomId, room_code: code } };
}

// ---- private room membership ----
// Who is in a private room can be read with the normal data API (room_members, only for rooms you are in).
// Changing it happens only here, so the rules cannot be bypassed.

function privateRoom(roomId) {
  const room = db.prepare('SELECT * FROM chat_rooms WHERE id = ?').get(String(roomId ?? ''));
  if (!room) throw new HttpError('Room not found', 404);
  if (room.room_type !== 'private' || room.dm_key) throw new HttpError('Only private rooms have a member list', 400);
  return room;
}

/** Leave a private room. The owner cannot leave (they can delete the room instead). */
export function leaveRoom(user, body) {
  // A website admin can also leave a global or college room they joined, which hides it from them again.
  const asked = db.prepare('SELECT * FROM chat_rooms WHERE id = ?').get(String(body.room_id ?? ''));
  if (asked && asked.room_type !== 'private' && !asked.dm_key && isAdminUser(user)) {
    db.prepare('DELETE FROM room_members WHERE room_id = ? AND user_id = ?').run(asked.id, user.id);
    db.prepare('DELETE FROM room_reads WHERE room_id = ? AND user_id = ?').run(asked.id, user.id);
    return { data: { ok: true } };
  }
  const room = privateRoom(body.room_id);
  if (room.created_by === user.id) throw new HttpError('You created this room, so you cannot leave it. Delete it instead', 400);
  db.prepare('DELETE FROM room_members WHERE room_id = ? AND user_id = ?').run(room.id, user.id);
  db.prepare('DELETE FROM room_reads WHERE room_id = ? AND user_id = ?').run(room.id, user.id);
  return { data: { ok: true } };
}

/** Remove someone from a private room: the room's owner, or a website admin. The owner cannot be removed. */
export function removeMember(user, body) {
  const room = privateRoom(body.room_id);
  const target = String(body.user_id ?? '');
  if (room.created_by !== user.id && !isAdminUser(user)) throw new HttpError('Only the room\'s owner can remove people', 403);
  if (target === room.created_by) throw new HttpError('The owner of a room cannot be removed', 400);
  if (target === user.id) throw new HttpError('Use Leave room to leave', 400);
  const r = db.prepare('DELETE FROM room_members WHERE room_id = ? AND user_id = ?').run(room.id, target);
  if (!r.changes) throw new HttpError('That person is not in this room', 404);
  db.prepare('DELETE FROM room_reads WHERE room_id = ? AND user_id = ?').run(room.id, target);
  return { data: { ok: true } };
}
