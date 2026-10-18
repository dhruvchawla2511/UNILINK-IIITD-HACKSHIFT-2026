// Small lookups for direct messages that the rest of the server needs. Imports only the database, so that
// sanctions.js and policies.js can use it without a circular import.
import { db } from './db.js';

/** Both people always give the same key, whoever starts the conversation. */
export const dmKeyFor = (a, b) => [String(a), String(b)].sort().join(':');

export const isDirectRoom = (roomId) => !!db.prepare('SELECT 1 FROM chat_rooms WHERE id = ? AND dm_key IS NOT NULL').get(String(roomId ?? ''));

/** Has `blockerId` blocked `blockedId`? */
export const hasBlocked = (blockerId, blockedId) => !!db.prepare('SELECT 1 FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?').get(String(blockerId), String(blockedId));

/** An error text when this person may not send in this room because of a block, otherwise null.
 *  The blocked person gets a neutral answer (it does not say who blocked whom). */
export function dmPostingBlock(roomId, userId) {
  const room = db.prepare('SELECT dm_key FROM chat_rooms WHERE id = ?').get(String(roomId ?? ''));
  if (!room?.dm_key) return null;
  const peer = db.prepare('SELECT user_id FROM room_members WHERE room_id = ? AND user_id != ?').get(String(roomId), String(userId))?.user_id;
  if (!peer) return 'This person is no longer on Unilink';
  if (hasBlocked(userId, peer)) return 'You blocked this person. Unblock them to send a message';
  if (hasBlocked(peer, userId)) return "You can't send messages to this person";
  return null;
}
