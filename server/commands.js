// Chat commands typed in the message box: /help /mute /unmute /kick /ban /unban /bans /warn /slowmode /lock /unlock /pin /unpin /announce /clear.
//
// WHO MAY DO WHAT is decided here, on the server, from the person's "power" in the room (powerIn below):
//
//   Website super admin  101   anything, in any room, on anyone except another super admin
//   Website admin        100   anything, in any room, on anyone except admins and the super admin
//   President           4  \
//   Vice president      3   } in the rooms of their OWN college, while verified there
//   Secretary           2  /
//   Room owner          2   the creator of a PRIVATE room, inside that room
//   Room creator        1   the creator of a college room (committee heads too: they manage the rooms they made)
//   Everyone else       0
//
// Each command needs a minimum power. COMMANDS below holds the defaults; the super admin can override any of them in
// the Admin Panel (Chat commands tab, stored in command_permissions).
// and you can only act on someone whose power in that room is LOWER than yours. Nobody can act on themselves.
// A ban or mute can only be lifted by someone with at least the power of whoever issued it.
//
// Global rooms have no college, so only website admins can moderate them.
import crypto from 'node:crypto';
import { db } from './db.js';
import { HttpError } from './rest.js';
import { visibleRoomSql } from './policies.js';
import { COLLEGE_RANK, powerIn } from './power.js';
import { activeSanction, activeSanctionsInRoom } from './sanctions.js';
import { removeUploadByUrl } from './uploads.js';

export const KICK_LOCKOUT_MIN = 10; // college and global rooms: a kick keeps the person out for this long
export const DEFAULT_MUTE_MIN = 10;
export const WARN_LIMIT = 3; // strikes in one room before the automatic mute
export const WARN_MUTE_MIN = 60; // how long that automatic mute lasts
const MAX_SLOWMODE_SEC = 6 * 3600;
const MAX_CLEAR = 100;
const MAX_ANNOUNCE = 1000;
const MAX_DAYS = 365;
const MAX_REASON = 200;

const ROLE_LABEL = { committee_head: 'Committee Head', secretary: 'Secretary', vice_president: 'Vice President', president: 'President' };

export const COMMANDS = {
  help: { min: 0, fixed: true, usage: '/help [command]', summary: 'Show the commands you can use in this room.' },
  mute: {
    min: 1, floor: 1,
    usage: '/mute @name [time] [reason]',
    summary: `Stop someone posting for a while (${DEFAULT_MUTE_MIN} minutes if you give no time). They can still read the room.`,
    example: '/mute @Priya_Sharma 30m spamming',
  },
  unmute: { min: 1, floor: 1, usage: '/unmute @name', summary: 'Let a muted person post again.', example: '/unmute @Priya_Sharma' },
  kick: {
    min: 1, floor: 1,
    usage: '/kick @name [reason]',
    summary: `Remove someone from the room. In a private room they can come back with the code; in college and global rooms they are kept out for ${KICK_LOCKOUT_MIN} minutes.`,
    example: '/kick @Priya_Sharma off topic',
  },
  ban: {
    min: 2, floor: 1,
    usage: '/ban @name [time] [reason]',
    summary: 'Remove someone and stop them coming back with the code. Permanent unless you give a time.',
    example: '/ban @Priya_Sharma 7d harassment',
  },
  unban: { min: 2, floor: 1, usage: '/unban @name', summary: 'Lift a ban or kick. In a private room they still need the code to join again.', example: '/unban @Priya_Sharma' },
  bans: { min: 1, usage: '/bans', summary: 'List who is banned, kicked or muted in this room right now.' },
  warn: {
    min: 1, floor: 1,
    usage: '/warn @name reason',
    summary: `Record a warning against someone. After ${WARN_LIMIT} warnings in a room they are muted automatically for ${WARN_MUTE_MIN} minutes and the count starts again.`,
    example: '/warn @Priya_Sharma please keep it on topic',
  },
  slowmode: {
    min: 1,
    usage: '/slowmode [time|off]',
    summary: 'Limit how often each person can post in this room, e.g. 30s, 2m, up to 6h. Officers are not slowed down. Without a time it shows the current setting.',
    example: '/slowmode 30s',
  },
  lock: { min: 1, usage: '/lock', summary: 'Only officers can post in this room until you /unlock it. Everyone can still read.' },
  unlock: { min: 1, usage: '/unlock', summary: 'Let everyone post in this room again.' },
  pin: {
    min: 1,
    usage: '/pin [n]',
    summary: 'Pin the latest message to the top of the room (or the nth latest, e.g. /pin 2). A room has one pinned message; pinning another replaces it.',
    example: '/pin',
  },
  unpin: { min: 1, usage: '/unpin', summary: "Remove the room's pinned message." },
  announce: {
    min: 2,
    usage: '/announce text',
    summary: "Post a highlighted notice in every room of this college (in a private room, just this one). In a global room, website admins reach every global room.",
    example: '/announce Fest registrations close on Friday',
  },
  clear: {
    min: 1,
    usage: '/clear n',
    summary: `Delete the last n messages in this room (up to ${MAX_CLEAR}), for cleaning up after spam. This cannot be undone.`,
    example: '/clear 20',
  },
};

