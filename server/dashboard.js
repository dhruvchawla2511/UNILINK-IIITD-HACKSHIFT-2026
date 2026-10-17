// Admin dashboard: headline counts and a daily activity series. Read-only, website admins only.
//
//   New signups           : accounts created in the chosen period
//   Pending verifications : requests waiting for approval right now (not limited to the period)
//   Active rooms          : rooms where at least one message was sent in the period
//   Reports               : reported messages still open right now (grouped per message, like the moderators' queue)
//
// Days are cut at the viewer's local midnight: the browser sends its offset from UTC and the server
// applies it, so "today" on the chart is the admin's today and not the server's.
import { db } from './db.js';
import { HttpError } from './rest.js';
import { isAdminUser } from './policies.js';

const PERIODS = new Set([7, 14, 30]);
const DAY_MS = 86_400_000;

/** The same grouping the report queue uses, so the number here matches the badge moderators see. */
const REPORT_KEY = "COALESCE(message_id, room_id || '|' || target_id || '|' || COALESCE(message_sent_at, ''))";

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** POST /api/admin/dashboard { days?: 7 | 14 | 30, tz_offset?: minutes east of UTC } */
export function dashboard(user, body) {
  if (!isAdminUser(user)) throw new HttpError('Admin access required', 403);

  const days = PERIODS.has(Number(body.days)) ? Number(body.days) : 14;
  let offset = Math.trunc(Number(body.tz_offset));
  if (!Number.isFinite(offset) || Math.abs(offset) > 14 * 60) offset = 0;
  const modifier = `${offset >= 0 ? '+' : '-'}${Math.abs(offset)} minutes`;

  // Local calendar days, oldest first. Shifting "now" by the offset lets us read local dates with the UTC getters.
  const localNow = new Date(Date.now() + offset * 60_000);
  const todayStart = Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate());
  const labels = [];
  for (let i = days - 1; i >= 0; i--) labels.push(ymd(new Date(todayStart - i * DAY_MS)));
  const since = new Date(Date.parse(`${labels[0]}T00:00:00Z`) - offset * 60_000).toISOString(); // local midnight, as UTC

  const count = (sql, ...params) => db.prepare(sql).get(...params).n;
  const perDay = (table, extra = '') => {
    const rows = db
      .prepare(`SELECT date(created_at, ?) AS d, COUNT(*) AS n FROM ${table} WHERE created_at >= ? ${extra} GROUP BY d`)
      .all(modifier, since);
    const byDay = new Map(rows.map((r) => [r.d, r.n]));
    return labels.map((d) => byDay.get(d) ?? 0);
  };

  const series = {
    signups: perDay('profiles'),
    messages: perDay('messages'),
    reports: perDay('message_reports'),
  };

  return {
    data: {
      days,
      since,
      counts: {
        new_signups: count('SELECT COUNT(*) AS n FROM profiles WHERE created_at >= ?', since),
        total_users: count('SELECT COUNT(*) AS n FROM profiles'),
        pending_verifications: count("SELECT COUNT(*) AS n FROM verifications WHERE status = 'pending'"),
        active_rooms: count('SELECT COUNT(DISTINCT room_id) AS n FROM messages WHERE created_at >= ?', since),
        total_rooms: count('SELECT COUNT(*) AS n FROM chat_rooms'),
        open_reports: count(`SELECT COUNT(DISTINCT ${REPORT_KEY}) AS n FROM message_reports WHERE status = 'open'`),
        new_reports: count('SELECT COUNT(*) AS n FROM message_reports WHERE created_at >= ?', since),
        community_posts: count('SELECT COUNT(*) AS n FROM community_posts'),
        active_marketplace_listings: count("SELECT COUNT(*) AS n FROM marketplace_listings WHERE status = 'active'"),
        upcoming_events: count("SELECT COUNT(*) AS n FROM events WHERE date(COALESCE(end_date,event_date)) >= date('now')"),
        study_groups: count('SELECT COUNT(*) AS n FROM study_groups'),
      },
      daily: labels.map((date, i) => ({ date, signups: series.signups[i], messages: series.messages[i], reports: series.reports[i] })),
    },
  };
}
