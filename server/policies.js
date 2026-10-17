// Access rules. These replace the Supabase row-level-security policies:
// the server checks them on every request, so the browser cannot bypass them.
//
// Each table has:
//   select / update / delete : (ctx) => [sqlCondition, params]  - which rows the user may touch
//   canInsert                : (ctx, row) => error string | null
//   canUpdate                : (ctx, before, patch) => error string | null
//   defaults                 : columns filled with the current user when missing
import { db, newRoomCode } from './db.js';
import { SOCIAL_KEYS, cleanSocialLinks } from './socialLinks.js';
import { notBannedSql, postingBlock } from './sanctions.js';
import { findMentions } from './mentions.js';

const ALL = ['1=1', []];
const NONE = ['0=1', []];
const isAdmin = (ctx) => ctx.user.role === 'admin' || ctx.user.role === 'super_admin';
const isSuper = (ctx) => ctx.user.role === 'super_admin';
const isOwner = (ctx) => !!ctx.user.is_owner;
const when = (cond) => (cond ? ALL : NONE);

// ---- college ranks ----
// These are separate from the website-wide role (student / admin / super_admin).
// A college rank only ever counts inside the user's own college, and only while they are verified there.
//   president        : manages everything in their college, assigns every rank below
//   vice_president   : same, but cannot touch the president or other vice presidents
//   secretary        : manages every college room and its messages
//   committee_head   : can manage only the college rooms they created
import { COLLEGE_RANK } from './power.js';
export { COLLEGE_RANK };
export const officerLevel = (ctx) => (ctx.user.college_id && ctx.user.is_verified ? COLLEGE_RANK[ctx.user.college_role] ?? 0 : 0);
// Any college rank (committee head and above) may verify students, but only for their own college.
// Raise this (e.g. COLLEGE_RANK.secretary) to limit it to higher ranks.
export const VERIFY_MIN_RANK = COLLEGE_RANK.committee_head;
export const canVerifyStudents = (ctx) => officerLevel(ctx) >= VERIFY_MIN_RANK;
export const isAdminUser = (user) => user.role === 'admin' || user.role === 'super_admin';
const RANK_KEYS = ['college_role', 'committee_name'];

// Validates a change to someone's college_role / committee_name.
function checkRankChange(ctx, before, patch) {
  const newRole = 'college_role' in patch ? patch.college_role : before.college_role;
  const newCommittee = 'committee_name' in patch ? patch.committee_name : before.committee_name;
  if (typeof newRole !== 'string' || !Object.hasOwn(COLLEGE_RANK, newRole)) return 'Unknown college rank';
  if (newRole === 'committee_head') {
    if (!newCommittee || !String(newCommittee).trim()) return 'Enter the committee name';
    if (String(newCommittee).length > 60) return 'Committee name is too long';
  } else if (newCommittee) return 'Only committee heads have a committee name';

  // Website admins can set any rank in any college (one president per college).
  if (isAdmin(ctx)) {
    const collegeId = 'college_id' in patch ? patch.college_id : before.college_id;
    if (newRole !== 'member' && !collegeId) return 'Put the person in a college before giving them a rank';
    if (newRole === 'president') {
      const clash = db.prepare('SELECT 1 FROM profiles WHERE college_id = ? AND college_role = ? AND id <> ?').get(collegeId, 'president', before.id);
      if (clash) return 'This college already has a president. Change their rank first';
    }
    return null;
  }

  // Everyone else: only the president / vice president, only in their own college, only below themselves.
  if (before.id === ctx.user.id) return 'You cannot change your own college rank';
  const level = officerLevel(ctx);
  if (level < COLLEGE_RANK.vice_president) return 'Only the president or vice president can assign college ranks';
  if (!before.college_id || before.college_id !== ctx.user.college_id) return 'You can only manage members of your own college';
  if (!before.is_verified) return 'Only verified members can hold a college rank';
  if (COLLEGE_RANK[before.college_role] >= level) return 'You can only change members ranked below you';
  if (COLLEGE_RANK[newRole] >= level) return 'You can only assign ranks below your own';
  return null;
}

