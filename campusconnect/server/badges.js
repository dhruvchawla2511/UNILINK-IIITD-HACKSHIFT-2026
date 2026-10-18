// Custom profile badges ("Verified Alumni", "Club Lead", "TA", ...). They show next to a person's name in chat,
// posts, comments, direct messages and member lists.
//
//   badges       : the definitions. Website admins create, edit and delete them.
//   user_badges  : who holds which badge.
//
// Who may award or remove a badge:
//   Website admins : any badge, to anyone.
//   College officers (secretary and above, verified): only badges marked "officers can award",
//                    only to verified members of their OWN college, never to themselves.
// The browser only sends ids; every rule is checked here.
import crypto from 'node:crypto';
import { db } from './db.js';
import { HttpError } from './rest.js';
import { COLLEGE_RANK } from './power.js';

export const COLORS = ['slate', 'blue', 'emerald', 'amber', 'rose', 'violet', 'sky'];
export const ICONS = ['badge-check', 'graduation-cap', 'star', 'book-open', 'shield', 'sparkles', 'crown', 'heart', 'flag', 'users'];
export const GRANT_MIN_RANK = COLLEGE_RANK.secretary;
export const MAX_PER_USER = 6;

const isAdmin = (u) => u.role === 'admin' || u.role === 'super_admin';
const officerLevel = (u) => (u.college_id && u.is_verified ? COLLEGE_RANK[u.college_role] ?? 0 : 0);
const clean = (v, max) => String(v ?? '').trim().slice(0, max);

const outBadge = (b) => ({ ...b, officers_can_award: !!b.officers_can_award });

/** Why this viewer may NOT award/remove `badge` for `target` (null = allowed). */
export function grantProblem(viewer, badge, target) {
  if (isAdmin(viewer)) return null;
  if (!badge.officers_can_award) return 'Only website admins can award this badge';
  if (officerLevel(viewer) < GRANT_MIN_RANK) return 'Only website admins and college secretaries, vice presidents and presidents can award badges';
  if (viewer.id === target.id) return 'You cannot award a badge to yourself';
  if (!target.college_id || target.college_id !== viewer.college_id || !target.is_verified) return 'You can only award badges to verified members of your own college';
  return null;
}

const getTarget = (id) => {
  const t = db.prepare('SELECT id, full_name, college_id, is_verified FROM profiles WHERE id = ?').get(clean(id, 80));
  if (!t) throw new HttpError('Person not found', 404);
  return t;
};
const getBadge = (id) => {
  const b = db.prepare('SELECT * FROM badges WHERE id = ?').get(clean(id, 80));
  if (!b) throw new HttpError('Badge not found', 404);
  return b;
};

/** Every badge definition (everyone signed in sees them, since badges are public). */
export function listBadges() {
  return { data: db.prepare('SELECT * FROM badges ORDER BY sort_order, label COLLATE NOCASE').all().map(outBadge) };
}

/** { user_ids: [...] } -> { users: { <id>: [badge ids, in display order] } }. Capped at 200 ids per call. */
export function lookupBadges(_user, body) {
  const ids = [...new Set((Array.isArray(body.user_ids) ? body.user_ids : []).map((i) => clean(i, 80)).filter(Boolean))].slice(0, 200);
  const users = Object.fromEntries(ids.map((i) => [i, []]));
  if (ids.length) {
    const rows = db.prepare(
      `SELECT ub.user_id, ub.badge_id FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
        WHERE ub.user_id IN (${ids.map(() => '?').join(',')}) ORDER BY b.sort_order, b.label COLLATE NOCASE`
    ).all(...ids);
    for (const r of rows) users[r.user_id].push(r.badge_id);
  }
  return { data: { users } };
}