// ---------------------------------------------------------------- who may use which command (defaults + super admin overrides)

/** The ranks the Admin Panel offers, lowest first. `value` is a power from the table at the top of this file. */
export const PERMISSION_LEVELS = [
  { value: 0, label: 'Everyone', who: 'Everyone' },
  { value: 1, label: 'Room creator and above', who: 'Room creator, secretary and above (own college), private room owners, website admins' },
  { value: 2, label: 'Secretary and above', who: 'Secretary and above (own college), private room owners, website admins' },
  { value: 3, label: 'Vice president and above', who: 'Vice president and above (own college), website admins' },
  { value: 4, label: 'President and above', who: 'President (own college), website admins' },
  { value: 100, label: 'Website admins only', who: 'Website admins' },
  { value: 101, label: 'Super admin only', who: 'Super admin only' },
];
const LEVEL_VALUES = new Set(PERMISSION_LEVELS.map((l) => l.value));

function overrides() {
  const map = new Map();
  for (const r of db.prepare('SELECT command, min_power FROM command_permissions').all()) {
    if (Object.hasOwn(COMMANDS, r.command) && !COMMANDS[r.command].fixed && LEVEL_VALUES.has(r.min_power) && r.min_power >= (COMMANDS[r.command].floor ?? 0)) map.set(r.command, r.min_power);
  }
  return map;
}

/** The minimum power a command needs right now: the super admin's setting, or the default in COMMANDS. */
export const minFor = (name, map = overrides()) => map.get(name) ?? COMMANDS[name].min;
export const whoFor = (name, map = overrides()) => PERMISSION_LEVELS.find((l) => l.value === minFor(name, map))?.who ?? 'Website admins';

/** POST /api/admin/commands : every command with its default and current rank, for the Admin Panel. Super admin only. */
export function listCommandPermissions(user) {
  assertSuperAdmin(user);
  const map = overrides();
  return {
    data: {
      levels: PERMISSION_LEVELS.map(({ value, label }) => ({ value, label })),
      commands: Object.entries(COMMANDS).map(([name, c]) => ({
        name,
        usage: c.usage,
        summary: c.summary,
        default_min: c.min,
        min: minFor(name, map),
        floor: c.floor ?? 0,
        fixed: !!c.fixed,
        who: whoFor(name, map),
      })),
    },
  };
}