// Rooms the user may edit / delete: their own, plus (secretary and above) every college room of their college.
const roomScope = (ctx) => {
  const parts = ['created_by = ?'];
  const params = [ctx.user.id];
  if (officerLevel(ctx) >= COLLEGE_RANK.secretary) {
    parts.push(`(room_type = 'college' AND college_id = ?)`);
    params.push(ctx.user.college_id);
  }
  return [`(${parts.join(' OR ')})`, params];
};
const superOnly = { select: () => ALL, update: (c) => when(isSuper(c)), delete: (c) => when(isSuper(c)), canInsert: (c) => (isSuper(c) ? null : 'Only the super admin can do that') };

// Rooms the user may see:
//   global  : every signed-in user
//   college : only verified students of that college
//   private : only people who joined with the room's code (the creator is a member automatically)
// Website admins and super admins do NOT see every room: like everyone else's private rooms, they only see
// rooms they have joined (with the room code, see server/rooms.js, or by creating it). Only the website
// owner sees every global and college room, so someone can always find a room's code and moderate it.
// College membership counts only while the person is verified, so changing college on the profile
// (which removes the verified flag, see profiles.canUpdate) immediately closes the old college's chats.
// Anyone with an active /ban or /kick in a room (see server/commands.js) no longer sees that room at all.
export const visibleRoomSql = (ctx, alias = 'chat_rooms') => {
  let sql;
  let params;
  if (isOwner(ctx)) {
    sql = `(${alias}.room_type IN ('global','college') OR EXISTS (SELECT 1 FROM room_members rm WHERE rm.room_id = ${alias}.id AND rm.user_id = ?))`;
    params = [ctx.user.id];
  } else if (isAdmin(ctx)) {
    sql = `EXISTS (SELECT 1 FROM room_members rm WHERE rm.room_id = ${alias}.id AND rm.user_id = ?)`;
    params = [ctx.user.id];
  } else {
    sql = `(${alias}.room_type = 'global'
      OR (${alias}.room_type = 'college' AND ? = 1 AND ${alias}.college_id = ?)
      OR (${alias}.room_type = 'college' AND ${alias}.system_key = 'lobby' AND ${alias}.college_id = ?)
      OR (${alias}.room_type = 'private' AND EXISTS (SELECT 1 FROM room_members rm WHERE rm.room_id = ${alias}.id AND rm.user_id = ?)))`;
    params = [ctx.user.is_verified && ctx.user.college_id ? 1 : 0, ctx.user.college_id ?? '', ctx.user.college_id ?? '', ctx.user.id];
  }
  const [banSql, banParams] = notBannedSql(ctx.user.id, alias);
  return [`(${sql} AND ${banSql})`, [...params, ...banParams]];
};

