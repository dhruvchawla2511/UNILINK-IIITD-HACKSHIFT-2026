import { db } from './db.js';
import { HttpError } from './rest.js';
import { visibleRoomSql } from './policies.js';

const ALLOWED = new Set(['👍', '❤️', '😂', '🎉', '😮', '🙏']);
function visibleMessage(user, messageId) {
  const [scope, params] = visibleRoomSql({ user });
  const row = db.prepare(`SELECT m.id, m.room_id FROM messages m JOIN chat_rooms ON chat_rooms.id = m.room_id WHERE m.id = ? AND (${scope})`).get(String(messageId || ''), ...params);
  if (!row) throw new HttpError('Message not found or not accessible', 404);
  return row;
}

export function listReactions(user, body) {
  const roomId = String(body.room_id || '');
  const [scope, params] = visibleRoomSql({ user });
  const ok = db.prepare(`SELECT 1 FROM chat_rooms WHERE id = ? AND (${scope})`).get(roomId, ...params);
  if (!ok) throw new HttpError('You cannot use that room', 403);
  const rows = db.prepare(`SELECT r.message_id, r.user_id, r.emoji, p.full_name AS name
    FROM chat_message_reactions r JOIN messages m ON m.id = r.message_id
    JOIN profiles p ON p.id = r.user_id WHERE m.room_id = ? ORDER BY r.created_at ASC`).all(roomId);
  return { data: rows };
}

export function toggleReaction(user, body, broadcast) {
  const emoji = String(body.emoji || '');
  if (!ALLOWED.has(emoji)) throw new HttpError('Unsupported reaction');
  const message = visibleMessage(user, body.message_id);
  const existing = db.prepare('SELECT 1 FROM chat_message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').get(message.id, user.id, emoji);
  let action;
  if (existing) {
    db.prepare('DELETE FROM chat_message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').run(message.id, user.id, emoji);
    action = 'removed';
  } else {
    db.prepare('INSERT INTO chat_message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)').run(message.id, user.id, emoji);
    action = 'added';
  }
  broadcast({ eventType: 'REACTION', table: 'chat_message_reactions', new: { room_id: message.room_id, message_id: message.id, user_id: user.id, emoji, action }, old: {} });
  return { data: { ok: true, action } };
}