/** POST /api/admin/commands/set { command, min_power } : change one command's minimum rank. min_power null (or the default) resets it. */
export function setCommandPermission(user, body, broadcast) {
  assertSuperAdmin(user);
  const name = String(body.command ?? '').replace(/^\//, '').toLowerCase();
  if (!Object.hasOwn(COMMANDS, name)) throw new HttpError(`There is no /${name} command`, 404);
  const def = COMMANDS[name];
  if (def.fixed) throw new HttpError(`/${name} is always available to everyone and cannot be changed`);
  const reset = body.min_power == null || body.min_power === def.min;
  if (reset) {
    db.prepare('DELETE FROM command_permissions WHERE command = ?').run(name);
  } else {
    const v = Number(body.min_power);
    if (!LEVEL_VALUES.has(v)) throw new HttpError('Pick one of the listed ranks');
    if (v < (def.floor ?? 0)) throw new HttpError(`/${name} acts on other people, so it needs at least ${PERMISSION_LEVELS.find((l) => l.value === (def.floor ?? 0)).label.toLowerCase()}`);
    db.prepare(
      `INSERT INTO command_permissions (command, min_power, updated_by) VALUES (?, ?, ?)
       ON CONFLICT(command) DO UPDATE SET min_power = excluded.min_power, updated_by = excluded.updated_by, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
    ).run(name, v, user.id);
  }
  // open chats reload what the person may type
  broadcast({ eventType: 'UPDATE', table: 'command_permissions', new: { command: name }, old: {} });
  return listCommandPermissions(user);
}

function assertSuperAdmin(user) {
  if (loadProfile(user.id)?.role !== 'super_admin') throw new HttpError('Only the super admin can change command permissions', 403);
}

// ---------------------------------------------------------------- who has what power

function titleIn(u, room) {
  if (u.is_owner) return 'Owner';
  if (u.role === 'super_admin') return 'Super admin';
  if (u.role === 'admin') return 'Website admin';
  const p = powerIn(u, room);
  if (room.room_type === 'private') return p ? 'Room owner' : 'Member';
  const rank = room.room_type === 'college' && u.is_verified && u.college_id === room.college_id ? u.college_role : 'member';
  if (ROLE_LABEL[rank] && p >= COLLEGE_RANK.secretary) return ROLE_LABEL[rank];
  if (p) return 'Room creator';
  if (ROLE_LABEL[rank]) return `${ROLE_LABEL[rank]} (moderates only the rooms they created)`;
  return 'Member';
}

// ---------------------------------------------------------------- small helpers

const loadProfile = (id) => db.prepare('SELECT id, full_name, role, is_owner, college_id, is_verified, college_role FROM profiles WHERE id = ?').get(id);
const displayName = (p) => p.full_name?.trim() || 'Unnamed';

function loadRoom(user, roomId) {
  const [sql, params] = visibleRoomSql({ user });
  const room = db.prepare(`SELECT * FROM chat_rooms WHERE id = ? AND ${sql}`).get(String(roomId ?? ''), ...params);
  if (!room) throw new HttpError('You cannot use that room', 403);
  return room;
}

const UNITS = { m: 1, h: 60, d: 1440, w: 10080 }; // in minutes

/** "10m", "2h", "1d12h", "1w" -> minutes. "perm" / "permanent" / "forever" -> Infinity. Anything else -> null. */
export function parseDuration(token) {
  if (/^(perm|permanent|forever)$/i.test(token)) return Infinity;
  if (!/^(?:\d+[mhdw])+$/i.test(token)) return null;
  let total = 0;
  for (const [, n, u] of token.matchAll(/(\d+)([mhdw])/gi)) total += Number(n) * UNITS[u.toLowerCase()];
  return total;
}

export function formatDuration(minutes) {
  const parts = [];
  let left = minutes;
  for (const [name, size] of [['week', 10080], ['day', 1440], ['hour', 60], ['minute', 1]]) {
    const n = Math.floor(left / size);
    if (n) parts.push(`${n} ${name}${n === 1 ? '' : 's'}`);
    left -= n * size;
  }
  return parts.slice(0, 2).join(' ') || '0 minutes';
}

/** Splits "@name 10m reason words" into who / minutes / reason. `allowTime` is false for /kick. */
function parseArgs(rest, { allowTime }) {
  const m = /^@"([^"]+)"\s*([\s\S]*)$/.exec(rest) || /^@(\S+)\s*([\s\S]*)$/.exec(rest);
  if (!m) throw new HttpError('Say who with @name, for example /ban @Priya_Sharma 1d spamming. Use _ for spaces, or @"Priya Sharma"');
  const who = m[1];
  let tail = m[2].trim();
  let minutes = null; // null = no time given
  if (allowTime && tail) {
    const [first, ...others] = tail.split(/\s+/);
    const d = parseDuration(first);
    if (d !== null) {
      if (d !== Infinity && d < 1) throw new HttpError('The time must be at least 1 minute');
      if (d !== Infinity && d > MAX_DAYS * 1440) throw new HttpError(`The time can be at most ${MAX_DAYS} days. Use "perm" for permanent`);
      minutes = d;
      tail = others.join(' ');
    }
  }
  if (tail.length > MAX_REASON) throw new HttpError(`The reason is too long (${MAX_REASON} characters max)`);
  return { who, minutes, reason: tail || null };
}

/** The people a command in this room could mean: who can be in the room, plus anyone already restricted in it. */
function candidates(room) {
  const sanctioned = 'p.id IN (SELECT user_id FROM room_sanctions WHERE room_id = ? AND revoked_at IS NULL)';
  const hasName = "p.full_name <> ''";
  if (room.room_type === 'private') {
    return db.prepare(`SELECT p.* FROM profiles p WHERE ${hasName} AND (p.id IN (SELECT user_id FROM room_members WHERE room_id = ?) OR ${sanctioned})`).all(room.id, room.id);
  }
  if (room.room_type === 'college') {
    return db
      .prepare(`SELECT p.* FROM profiles p WHERE ${hasName} AND ((p.college_id = ? AND (p.is_verified = 1 OR ${room.system_key === 'lobby' ? 1 : 0})) OR p.role IN ('admin','super_admin') OR ${sanctioned})`)
      .all(room.college_id, room.id);
  }
  return db.prepare(`SELECT p.* FROM profiles p WHERE ${hasName}`).all();
}

const norm = (s) => String(s).trim().toLowerCase().replace(/[\s_]+/g, ' ');

function resolveTarget(room, who) {
  const tag = /^(.*)#([0-9a-f]{3,8})$/i.exec(who);
  const name = norm(tag ? tag[1] : who);
  const idStart = tag ? tag[2].toLowerCase() : null;
  const pool = candidates(room).filter((p) => !idStart || p.id.startsWith(idStart));

  let hits = pool.filter((p) => norm(p.full_name) === name);
  if (!hits.length && name.length >= 3) hits = pool.filter((p) => norm(p.full_name).startsWith(name));
  if (!hits.length) throw new HttpError(`No one called "${who}" found in this room. Check the spelling, or pick the name from the suggestions`, 404);
  if (hits.length > 1) {
    const list = hits.slice(0, 5).map((p) => `${displayName(p).replace(/\s+/g, '_')}#${p.id.slice(0, 4)}`).join(', ');
    throw new HttpError(`More than one person matches "${who}": ${list}. Type one of those exactly`);
  }
  return hits[0];
}

// ---------------------------------------------------------------- authorising

function assertMayUse(actor, room, name) {
  if (powerIn(actor, room) < minFor(name)) {
    const where = room.room_type === 'global' ? ' Only website admins moderate global rooms.' : '';
    throw new HttpError(`You can't use /${name} in this room. It needs: ${whoFor(name)}.${where}`, 403);
  }
}

function assertMayActOn(actor, room, target, verb, past) {
  if (target.id === actor.id) throw new HttpError(`You can't ${verb} yourself`);
  if (target.is_owner) throw new HttpError(`The owner can't be ${past}`, 403);
  if (target.role === 'super_admin' && !actor.is_owner) throw new HttpError(`The super admin can't be ${past}`, 403);
  if (target.role === 'admin' && actor.role !== 'super_admin') throw new HttpError(`Only the super admin can ${verb} a website admin`, 403);
  if (powerIn(actor, room) <= powerIn(target, room)) {
    throw new HttpError(`You can only ${verb} people ranked below you. ${displayName(target)} is ${titleIn(target, room)}`, 403);
  }
}

// ---------------------------------------------------------------- doing it

function notice(room, target, actor, action, row, extra = {}) {
  return {
    eventType: 'INSERT',
    table: 'room_sanctions',
    new: {
      id: row?.id ?? crypto.randomUUID(),
      room_id: room.id,
      room_name: room.name,
      user_id: target.id,
      action, // ban | mute | kick | unban | unmute
      expires_at: row?.expires_at ?? null,
      duration_text: extra.duration_text ?? null,
      strikes: extra.strikes ?? null,
      strike_limit: extra.limit ?? null,
      reason: row?.reason ?? null,
      actor_id: actor.id,
      actor_name: displayName(actor),
      target_name: displayName(target),
    },
    old: {},
  };
}

function revoke(roomId, userId, kinds, byId) {
  const marks = kinds.map(() => '?').join(',');
  db.prepare(
    `UPDATE room_sanctions SET revoked_at = ?, revoked_by = ?
      WHERE room_id = ? AND user_id = ? AND kind IN (${marks}) AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)`
  ).run(new Date().toISOString(), byId, roomId, userId, ...kinds, new Date().toISOString());
}

function addSanction({ room, actor, target, kind, minutes, reason, power }) {
  const id = crypto.randomUUID();
  const expires = minutes === Infinity || minutes == null ? null : new Date(Date.now() + minutes * 60_000).toISOString();
  db.exec('BEGIN');
  try {
    if (kind === 'ban') revoke(room.id, target.id, ['ban', 'kick'], actor.id);
    if (kind === 'mute') revoke(room.id, target.id, ['mute'], actor.id);
    db.prepare('INSERT INTO room_sanctions (id, room_id, user_id, kind, reason, expires_at, issued_by, issuer_power) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, room.id, target.id, kind, reason, expires, actor.id, power);
    // Banned or kicked people also leave a private room's member list (they need the code again after being let back).
    if (room.room_type === 'private' && kind !== 'mute') db.prepare('DELETE FROM room_members WHERE room_id = ? AND user_id = ?').run(room.id, target.id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { id, expires_at: expires, reason };
}

const nm = (p) => displayName(p);

function doMute(actor, room, rest, broadcast) {
  const { who: w, minutes, reason } = parseArgs(rest, { allowTime: true });
  const target = resolveTarget(room, w);
  assertMayActOn(actor, room, target, 'mute', 'muted');
  const mins = minutes ?? DEFAULT_MUTE_MIN;
  const row = addSanction({ room, actor, target, kind: 'mute', minutes: mins, reason, power: powerIn(actor, room) });
  const dur = mins === Infinity ? 'permanently' : `for ${formatDuration(mins)}`;
  broadcast(notice(room, target, actor, 'mute', row, { duration_text: mins === Infinity ? null : formatDuration(mins) }));
  return { kind: 'success', text: `Muted ${nm(target)} ${dur}.` };
}

function doBan(actor, room, rest, broadcast) {
  const { who: w, minutes, reason } = parseArgs(rest, { allowTime: true });
  const target = resolveTarget(room, w);
  assertMayActOn(actor, room, target, 'ban', 'banned');
  const mins = minutes ?? Infinity;
  const row = addSanction({ room, actor, target, kind: 'ban', minutes: mins, reason, power: powerIn(actor, room) });
  const dur = mins === Infinity ? 'permanently' : `for ${formatDuration(mins)}`;
  broadcast(notice(room, target, actor, 'ban', row, { duration_text: mins === Infinity ? null : formatDuration(mins) }));
  return { kind: 'success', text: `Banned ${nm(target)} ${dur}.` };
}

function doKick(actor, room, rest, broadcast) {
  const { who: w, reason } = parseArgs(rest, { allowTime: false });
  const target = resolveTarget(room, w);
  assertMayActOn(actor, room, target, 'kick', 'kicked');
  const existing = activeSanction(room.id, target.id, ['ban', 'kick']);
  if (existing) throw new HttpError(`${nm(target)} is already ${existing.kind === 'ban' ? 'banned' : 'kicked'} from this room`);
  // In a private room a kick just removes the person (they can come back with the code), so the row is already over.
  const mins = room.room_type === 'private' ? 0 : KICK_LOCKOUT_MIN;
  const row = addSanction({ room, actor, target, kind: 'kick', minutes: mins, reason, power: powerIn(actor, room) });
  broadcast(notice(room, target, actor, 'kick', row, { duration_text: mins ? formatDuration(mins) : null }));
  return {
    kind: 'success',
    text: mins ? `Kicked ${nm(target)}. They are kept out for ${formatDuration(mins)}.` : `Kicked ${nm(target)}. They can rejoin with the room code.`,
  };
}

function lift(actor, room, rest, broadcast, { kinds, action, label }) {
  const { who: w } = parseArgs(rest, { allowTime: false });
  const target = resolveTarget(room, w);
  const found = activeSanction(room.id, target.id, kinds);
  if (!found) throw new HttpError(`${nm(target)} is not ${label} in this room`);
  // Only someone with at least the power of whoever issued it can lift it.
  const myPower = powerIn(actor, room);
  if (myPower < found.issuer_power) throw new HttpError(`That was issued by someone ranked above you, so you can't lift it`, 403);
  revoke(room.id, target.id, kinds, actor.id);
  broadcast(notice(room, target, actor, action, null));
  const later = room.room_type === 'private' && action === 'unban' ? ' They need the room code to join again.' : '';
  return { kind: 'success', text: `${nm(target)} is no longer ${label}.${later}` };
}

function listSanctions(actor, room) {
  const rows = activeSanctionsInRoom(room.id);
  const names = new Map();
  const nameOf = (id) => {
    if (!id) return 'someone';
    if (!names.has(id)) names.set(id, loadProfile(id));
    const p = names.get(id);
    return p ? displayName(p) : 'someone';
  };
  return {
    kind: 'list',
    text: rows.length ? 'Active bans, kicks and mutes in this room' : 'No one is banned, kicked or muted in this room.',
    items: rows.map((r) => ({ user_id: r.user_id, name: nameOf(r.user_id), kind: r.kind, expires_at: r.expires_at, reason: r.reason, by: nameOf(r.issued_by) })),
  };
}

// ---------------------------------------------------------------- warnings, slowmode, lock, pin, announce, clear

/** Tells everyone who can see the room that its settings changed (they reload them), with a line to show in the chat. */
function roomChanged(room, actor, change, text) {
  const r = db.prepare('SELECT slowmode_seconds, is_locked FROM chat_rooms WHERE id = ?').get(room.id);
  return {
    eventType: 'UPDATE',
    table: 'room_settings',
    new: { room_id: room.id, change, slowmode_seconds: r.slowmode_seconds, is_locked: !!r.is_locked, actor_id: actor.id, actor_name: displayName(actor), text },
    old: {},
  };
}

function formatSeconds(sec) {
  const parts = [];
  let left = sec;
  for (const [name, size] of [['hour', 3600], ['minute', 60], ['second', 1]]) {
    const n = Math.floor(left / size);
    if (n) parts.push(`${n} ${name}${n === 1 ? '' : 's'}`);
    left -= n * size;
  }
  return parts.join(' ') || '0 seconds';
}

/** "30s", "2m", "1h", or a bare number of seconds. "off" / "0" -> 0. Anything else -> null. */
function parseSeconds(token) {
  if (/^(off|0)$/i.test(token)) return 0;
  const m = /^(\d+)\s*(s|m|h)?$/i.exec(token);
  if (!m) return null;
  return Number(m[1]) * { s: 1, m: 60, h: 3600 }[(m[2] || 's').toLowerCase()];
}

function doWarn(actor, room, rest, broadcast) {
  const { who: w, reason } = parseArgs(rest, { allowTime: false });
  if (!reason) throw new HttpError('Give a reason, for example /warn @Priya_Sharma please keep it on topic');
  const target = resolveTarget(room, w);
  assertMayActOn(actor, room, target, 'warn', 'warned');
  const power = powerIn(actor, room);
  const warnId = crypto.randomUUID();
  let strikes;
  let autoMuted = null;
  db.exec('BEGIN');
  try {
    db.prepare('INSERT INTO room_warnings (id, room_id, user_id, reason, issued_by, issuer_power) VALUES (?, ?, ?, ?, ?, ?)').run(warnId, room.id, target.id, reason, actor.id, power);
    strikes = db.prepare('SELECT COUNT(*) AS n FROM room_warnings WHERE room_id = ? AND user_id = ? AND cleared_at IS NULL').get(room.id, target.id).n;
    if (strikes >= WARN_LIMIT) {
      db.prepare('UPDATE room_warnings SET cleared_at = ? WHERE room_id = ? AND user_id = ? AND cleared_at IS NULL').run(new Date().toISOString(), room.id, target.id);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  broadcast(notice(room, target, actor, 'warn', { id: warnId, expires_at: null, reason }, { strikes: Math.min(strikes, WARN_LIMIT), limit: WARN_LIMIT }));

  if (strikes < WARN_LIMIT) return { kind: 'success', text: `Warned ${nm(target)} (strike ${strikes} of ${WARN_LIMIT}). They are muted automatically at ${WARN_LIMIT}.` };

  // third strike: mute (unless they are already muted, which is just as good)
  if (!activeSanction(room.id, target.id, ['mute'])) {
    const row = addSanction({ room, actor, target, kind: 'mute', minutes: WARN_MUTE_MIN, reason: `Automatic mute after ${WARN_LIMIT} warnings. Last warning: ${reason}`.slice(0, MAX_REASON), power });
    autoMuted = formatDuration(WARN_MUTE_MIN);
    broadcast(notice(room, target, actor, 'mute', row, { duration_text: autoMuted }));
  }
  return {
    kind: 'success',
    text: autoMuted ? `Warned ${nm(target)} (strike ${WARN_LIMIT} of ${WARN_LIMIT}). They were muted for ${autoMuted} and their strikes start again.` : `Warned ${nm(target)} (strike ${WARN_LIMIT} of ${WARN_LIMIT}). They were already muted, so their strikes start again.`,
  };
}

function doSlowmode(actor, room, rest, broadcast) {
  if (!rest) {
    return { kind: 'info', text: room.slowmode_seconds ? `Slowmode is on: one message every ${formatSeconds(room.slowmode_seconds)}. Use /slowmode off to turn it off.` : 'Slowmode is off. Use /slowmode 30s to turn it on.' };
  }
  const sec = parseSeconds(rest.split(/\s+/)[0]);
  if (sec === null) throw new HttpError('Give a time like 30s, 2m or 1h, or "off". Example: /slowmode 30s');
  if (sec > MAX_SLOWMODE_SEC) throw new HttpError('Slowmode can be at most 6 hours');
  if (sec === room.slowmode_seconds) throw new HttpError(sec ? `Slowmode is already ${formatSeconds(sec)}` : 'Slowmode is already off');
  db.prepare('UPDATE chat_rooms SET slowmode_seconds = ? WHERE id = ?').run(sec, room.id);
  const text = sec ? `${displayName(actor)} turned on slowmode: one message every ${formatSeconds(sec)} per person.` : `${displayName(actor)} turned off slowmode.`;
  broadcast(roomChanged(room, actor, 'slowmode', text));
  return { kind: 'success', text: sec ? `Slowmode is on: one message every ${formatSeconds(sec)} per person. Officers are not limited.` : 'Slowmode is off.' };
}

function doLock(actor, room, locked, broadcast) {
  if (!!room.is_locked === locked) throw new HttpError(locked ? 'This room is already locked' : 'This room is not locked');
  db.prepare('UPDATE chat_rooms SET is_locked = ? WHERE id = ?').run(locked ? 1 : 0, room.id);
  const text = locked ? `${displayName(actor)} locked the room. Only officers can post until it is unlocked.` : `${displayName(actor)} unlocked the room. Everyone can post again.`;
  broadcast(roomChanged(room, actor, locked ? 'lock' : 'unlock', text));
  return { kind: 'success', text: locked ? 'Room locked. Only officers can post.' : 'Room unlocked.' };
}

function doPin(actor, room, rest, broadcast) {
  let n = 1;
  if (rest) {
    if (!/^\d+$/.test(rest)) throw new HttpError('Use /pin to pin the latest message, or /pin 2 for the one before it');
    n = Number(rest);
    if (n < 1 || n > 50) throw new HttpError('Pick a number from 1 to 50 (1 = the latest message)');
  }
  const msg = db.prepare('SELECT id, pinned_at FROM messages WHERE room_id = ? ORDER BY created_at DESC LIMIT 1 OFFSET ?').get(room.id, n - 1);
  if (!msg) throw new HttpError('There is no message to pin yet');
  if (msg.pinned_at) throw new HttpError('That message is already pinned');
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE messages SET pinned_at = NULL, pinned_by = NULL WHERE room_id = ? AND pinned_at IS NOT NULL').run(room.id);
    db.prepare('UPDATE messages SET pinned_at = ?, pinned_by = ? WHERE id = ?').run(new Date().toISOString(), actor.id, msg.id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  broadcast(roomChanged(room, actor, 'pin', `${displayName(actor)} pinned a message.`));
  return { kind: 'success', text: 'Pinned. It now shows at the top of the room.' };
}

function doUnpin(actor, room, broadcast) {
  const r = db.prepare('UPDATE messages SET pinned_at = NULL, pinned_by = NULL WHERE room_id = ? AND pinned_at IS NOT NULL').run(room.id);
  if (!r.changes) throw new HttpError('Nothing is pinned in this room');
  broadcast(roomChanged(room, actor, 'unpin', `${displayName(actor)} removed the pinned message.`));
  return { kind: 'success', text: 'Unpinned.' };
}

function doAnnounce(actor, room, rest, broadcast) {
  if (!rest) throw new HttpError('Write the notice after the command, for example /announce Fest registrations close on Friday');
  if (rest.length > MAX_ANNOUNCE) throw new HttpError(`The notice is too long (${MAX_ANNOUNCE} characters max)`);
  const targets =
    room.room_type === 'college'
      ? db.prepare("SELECT id FROM chat_rooms WHERE room_type = 'college' AND college_id = ?").all(room.college_id)
      : room.room_type === 'global'
        ? db.prepare("SELECT id FROM chat_rooms WHERE room_type = 'global'").all()
        : [{ id: room.id }];
  const ids = [];
  db.exec('BEGIN');
  try {
    const add = db.prepare("INSERT INTO messages (id, room_id, sender_id, content, msg_type, is_announcement) VALUES (?, ?, ?, ?, 'text', 1)");
    for (const t of targets) {
      const id = crypto.randomUUID();
      add.run(id, t.id, actor.id, rest);
      ids.push(id);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  for (const id of ids) broadcast({ eventType: 'INSERT', table: 'messages', new: db.prepare('SELECT * FROM messages WHERE id = ?').get(id), old: {} });
  return { kind: 'success', text: ids.length === 1 ? 'Announcement posted.' : `Announcement posted in ${ids.length} rooms.` };
}

function doClear(actor, room, rest, broadcast) {
  if (!/^\d+$/.test(rest)) throw new HttpError(`Say how many messages to delete, for example /clear 20 (up to ${MAX_CLEAR})`);
  const n = Number(rest);
  if (n < 1 || n > MAX_CLEAR) throw new HttpError(`You can clear between 1 and ${MAX_CLEAR} messages at a time`);
  const rows = db.prepare('SELECT id, room_id, attachment_url FROM messages WHERE room_id = ? ORDER BY created_at DESC LIMIT ?').all(room.id, n);
  if (!rows.length) throw new HttpError('There are no messages to clear');
  db.exec('BEGIN');
  try {
    const del = db.prepare('DELETE FROM messages WHERE id = ?');
    for (const r of rows) del.run(r.id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  for (const r of rows) if (r.attachment_url) removeUploadByUrl(r.attachment_url); // files sent in those messages
  for (const r of rows) broadcast({ eventType: 'DELETE', table: 'messages', new: {}, old: { id: r.id, room_id: r.room_id } });
  broadcast(roomChanged(room, actor, 'clear', `${displayName(actor)} cleared ${rows.length} message${rows.length === 1 ? '' : 's'}.`));
  return { kind: 'success', text: `Deleted ${rows.length} message${rows.length === 1 ? '' : 's'}.` };
}

// ---------------------------------------------------------------- endpoints

/** The room's pinned message in the shape the chat shows at the top, or null. */
function pinnedIn(roomId) {
  const m = db.prepare('SELECT id, content, msg_type, attachment_name, sender_id, pinned_at, pinned_by FROM messages WHERE room_id = ? AND pinned_at IS NOT NULL ORDER BY pinned_at DESC LIMIT 1').get(roomId);
  if (!m) return null;
  const by = m.pinned_by ? loadProfile(m.pinned_by) : null;
  const sender = loadProfile(m.sender_id);
  return {
    id: m.id,
    text: (m.content || m.attachment_name || '').slice(0, 300),
    msg_type: m.msg_type,
    sender_name: sender ? displayName(sender) : 'Unknown',
    pinned_by_name: by ? displayName(by) : null,
    pinned_at: m.pinned_at,
  };
}

/** POST /api/chat/commands { room_id } : what this person may type in this room, for the help panel and suggestions. */
export function listCommands(user, body) {
  const room = loadRoom(user, body.room_id);
  if (room.dm_key) throw new HttpError('Chat commands are not available in direct messages');
  const actor = { ...user, ...loadProfile(user.id) };
  const power = powerIn(actor, room);
  const map = overrides();
  const mute = activeSanction(room.id, user.id, ['mute']);
  return {
    data: {
      room: { id: room.id, name: room.name, room_type: room.room_type, slowmode_seconds: room.slowmode_seconds, is_locked: !!room.is_locked },
      pinned: pinnedIn(room.id),
      power,
      title: titleIn(actor, room),
      commands: Object.entries(COMMANDS).map(([name, c]) => ({ name, usage: c.usage, summary: c.summary, example: c.example ?? null, who: whoFor(name, map), allowed: power >= minFor(name, map) })),
      mute: mute ? { expires_at: mute.expires_at, reason: mute.reason } : null,
    },
  };
}

/** POST /api/chat/command { room_id, text } : runs one typed command. */
export function runCommand(user, body, broadcast) {
  const room = loadRoom(user, body.room_id);
  if (room.dm_key) throw new HttpError('Chat commands are not available in direct messages');
  const text = String(body.text ?? '').trim();
  const m = /^\/([a-zA-Z]+)\s*([\s\S]*)$/.exec(text);
  if (!m) throw new HttpError('Commands start with / and a word. Type /help to see them');
  const name = m[1].toLowerCase();
  const rest = m[2].trim();
  if (!Object.hasOwn(COMMANDS, name)) throw new HttpError(`Unknown command /${name}. Type /help to see what you can use`);

  const actor = { ...user, ...loadProfile(user.id) };
  assertMayUse(actor, room, name);

  switch (name) {
    case 'help': {
      const topic = rest.replace(/^\//, '').toLowerCase();
      if (!topic) return { data: { panel: 'help' } };
      if (!Object.hasOwn(COMMANDS, topic)) throw new HttpError(`There is no /${topic} command`);
      const c = COMMANDS[topic];
      return { data: { kind: 'info', text: `${c.usage}: ${c.summary}${c.example ? ` Example: ${c.example}` : ''} (Who can: ${whoFor(topic)})` } };
    }
    case 'mute': return { data: doMute(actor, room, rest, broadcast) };
    case 'unmute': return { data: lift(actor, room, rest, broadcast, { kinds: ['mute'], action: 'unmute', label: 'muted' }) };
    case 'kick': return { data: doKick(actor, room, rest, broadcast) };
    case 'ban': return { data: doBan(actor, room, rest, broadcast) };
    case 'unban': return { data: lift(actor, room, rest, broadcast, { kinds: ['ban', 'kick'], action: 'unban', label: 'banned or kicked' }) };
    case 'bans': return { data: listSanctions(actor, room) };
    case 'warn': return { data: doWarn(actor, room, rest, broadcast) };
    case 'slowmode': return { data: doSlowmode(actor, room, rest, broadcast) };
    case 'lock': return { data: doLock(actor, room, true, broadcast) };
    case 'unlock': return { data: doLock(actor, room, false, broadcast) };
    case 'pin': return { data: doPin(actor, room, rest, broadcast) };
    case 'unpin': return { data: doUnpin(actor, room, broadcast) };
    case 'announce': return { data: doAnnounce(actor, room, rest, broadcast) };
    case 'clear': return { data: doClear(actor, room, rest, broadcast) };
    default: throw new HttpError('Unknown command');
  }
}

/** For realtime: how much authority this person has in a room (by id). Used to decide who sees the reason. */
export function powerInRoomId(user, roomId) {
  const room = db.prepare('SELECT * FROM chat_rooms WHERE id = ?').get(roomId);
  const p = loadProfile(user.id);
  return room && p ? powerIn({ ...user, ...p }, room) : 0;
}

// ---------------------------------------------------------------- used by the report queue (server/reports.js)
// The queue's one-click buttons go through the same checks as typing /mute, /ban and /clear.

/** The person with their current profile, in the shape powerIn() needs. */
export const actorFor = (user) => ({ ...user, ...loadProfile(user.id) });

/** null if `actor` may use this command here (and, for mute/ban, on this person); otherwise the reason why not. */
export function commandBlock(actor, room, name, target = null) {
  try {
    assertMayUse(actor, room, name);
    if (target && (name === 'mute' || name === 'ban')) assertMayActOn(actor, room, target, name, name === 'ban' ? 'banned' : 'muted');
    return null;
  } catch (e) {
    return e.message;
  }
}

/** Mute or ban one person in a room, like /mute and /ban. `minutes` may be Infinity (ban only) or null for the default. Throws HttpError. */
export function sanctionUser(actor, room, targetId, kind, minutes, reason, broadcast) {
  const target = loadProfile(targetId);
  if (!target) throw new HttpError('That person no longer has an account', 404);
  const block = commandBlock(actor, room, kind, target);
  if (block) throw new HttpError(block, 403);
  const mins = minutes ?? (kind === 'ban' ? Infinity : DEFAULT_MUTE_MIN);
  const row = addSanction({ room, actor, target, kind, minutes: mins, reason: reason ? String(reason).slice(0, MAX_REASON) : null, power: powerIn(actor, room) });
  broadcast(notice(room, target, actor, kind, row, { duration_text: mins === Infinity ? null : formatDuration(mins) }));
  const dur = mins === Infinity ? 'permanently' : `for ${formatDuration(mins)}`;
  return `${kind === 'ban' ? 'Banned' : 'Muted'} ${nm(target)} ${dur}.`;
}

/** Deletes one message (and its file), needing the same rank as /clear. Returns false if it was already gone. */
export function deleteMessageAs(actor, room, messageId, broadcast) {
  assertMayUse(actor, room, 'clear');
  const m = db.prepare('SELECT id, room_id, attachment_url FROM messages WHERE id = ? AND room_id = ?').get(String(messageId), room.id);
  if (!m) return false;
  db.prepare('DELETE FROM messages WHERE id = ?').run(m.id);
  if (m.attachment_url) removeUploadByUrl(m.attachment_url);
  broadcast({ eventType: 'DELETE', table: 'messages', new: {}, old: { id: m.id, room_id: m.room_id } });
  return true;
}

/** What someone's standing in a room is right now: 'banned', 'muted' or null. */
export function standingIn(roomId, userId) {
  if (activeSanction(roomId, userId, ['ban', 'kick'])) return 'banned';
  if (activeSanction(roomId, userId, ['mute'])) return 'muted';
  return null;
}

export const profileOf = loadProfile;