// ---- profile fields (super admin defines them, see server/profileFields.js) ----
const FIELD_TYPES = ['text', 'textarea', 'number', 'select', 'phone', 'date'];
export function normalizeOptions(raw) {
  const seen = new Set();
  const out = [];
  for (const line of String(raw ?? '').split(/\r?\n/)) {
    const t = line.trim();
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out;
}
// Checks the final shape of a field and cleans the patch/row in place.
function checkField(c, before, data) {
  const merged = { ...before, ...data };
  const label = String(merged.label ?? '').trim();
  if (!label) return 'Enter a field name';
  if (label.length > 40) return 'The field name is too long (40 characters max)';
  const clash = db.prepare('SELECT 1 FROM profile_fields WHERE lower(label) = lower(?) AND id <> ?').get(label, before?.id ?? '');
  if (clash) return 'A field with that name already exists';
  if (!FIELD_TYPES.includes(merged.field_type)) return 'Unknown field type';
  if (before && 'field_type' in data && data.field_type !== before.field_type) return 'The type of an existing field cannot be changed. Delete it and add a new one';
  if (!['everyone', 'admins'].includes(merged.visibility ?? 'everyone')) return 'Unknown visibility';
  const options = normalizeOptions(merged.options);
  if (merged.field_type === 'select') {
    if (options.length < 2) return 'A dropdown needs at least 2 choices (one per line)';
    if (options.length > 100 || options.some((o) => o.length > 60)) return 'Too many choices, or a choice is too long';
  }
  data.label = label;
  data.options = merged.field_type === 'select' ? options.join('\n') : '';
  return null;
}

export const COLLEGE_TIERS = ['Tier 1', 'Tier 2', 'Elite'];

// Logos: either a web link, or a picture uploaded from the admin panel (stored by server/colleges.js).
const LOGO_PATH_RE = /^\/api\/college-logos\/[0-9a-f-]{36}(\?v=\d+)?$/;

// Tidies and checks the text fields of a college (used for new colleges, edits, requests and CSV import).
export function checkCollege(data, isNew) {
  if (isNew || 'name' in data) {
    const name = String(data.name ?? '').trim();
    if (!name) return 'College name is required';
    if (name.length > 120) return 'College name is too long (120 characters max)';
    data.name = name;
  }
  for (const k of ['city', 'state', 'country', 'domain']) {
    if (!(k in data)) continue;
    const v = String(data[k] ?? '').trim();
    if (v.length > 80) return `${k[0].toUpperCase() + k.slice(1)} is too long (80 characters max)`;
    data[k] = v || null;
  }
  if ('description' in data) {
    const v = String(data.description ?? '').trim();
    if (v.length > 300) return 'Description is too long (300 characters max)';
    data.description = v || null;
  }
  if ('tier' in data) {
    const v = String(data.tier ?? '').trim();
    if (v && !COLLEGE_TIERS.includes(v)) return 'Tier must be Tier 1, Tier 2, Elite or empty';
    data.tier = v || null;
  }
  if ('logo_url' in data) {
    const v = String(data.logo_url ?? '').trim();
    if (v.length > 500) return 'The logo link is too long (500 characters max)';
    if (v && !/^https?:\/\/[^\s]+$/i.test(v) && !LOGO_PATH_RE.test(v)) return 'The logo must be a web link starting with http:// or https://';
    data.logo_url = v || null;
  }
  return null;
}

// ---- events that only one college can see ----
// visibility 'college' = verified students of events.college_id, website admins, and the person who posted it.
// Posting one needs a college rank (committee head and above) in that same college, or a website admin.
const EVENT_VISIBILITY = ['everyone', 'college'];
// Dates are plain YYYY-MM-DD strings. The end date may not be before the start date (the form checks this too,
// but the server must not rely on the browser).
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const validDay = (v) => DATE_RE.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`)) && new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v;
function checkEventDates(merged) {
  if (!validDay(String(merged.event_date ?? ''))) return 'Choose a valid start date';
  if (merged.end_date != null && merged.end_date !== '') {
    if (!validDay(String(merged.end_date))) return 'Choose a valid end date';
    if (String(merged.end_date) < String(merged.event_date)) return 'The end date must be on or after the start date';
  }
  return null;
}
function checkEventVisibility(c, merged) {
  const vis = merged.visibility ?? 'everyone';
  if (!EVENT_VISIBILITY.includes(vis)) return 'Unknown event visibility';
  if (vis !== 'college') return null;
  if (!merged.college_id) return 'Choose the college this event is for';
  if (isAdmin(c)) return null;
  if (officerLevel(c) < COLLEGE_RANK.committee_head) return 'Only college officers can limit an event to their college';
  if (merged.college_id !== c.user.college_id) return 'You can only limit events to your own college';
  return null;
}

// "My college is not listed" requests (see server/colleges.js for approving them).
const MAX_PENDING_REQUESTS = 3;
function checkCollegeRequest(c, row) {
  if (row.requested_by !== c.user.id) return 'requested_by must be you';
  for (const k of ['status', 'college_id', 'resolved_by', 'resolved_at', 'created_at']) delete row[k]; // set by the server
  const text = { name: row.name, city: row.city, state: row.state, country: row.country, domain: row.domain };
  const err = checkCollege(text, true);
  if (err) return err;
  Object.assign(row, text);
  if ('note' in row) {
    const note = String(row.note ?? '').trim();
    if (note.length > 300) return 'The note is too long (300 characters max)';
    row.note = note || null;
  }
  if (db.prepare('SELECT 1 FROM colleges WHERE lower(name) = lower(?)').get(row.name)) {
    return 'That college is already in the directory. Search for it on the Colleges page';
  }
  if (db.prepare("SELECT 1 FROM college_requests WHERE lower(name) = lower(?) AND status = 'pending'").get(row.name)) {
    return 'Someone has already asked for that college. An admin will review it soon';
  }
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM college_requests WHERE requested_by = ? AND status = 'pending'").get(c.user.id);
  if (n >= MAX_PENDING_REQUESTS) return `You already have ${MAX_PENDING_REQUESTS} requests waiting. Wait for an answer before sending more`;
  return null;
}

export const policies = {
  profile_fields: {
    select: () => ALL,
    update: (c) => when(isSuper(c)),
    delete: (c) => when(isSuper(c)),
    canInsert: (c, row) => {
      if (!isSuper(c)) return 'Only the super admin can add profile fields';
      const err = checkField(c, null, row);
      if (err) return err;
      if (row.sort_order == null) row.sort_order = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM profile_fields').get().n;
      return null;
    },
    canUpdate: (c, before, patch) => checkField(c, before, patch),
  },

  colleges: {
    select: () => ALL,
    update: (c) => when(isAdmin(c)),
    delete: (c) => when(isAdmin(c)),
    canInsert: (c, row) => (isAdmin(c) ? checkCollege(row, true) : 'Only admins can add colleges'),
    canUpdate: (c, before, patch) => checkCollege(patch, false),
    defaults: ['created_by'],
  },

  profiles: {
    select: () => ALL,
    // A president / vice president can also reach the other members of their own college,
    // but canUpdate below lets them change nothing except college ranks.
    update: (c) => {
      if (isAdmin(c)) return ALL;
      if (officerLevel(c) >= COLLEGE_RANK.vice_president) return ['(id = ? OR college_id = ?)', [c.user.id, c.user.college_id]];
      return ['id = ?', [c.user.id]];
    },
    delete: (c) => ['id = ?', [c.user.id]],
    // Email addresses are private: you see your own, admins see all, and college officers see the
    // people of their own college (members and students who asked to be verified there).
    // Everyone else gets an empty email. Applied to every read, including embedded sender/user info.
    redact: (c, row) => {
      if (!('email' in row) || !row.email) return row;
      if (row.id === c.user.id || isAdmin(c)) return row;
      if (canVerifyStudents(c) && c.user.college_id) {
        if (row.college_id === c.user.college_id) return row;
        if (db.prepare("SELECT 1 FROM verifications WHERE user_id = ? AND college_id = ? AND status = 'pending'").get(row.id, c.user.college_id)) return row;
      }
      return { ...row, email: '' };
    },
    canInsert: () => 'Profiles are created automatically when you sign up',
    canUpdate: (c, before, patch) => {
      const touches = (k) => k in patch && patch[k] !== before[k];
      if (touches('id') || touches('email') || touches('created_at')) return 'That field cannot be changed';
      if (touches('is_owner')) return 'The owner rank cannot be changed here';
      // Nobody (not even the owner) can lower the owner's role, and only the owner can edit their profile.
      if (before.is_owner && before.id !== c.user.id) return 'Only the owner can change the owner';
      if (before.is_owner && touches('role')) return 'The owner must stay a super admin';
      if (SOCIAL_KEYS.some((k) => k in patch)) {
        const err = cleanSocialLinks(patch);
        if (err) return err;
      }
      if (RANK_KEYS.some(touches)) {
        const err = checkRankChange(c, before, patch);
        if (err) return err;
      }
      if (!isAdmin(c) && before.id !== c.user.id) {
        const other = Object.keys(patch).filter(touches).filter((k) => !RANK_KEYS.includes(k));
        return other.length ? 'You can only change college ranks' : null;
      }
      if (isAdmin(c)) {
        if (touches('role')) {
          if (patch.role === 'super_admin' && !isSuper(c)) return 'Only the super admin can grant super admin';
          if (before.role === 'super_admin' && !isSuper(c)) return 'Only the super admin can change a super admin';
        }
        return null;
      }
      if (touches('role') || touches('is_verified')) return 'Only admins can change role or verification';
      // Moving to another college means proving it again: otherwise a verified student could
      // pick any college and walk into its chats.
      if (touches('college_id') && before.is_verified) patch.is_verified = false;
      return null;
    },
  },

  chat_rooms: {
    // Direct messages are left out of the room list on purpose: they live in the Messages page (server/dm.js),
    // and nobody can edit or delete one through this API.
    select: (c) => {
      const [sql, params] = visibleRoomSql(c);
      return [`(${sql} AND dm_key IS NULL)`, params];
    },
    update: (c) => {
      const [sql, params] = roomScope(c);
      return [`(${sql} AND dm_key IS NULL)`, params];
    },
    delete: (c) => {
      const [sql, params] = isAdmin(c) ? ALL : roomScope(c);
      return [`(${sql} AND dm_key IS NULL)`, params];
    },
    canInsert: (c, row) => {
      if (row.created_by !== c.user.id) return 'created_by must be you';
      delete row.dm_key; // only server/dm.js creates direct messages
      if (row.room_type === 'college') {
        if (!row.college_id) return 'Choose a college for this room';
        if (!isAdmin(c)) {
          if (!c.user.is_verified) return 'Only verified students can create a college room';
          if (row.college_id !== c.user.college_id) return 'You can only create rooms for your own college';
        }
      } else {
        delete row.college_id; // global and private rooms belong to no college
      }
      if (row.room_type === 'global' && !isAdmin(c)) return 'Only admins can create global rooms';
      delete row.slowmode_seconds; // set only by /slowmode, /lock and /unlock
      delete row.is_locked;
      row.room_code = newRoomCode(); // always chosen by the server, never by the browser
      return null;
    },
    canUpdate: (c, before, patch) => {
      const touches = (k) => k in patch && patch[k] !== before[k];
      if (before.dm_key || touches('dm_key')) return 'Direct messages cannot be changed';
      if (touches('room_code')) return 'Room codes can only be changed with the New code button';
      if (touches('slowmode_seconds') || touches('is_locked')) return 'Use /slowmode, /lock and /unlock in the chat to change that';
      if (!isAdmin(c) && (touches('room_type') || touches('college_id') || touches('created_by'))) return 'A room\'s type, college and owner cannot be changed';
      return null;
    },
    defaults: ['created_by'],
  },

  room_members: {
    // Only the memberships of rooms the person can see, and joining only happens with a room code (server/rooms.js).
    select: (c) => ['room_id IN (SELECT id FROM chat_rooms WHERE ' + visibleRoomSql(c)[0] + ')', visibleRoomSql(c)[1]],
    update: () => NONE,
    delete: () => NONE, // leaving and removing people go through server/rooms.js (leaveRoom, removeMember)
    canInsert: () => 'Join a room with its 6-digit code',
    defaults: ['user_id'],
  },

  messages: {
    // Messages a person deleted from a direct message ("Delete chat", server/dm.js) are no longer shown to them.
    select: (c) => [
      'room_id IN (SELECT id FROM chat_rooms WHERE ' + visibleRoomSql(c)[0] + ") AND created_at > COALESCE((SELECT rm.cleared_at FROM room_members rm WHERE rm.room_id = messages.room_id AND rm.user_id = ?), '')",
      [...visibleRoomSql(c)[1], c.user.id],
    ],
    update: () => NONE,
    // Own messages, plus moderation: admins anywhere; secretary and above in their college's rooms;
    // committee heads only in the college rooms they created.
    delete: (c) => {
      // Admins may remove any message in a room, but not other people's direct messages (they cannot even read them;
      // a reported one is removed through the report queue)
      if (isAdmin(c)) return ['(sender_id = ? OR room_id IN (SELECT id FROM chat_rooms WHERE dm_key IS NULL))', [c.user.id]];
      const parts = ['sender_id = ?'];
      const params = [c.user.id];
      const level = officerLevel(c);
      if (level >= COLLEGE_RANK.secretary) {
        parts.push(`room_id IN (SELECT id FROM chat_rooms WHERE room_type = 'college' AND college_id = ?)`);
        params.push(c.user.college_id);
      } else if (level >= COLLEGE_RANK.committee_head) {
        parts.push(`room_id IN (SELECT id FROM chat_rooms WHERE room_type = 'college' AND college_id = ? AND created_by = ?)`);
        params.push(c.user.college_id, c.user.id);
      }
      return [`(${parts.join(' OR ')})`, params];
    },
    canInsert: (c, row, db) => {
      if (row.sender_id !== c.user.id) return 'sender_id must be you';
      // The type and file details are decided here from the upload record, never trusted from the browser.
      // (Polls are created through /api/chat/poll.)
      for (const k of ['msg_type', 'attachment_name', 'attachment_mime', 'attachment_size', 'pinned_at', 'pinned_by', 'is_announcement']) delete row[k];
      row.content = typeof row.content === 'string' ? row.content.trim() : '';
      if (row.content.length > 4000) return 'Message is too long (4000 characters max)';

      if (row.attachment_url) {
        const m = /^\/api\/files\/([0-9a-f-]{36})$/.exec(row.attachment_url);
        if (!m) return 'Invalid attachment';
        const up = db.prepare('SELECT * FROM uploads WHERE id = ? AND user_id = ?').get(m[1], c.user.id);
        if (!up) return 'Attachment not found. Upload it again';
        if (db.prepare('SELECT 1 FROM messages WHERE attachment_url = ?').get(row.attachment_url)) return 'That file was already sent';
        row.msg_type = up.kind;
        row.attachment_name = up.original_name;
        row.attachment_mime = up.mime;
        row.attachment_size = up.size;
      } else {
        delete row.attachment_url;
        if (!row.content) return 'Message is empty';
        row.msg_type = 'text';
      }
      const [sql, params] = visibleRoomSql(c);
      const ok = db.prepare(`SELECT 1 FROM chat_rooms WHERE id = ? AND ${sql}`).get(row.room_id, ...params);
      if (!ok) return 'You cannot post in that room';
      const blockedPost = postingBlock(row.room_id, c.user.id); // muted with /mute
      if (blockedPost) return blockedPost;
      row.mentions = JSON.stringify(findMentions(row.content, row.room_id, c.user.id)); // decided here, never trusted from the browser
      return null;
    },
    defaults: ['sender_id'],
  },

  events: {
    // Everyone sees events for everyone. A college-only event is seen by verified students of that college,
    // website admins and the person who posted it.
    select: (c) => {
      if (isAdmin(c)) return ALL;
      return [
        `(visibility = 'everyone' OR created_by = ? OR (visibility = 'college' AND ? = 1 AND college_id = ?))`,
        [c.user.id, c.user.is_verified && c.user.college_id ? 1 : 0, c.user.college_id ?? ''],
      ];
    },
    update: (c) => (isSuper(c) ? ALL : ['created_by = ?', [c.user.id]]),
    delete: (c) => (isSuper(c) ? ALL : ['created_by = ?', [c.user.id]]),
    canInsert: (c, row) => {
      if (row.created_by !== c.user.id) return 'created_by must be you';
      const dateErr = checkEventDates(row);
      if (dateErr) return dateErr;
      if (row.end_date == null || row.end_date === '') row.end_date = row.event_date; // single-day event
      return checkEventVisibility(c, row);
    },
    // Re-checked only when the college or visibility changes, so fixing a typo never fails because a rank changed.
    canUpdate: (c, before, patch) => {
      const touches = (k) => k in patch && patch[k] !== before[k];
      if (touches('event_date') || touches('end_date')) {
        const dateErr = checkEventDates({ ...before, ...patch });
        if (dateErr) return dateErr;
      }
      if (patch.created_by !== undefined && patch.created_by !== before.created_by) return 'The organizer cannot be changed';
      if (!touches('visibility') && !touches('college_id')) return null;
      return checkEventVisibility(c, { ...before, ...patch });
    },
    defaults: ['created_by'],
  },

  college_requests: {
    select: (c) => (isAdmin(c) ? ALL : ['requested_by = ?', [c.user.id]]),
    update: () => NONE, // approving and rejecting goes through server/colleges.js
    delete: (c) => (isAdmin(c) ? ALL : ["(requested_by = ? AND status = 'pending')", [c.user.id]]), // withdraw your own pending request
    canInsert: (c, row) => checkCollegeRequest(c, row),
    defaults: ['requested_by'],
  },

  verifications: {
    // Admins see everything; college officers also see the requests for their own college.
    // Approving / rejecting goes through server/verify.js, which applies the same college check.
    select: (c) => (isAdmin(c) ? ALL : canVerifyStudents(c) ? ['(user_id = ? OR college_id = ?)', [c.user.id, c.user.college_id]] : ['user_id = ?', [c.user.id]]),
    update: (c) => when(isAdmin(c)),
    delete: () => NONE,
    canInsert: (c, row) => {
      if (row.user_id !== c.user.id) return 'user_id must be you';
      if (row.status !== undefined && row.status !== 'pending') return 'New requests must be pending';
      if (row.verified_by) return 'verified_by is set by admins';
      if (db.prepare("SELECT 1 FROM verifications WHERE user_id = ? AND status = 'pending'").get(c.user.id)) {
        return 'You already have a verification request waiting for approval';
      }
      return null;
    },
    defaults: ['user_id'],
  },

  home_settings: { ...superOnly, delete: () => NONE },
  home_slides: { ...superOnly, defaults: ['created_by'] },
  media_items: { ...superOnly, defaults: ['created_by'] },
};
