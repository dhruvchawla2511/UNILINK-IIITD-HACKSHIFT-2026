import crypto from 'node:crypto';
// @mentions in chat. Typing "@Priya Sharma" (or "@Priya_Sharma") in a room message
//   - highlights the name for everyone who reads the message, and
//   - sends that person a notification, but only if they can actually see the room.
// The server decides who was mentioned (never the browser): see findMentions, called from policies.messages.canInsert.
import { db } from './db.js';
import { HttpError } from './rest.js';
import { visibleRoomSql } from './policies.js';

export const MAX_MENTIONS = 5;
const WORD = /[\p{L}\p{N}_]/u;

const asUser = (p) => ({ id: p.id, role: p.role ?? 'student', college_id: p.college_id ?? null, is_verified: !!p.is_verified, college_role: p.college_role ?? 'member', is_owner: !!p.is_owner });
const COLS = 'id, full_name, avatar_url, role, college_id, is_verified, college_role, is_owner';

function canSee(person, roomId) {
  const [sql, params] = visibleRoomSql({ user: asUser(person) });
  return !!db.prepare(`SELECT 1 FROM chat_rooms WHERE id = ? AND ${sql}`).get(roomId, ...params);
}
const blocked = (a, b) => !!db.prepare('SELECT 1 FROM campus_user_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)').get(a, b, b, a);

/** [{ id, name }] for the people @-mentioned in `content` who may see room `roomId`. */
export function findMentions(content, roomId, senderId) {
  const text = String(content || '').toLowerCase();
  if (!text.includes('@')) return [];
  const room = db.prepare('SELECT id, dm_key FROM chat_rooms WHERE id = ?').get(roomId);
  if (!room || room.dm_key) return [];
  const rows = db.prepare(
    `SELECT ${COLS} FROM profiles WHERE id <> ? AND length(trim(full_name)) > 0
       AND (instr(?, '@' || lower(trim(full_name))) > 0 OR instr(?, '@' || lower(replace(trim(full_name), ' ', '_'))) > 0)
      LIMIT 40`
  ).all(senderId, text, text);
  const out = [];
  for (const p of rows) {
    const name = p.full_name.trim().toLowerCase();
    const hit = [`@${name}`, `@${name.replace(/\s+/g, '_')}`].some((needle) => {
      for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + 1)) {
        const next = text[i + needle.length];
        if (!next || !WORD.test(next)) return true; // whole name, not the start of a longer word
      }
      return false;
    });
    if (hit && canSee(p, roomId) && !blocked(senderId, p.id)) out.push({ id: p.id, name: p.full_name.trim() });
    if (out.length >= MAX_MENTIONS) break;
  }
  return out;
}

/** Called after a message was saved: one notification per mentioned person. */
export function notifyMentions(message) {
  let list = [];
  try { list = JSON.parse(message.mentions || '[]'); } catch { /* none */ }
  if (!list.length) return;
  const room = db.prepare('SELECT name FROM chat_rooms WHERE id = ?').get(message.room_id);
  const add = db.prepare('INSERT INTO campus_notifications(id, user_id, actor_id, kind, message, target_id) VALUES(?,?,?,?,?,?)');
  for (const m of list) add.run(crypto.randomUUID(), m.id, message.sender_id, 'mention', `mentioned you in ${room?.name ?? 'a chat room'}`, message.room_id);
}

/** POST /api/chat/mentions { room_id, q } -> people to suggest after "@": recent speakers first, then name matches. */
export function searchMentions(user, body) {
  const roomId = String(body.room_id || '');
  const q = String(body.q || '').trim().slice(0, 40).replace(/_/g, ' ');
  if (!canSee(user, roomId)) throw new HttpError('Room not found', 404);
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const recent = db.prepare(
    `SELECT DISTINCT p.id FROM messages m JOIN profiles p ON p.id = m.sender_id
      WHERE m.room_id = ? AND p.id <> ? AND p.full_name LIKE ? ESCAPE '\\' ORDER BY m.created_at DESC LIMIT 6`
  ).all(roomId, user.id, like).map((r) => r.id);
  const more = q
    ? db.prepare(`SELECT id FROM profiles WHERE id <> ? AND full_name LIKE ? ESCAPE '\\' ORDER BY full_name COLLATE NOCASE LIMIT 30`).all(user.id, like).map((r) => r.id)
    : [];
  const out = [];
  for (const id of [...new Set([...recent, ...more])]) {
    const p = db.prepare(`SELECT ${COLS} FROM profiles WHERE id = ?`).get(id);
    if (p && canSee(p, roomId) && !blocked(user.id, id)) out.push({ id: p.id, name: p.full_name.trim(), avatar_url: p.avatar_url });
    if (out.length >= 6) break;
  }
  return { data: out };
}
