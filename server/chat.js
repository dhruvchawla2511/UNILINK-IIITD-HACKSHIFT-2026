// Chat polls. A poll is a message of type 'poll' plus rows in polls / poll_options / poll_votes.
// These need several tables to change together, so they have their own endpoints instead of the generic /api/rest.
import crypto from 'node:crypto';
import { db } from './db.js';
import { HttpError } from './rest.js';
import { policies, visibleRoomSql } from './policies.js';
import { postingBlock } from './sanctions.js';

function assertCanSeeRoom(user, roomId) {
  const [sql, params] = visibleRoomSql({ user });
  if (!db.prepare(`SELECT 1 FROM chat_rooms WHERE id = ? AND ${sql}`).get(roomId, ...params)) throw new HttpError('You cannot use that room', 403);
}

function loadPoll(user, pollId) {
  const poll = db.prepare('SELECT * FROM polls WHERE id = ?').get(String(pollId || ''));
  if (!poll) throw new HttpError('Poll not found', 404);
  assertCanSeeRoom(user, poll.room_id);
  return poll;
}

const announce = (broadcast, poll) => broadcast({ eventType: 'UPDATE', table: 'polls', new: { id: poll.id, message_id: poll.message_id, room_id: poll.room_id }, old: {} });

export function createPoll(user, body, broadcast) {
  const roomId = String(body.room_id || '');
  assertCanSeeRoom(user, roomId);
  const muted = postingBlock(roomId, user.id);
  if (muted) throw new HttpError(muted, 403);

  const question = String(body.question || '').trim();
  if (!question) throw new HttpError('Enter a question');
  if (question.length > 200) throw new HttpError('The question is too long (200 characters max)');

  const options = (Array.isArray(body.options) ? body.options : []).map((o) => String(o ?? '').trim()).filter(Boolean);
  if (options.length < 2) throw new HttpError('Add at least 2 options');
  if (options.length > 10) throw new HttpError('A poll can have at most 10 options');
  if (options.some((o) => o.length > 100)) throw new HttpError('Options can be at most 100 characters');
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) throw new HttpError('Options must be different from each other');

  const messageId = crypto.randomUUID();
  const pollId = crypto.randomUUID();
  db.exec('BEGIN');
  try {
    db.prepare(`INSERT INTO messages (id, room_id, sender_id, content, msg_type) VALUES (?, ?, ?, ?, 'poll')`).run(messageId, roomId, user.id, question);
    db.prepare('INSERT INTO polls (id, message_id, room_id, question, multiple, created_by) VALUES (?, ?, ?, ?, ?, ?)').run(pollId, messageId, roomId, question, body.multiple ? 1 : 0, user.id);
    const add = db.prepare('INSERT INTO poll_options (id, poll_id, text, sort_order) VALUES (?, ?, ?, ?)');
    options.forEach((text, i) => add.run(crypto.randomUUID(), pollId, text, i));
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
  broadcast({ eventType: 'INSERT', table: 'messages', new: message, old: {} });
  return { data: message };
}

/** Replaces the person's votes on a poll. Single-choice polls take at most one option. */
export function votePoll(user, body, broadcast) {
  const poll = loadPoll(user, body.poll_id);
  if (poll.is_closed) throw new HttpError('This poll is closed');
  const ids = [...new Set(Array.isArray(body.option_ids) ? body.option_ids.map(String) : [])];
  if (!poll.multiple && ids.length > 1) throw new HttpError('Pick only one option');
  const valid = db.prepare('SELECT id FROM poll_options WHERE poll_id = ?').all(poll.id).map((o) => o.id);
  if (ids.some((id) => !valid.includes(id))) throw new HttpError('Unknown option');

  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM poll_votes WHERE poll_id = ? AND user_id = ?').run(poll.id, user.id);
    const add = db.prepare('INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES (?, ?, ?)');
    for (const id of ids) add.run(poll.id, id, user.id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  announce(broadcast, poll);
  return { data: { ok: true } };
}

/** The poll's creator, or anyone allowed to remove its message (moderators, admins), can close or reopen it. */
export function setPollClosed(user, body, broadcast) {
  const poll = loadPoll(user, body.poll_id);
  const [sql, params] = policies.messages.delete({ user });
  const allowed = db.prepare(`SELECT 1 FROM messages WHERE id = ? AND (${sql})`).get(poll.message_id, ...params) || poll.created_by === user.id;
  if (!allowed) throw new HttpError('Only the poll creator or a moderator can do that', 403);
  db.prepare('UPDATE polls SET is_closed = ? WHERE id = ?').run(body.closed ? 1 : 0, poll.id);
  announce(broadcast, poll);
  return { data: { ok: true } };
}

/** Every poll in a room, with vote counts and the current person's own votes. */
export function listPolls(user, body) {
  const roomId = String(body.room_id || '');
  assertCanSeeRoom(user, roomId);
  const polls = db.prepare('SELECT * FROM polls WHERE room_id = ?').all(roomId);
  if (!polls.length) return { data: [] };

  const marks = polls.map(() => '?').join(',');
  const pollIds = polls.map((p) => p.id);
  const options = db
    .prepare(`SELECT o.id, o.poll_id, o.text, (SELECT COUNT(*) FROM poll_votes v WHERE v.option_id = o.id) AS votes FROM poll_options o WHERE o.poll_id IN (${marks}) ORDER BY o.sort_order`)
    .all(...pollIds);
  const mine = db.prepare(`SELECT poll_id, option_id FROM poll_votes WHERE user_id = ? AND poll_id IN (${marks})`).all(user.id, ...pollIds);
  const voters = db.prepare(`SELECT poll_id, COUNT(DISTINCT user_id) AS n FROM poll_votes WHERE poll_id IN (${marks}) GROUP BY poll_id`).all(...pollIds);

  return {
    data: polls.map((p) => ({
      id: p.id,
      message_id: p.message_id,
      question: p.question,
      multiple: !!p.multiple,
      is_closed: !!p.is_closed,
      created_by: p.created_by,
      total_voters: voters.find((v) => v.poll_id === p.id)?.n ?? 0,
      options: options.filter((o) => o.poll_id === p.id).map((o) => ({ id: o.id, text: o.text, votes: o.votes })),
      my_votes: mine.filter((m) => m.poll_id === p.id).map((m) => m.option_id),
    })),
  };
}