/** Create or update a badge definition (admins). */
export function saveBadge(user, body, broadcast) {
  if (!isAdmin(user)) throw new HttpError('Only website admins can manage badges', 403);
  const label = clean(body.label, 24);
  if (!label) throw new HttpError('Enter a badge name');
  const color = COLORS.includes(body.color) ? body.color : 'blue';
  const icon = ICONS.includes(body.icon) ? body.icon : 'badge-check';
  const description = clean(body.description, 140);
  const officers = body.officers_can_award ? 1 : 0;
  const clash = db.prepare('SELECT 1 FROM badges WHERE lower(label) = lower(?) AND id <> ?').get(label, clean(body.id, 80));
  if (clash) throw new HttpError('A badge with that name already exists', 409);

  let id = clean(body.id, 80);
  if (id) {
    getBadge(id);
    db.prepare('UPDATE badges SET label = ?, color = ?, icon = ?, description = ?, officers_can_award = ? WHERE id = ?').run(label, color, icon, description, officers, id);
  } else {
    id = crypto.randomUUID();
    const next = (db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM badges').get()).n;
    db.prepare('INSERT INTO badges (id, label, color, icon, description, officers_can_award, sort_order, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, label, color, icon, description, officers, next, user.id);
  }
  broadcast?.({ eventType: 'UPDATE', table: 'user_badges', new: { user_id: null }, old: {} });
  return { data: outBadge(getBadge(id)) };
}

/** Delete a badge everywhere (admins). */
export function deleteBadge(user, body, broadcast) {
  if (!isAdmin(user)) throw new HttpError('Only website admins can manage badges', 403);
  const b = getBadge(body.id);
  db.prepare('DELETE FROM badges WHERE id = ?').run(b.id);
  broadcast?.({ eventType: 'DELETE', table: 'user_badges', new: {}, old: { user_id: null } });
  return { data: { ok: true } };
}

/** { user_id } -> every badge, with whether the person has it and whether the viewer may change it. */
export function manageBadges(user, body) {
  const target = getTarget(body.user_id);
  const held = new Set(db.prepare('SELECT badge_id FROM user_badges WHERE user_id = ?').all(target.id).map((r) => r.badge_id));
  const badges = db.prepare('SELECT * FROM badges ORDER BY sort_order, label COLLATE NOCASE').all()
    .map((b) => ({ ...outBadge(b), has: held.has(b.id), can_change: grantProblem(user, b, target) === null }));
  return { data: { badges, can_any: badges.some((b) => b.can_change) } };
}

/** { user_id, badge_id, on: boolean } award or remove. */
export function setBadge(user, body, broadcast) {
  const target = getTarget(body.user_id);
  const badge = getBadge(body.badge_id);
  const problem = grantProblem(user, badge, target);
  if (problem) throw new HttpError(problem, 403);
  if (body.on) {
    if (db.prepare('SELECT 1 FROM user_badges WHERE user_id = ? AND badge_id = ?').get(target.id, badge.id)) return { data: { ok: true } };
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM user_badges WHERE user_id = ?').get(target.id);
    if (n >= MAX_PER_USER) throw new HttpError(`A person can hold at most ${MAX_PER_USER} badges`);
    db.prepare('INSERT INTO user_badges (user_id, badge_id, granted_by) VALUES (?, ?, ?)').run(target.id, badge.id, user.id);
  } else {
    db.prepare('DELETE FROM user_badges WHERE user_id = ? AND badge_id = ?').run(target.id, badge.id);
  }
  broadcast?.({ eventType: body.on ? 'INSERT' : 'DELETE', table: 'user_badges', new: body.on ? { user_id: target.id } : {}, old: body.on ? {} : { user_id: target.id } });
  return { data: { ok: true } };
}

/** People the viewer may award badges to (for the admin screen's search box). Admins: anyone; officers: own college. */
export function searchPeopleForBadges(user, body) {
  const q = clean(body.q, 60);
  if (q.length < 2) return { data: [] };
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  let sql = `SELECT p.id, p.full_name, p.avatar_url, c.name AS college_name FROM profiles p LEFT JOIN colleges c ON c.id = p.college_id
              WHERE p.full_name LIKE ? ESCAPE '\\'`;
  const params = [like];
  if (!isAdmin(user)) {
    if (officerLevel(user) < GRANT_MIN_RANK) throw new HttpError('You cannot award badges', 403);
    sql += ' AND p.college_id = ? AND p.is_verified = 1 AND p.id <> ?';
    params.push(user.college_id, user.id);
  }
  return { data: db.prepare(sql + ' ORDER BY p.full_name COLLATE NOCASE LIMIT 20').all(...params) };
}
