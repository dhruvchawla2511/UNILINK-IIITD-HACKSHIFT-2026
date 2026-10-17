// Opens the local SQLite database (database/campusconnect.db), creates the
// tables on first run and loads the starter content.
// Uses Node's built-in `node:sqlite` module (Node 22.13+), so there is nothing extra to install.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STARTER_COLLEGES, ELITE_FOREIGN_COLLEGES, indianRow, foreignRow } from './collegeSeed.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DB_PATH = process.env.CAMPUSCONNECT_DB
  ? path.resolve(process.env.CAMPUSCONNECT_DB)
  : path.join(root, 'database', 'campusconnect.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

db.exec(fs.readFileSync(path.join(root, 'database', 'schema.sql'), 'utf8'));

// UniLink planner and saved marketplace listings (idempotent upgrades).
db.exec(`
  CREATE TABLE IF NOT EXISTS student_tasks (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL, details TEXT NOT NULL DEFAULT '', due_date TEXT,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','doing','done')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_student_tasks_user_due ON student_tasks(user_id, status, due_date);
  CREATE TABLE IF NOT EXISTS marketplace_saves (
    user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    listing_id TEXT NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    PRIMARY KEY(user_id, listing_id)
  );
`);

// ---- upgrade databases created before college ranks existed ----
const hasColumn = (table, column) => db.prepare('SELECT 1 FROM pragma_table_info(?) WHERE name = ?').get(table, column) !== undefined;
// Upgrade existing SQLite databases for multi-day campus events.
if (!hasColumn('events', 'end_date')) {
  db.exec('ALTER TABLE events ADD COLUMN end_date TEXT');
  db.exec('UPDATE events SET end_date = event_date WHERE end_date IS NULL');
}
if (!hasColumn('profiles', 'college_role')) {
  db.exec(`ALTER TABLE profiles ADD COLUMN college_role TEXT NOT NULL DEFAULT 'member' CHECK (college_role IN ('member', 'committee_head', 'secretary', 'vice_president', 'president'))`);
}
if (!hasColumn('profiles', 'committee_name')) db.exec('ALTER TABLE profiles ADD COLUMN committee_name TEXT');
if (!hasColumn('profiles', 'message_privacy')) db.exec("ALTER TABLE profiles ADD COLUMN message_privacy TEXT NOT NULL DEFAULT 'everyone' CHECK (message_privacy IN ('everyone','friends'))");

// ---- upgrade databases created before social links existed ----
for (const c of ['linkedin_url', 'github_url', 'portfolio_url']) {
  if (!hasColumn('profiles', c)) db.exec(`ALTER TABLE profiles ADD COLUMN ${c} TEXT`);
}

// ---- upgrade databases created before chat attachments and polls existed ----
if (!hasColumn('messages', 'msg_type')) {
  db.exec(`ALTER TABLE messages ADD COLUMN msg_type TEXT NOT NULL DEFAULT 'text' CHECK (msg_type IN ('text', 'image', 'video', 'audio', 'file', 'poll'))`);
}
for (const c of ['attachment_url TEXT', 'attachment_name TEXT', 'attachment_mime TEXT', 'attachment_size INTEGER']) {
  if (!hasColumn('messages', c.split(' ')[0])) db.exec(`ALTER TABLE messages ADD COLUMN ${c}`);
}
// ---- upgrade databases created before /slowmode /lock /pin /announce existed ----
if (!hasColumn('chat_rooms', 'slowmode_seconds')) db.exec('ALTER TABLE chat_rooms ADD COLUMN slowmode_seconds INTEGER NOT NULL DEFAULT 0');
if (!hasColumn('chat_rooms', 'is_locked')) db.exec('ALTER TABLE chat_rooms ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT 0');
if (!hasColumn('messages', 'pinned_at')) db.exec('ALTER TABLE messages ADD COLUMN pinned_at TEXT');
if (!hasColumn('messages', 'pinned_by')) db.exec('ALTER TABLE messages ADD COLUMN pinned_by TEXT');
if (!hasColumn('messages', 'is_announcement')) db.exec('ALTER TABLE messages ADD COLUMN is_announcement BOOLEAN NOT NULL DEFAULT 0');
// @mentions found by the server when a message is saved (JSON list of {id, name}); see server/mentions.js
if (!hasColumn('messages', 'mentions')) db.exec('ALTER TABLE messages ADD COLUMN mentions TEXT');
if (!hasColumn('messages', 'reply_to_id')) db.exec('ALTER TABLE messages ADD COLUMN reply_to_id TEXT');
db.exec(`CREATE TABLE IF NOT EXISTS chat_message_reactions (message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, emoji TEXT NOT NULL CHECK (emoji IN ('👍', '❤️', '😂', '🎉', '😮', '🙏')), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), PRIMARY KEY (message_id, user_id, emoji)); CREATE INDEX IF NOT EXISTS idx_chat_message_reactions_message ON chat_message_reactions(message_id);`);
db.exec(fs.readFileSync(path.join(root, 'database', 'college_roles.sql'), 'utf8'));

// ---- upgrade databases created before room codes existed ----
// Every chat room has a 6-digit code (100000-999999) that people share to let others join it.
export function newRoomCode() {
  for (let i = 0; i < 200; i++) {
    const code = String(crypto.randomInt(100000, 1000000));
    if (!db.prepare('SELECT 1 FROM chat_rooms WHERE room_code = ?').get(code)) return code;
  }
  throw new Error('Could not find a free room code');
}
if (!hasColumn('chat_rooms', 'room_code')) db.exec('ALTER TABLE chat_rooms ADD COLUMN room_code TEXT');
// Direct messages (1-on-1 chats) are private rooms with dm_key = "<smaller user id>:<larger user id>" and NO room code.
// This must stay above the backfill below, which gives a code to every room that has none (a DM must never get one).
if (!hasColumn('chat_rooms', 'dm_key')) db.exec('ALTER TABLE chat_rooms ADD COLUMN dm_key TEXT');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS ux_chat_rooms_dm ON chat_rooms(dm_key) WHERE dm_key IS NOT NULL');
// Built-in rooms (see server/defaultRooms.js): 'general' = the global room, 'lobby' = a college's entry room (open once the college is chosen).
if (!hasColumn('chat_rooms', 'system_key')) db.exec('ALTER TABLE chat_rooms ADD COLUMN system_key TEXT');
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS ux_chat_rooms_lobby ON chat_rooms(college_id) WHERE system_key = 'lobby'");
// How far a person has read their conversations, private to them (it drives the unread counts, not read receipts)
if (!hasColumn('room_members', 'last_seen_at')) db.exec('ALTER TABLE room_members ADD COLUMN last_seen_at TEXT');
// "Delete chat" on a direct message hides it for one person only: messages up to cleared_at are no longer shown to them
// and dm_hidden keeps an empty conversation out of their list. The other person keeps their copy.
if (!hasColumn('room_members', 'cleared_at')) db.exec('ALTER TABLE room_members ADD COLUMN cleared_at TEXT');
if (!hasColumn('room_members', 'dm_hidden')) db.exec('ALTER TABLE room_members ADD COLUMN dm_hidden INTEGER NOT NULL DEFAULT 0');
for (const { id } of db.prepare('SELECT id FROM chat_rooms WHERE room_code IS NULL AND dm_key IS NULL').all()) {
  db.prepare('UPDATE chat_rooms SET room_code = ? WHERE id = ?').run(newRoomCode(), id);
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS ux_chat_rooms_code ON chat_rooms(room_code)');

// Starter profile fields, added once (so the super admin can delete them without them coming back).
if (db.prepare('PRAGMA user_version').get().user_version < 1) {
  const starter = [
    ['Degree', 'select', 'B.Tech\nB.E.\nB.Sc\nB.Com\nB.A.\nBBA\nBCA\nM.Tech\nM.Sc\nMBA\nMCA\nPh.D.\nDiploma\nOther', 'everyone'],
    ['Branch', 'select', 'Computer Science\nInformation Technology\nElectronics & Communication\nElectrical\nMechanical\nCivil\nAI & Data Science\nOther', 'everyone'],
    ['Year of study', 'select', '1st year\n2nd year\n3rd year\n4th year\n5th year\nPassed out', 'everyone'],
    ['Phone number', 'phone', '', 'admins'],
    ['Roll number', 'text', '', 'admins'],
  ];
  starter.forEach(([label, type, options, visibility], i) => {
    db.prepare('INSERT INTO profile_fields (id, label, field_type, options, visibility, sort_order) VALUES (?, ?, ?, ?, ?, ?)').run(crypto.randomUUID(), label, type, options, visibility, i);
  });
  db.exec('PRAGMA user_version = 1');
}

// People who already had an account before the new-user guide existed do not see it.
if (!hasColumn('profiles', 'onboarding_done')) {
  db.exec('ALTER TABLE profiles ADD COLUMN onboarding_done BOOLEAN NOT NULL DEFAULT 0');
  db.exec('UPDATE profiles SET onboarding_done = 1');
}

// ---- upgrade databases created before the Owner rank and "admins only see rooms they joined" ----
// The oldest super admin becomes the owner. Admins used to see every global and college room, so the rooms
// an admin created are turned into memberships once, and from now on they only see rooms they have joined.
if (!hasColumn('profiles', 'is_owner')) {
  db.exec('ALTER TABLE profiles ADD COLUMN is_owner BOOLEAN NOT NULL DEFAULT 0');
  db.exec(`UPDATE profiles SET is_owner = 1 WHERE id = (SELECT id FROM profiles WHERE role = 'super_admin' ORDER BY created_at, rowid LIMIT 1)`);
  db.exec(`INSERT OR IGNORE INTO room_members (room_id, user_id)
           SELECT r.id, r.created_by FROM chat_rooms r JOIN profiles p ON p.id = r.created_by
            WHERE p.role IN ('admin', 'super_admin') AND r.dm_key IS NULL`);
}

// Colleges got a tier and a country column after the first release.
if (!hasColumn('colleges', 'country')) db.exec('ALTER TABLE colleges ADD COLUMN country TEXT');
if (!hasColumn('colleges', 'tier')) db.exec('ALTER TABLE colleges ADD COLUMN tier TEXT');

// Events can be limited to one college (visibility = 'college'). Older events stay visible to everyone.
if (!hasColumn('events', 'visibility')) {
  db.exec(`ALTER TABLE events ADD COLUMN visibility TEXT NOT NULL DEFAULT 'everyone' CHECK (visibility IN ('everyone', 'college'))`);
}

// Starter college lists, each added once (the version number is stored in PRAGMA user_version):
//   2 = well-known Indian colleges, 3 = elite international universities.
// Colleges with the same name are skipped, and ones the super admin deletes later do not come back.
function addStarterColleges(version, list, toRow) {
  if (db.prepare('PRAGMA user_version').get().user_version >= version) return;
  const exists = db.prepare('SELECT 1 FROM colleges WHERE lower(name) = lower(?)');
  const add = db.prepare('INSERT INTO colleges (id, name, city, state, country, tier, description, domain) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  db.exec('BEGIN');
  for (const entry of list) {
    const r = toRow(entry);
    if (!exists.get(r.name)) add.run(crypto.randomUUID(), r.name, r.city, r.state, r.country, r.tier, r.description, r.domain);
  }
  db.exec(`PRAGMA user_version = ${version}`);
  db.exec('COMMIT');
}
addStarterColleges(2, STARTER_COLLEGES, indianRow);
addStarterColleges(3, ELITE_FOREIGN_COLLEGES, foreignRow);

// Starter colleges added by the first release have "Tier 1 · ..." in the description and no tier/country.
// Move that into the new columns, but only for rows nobody has edited since.
{
  const fix = db.prepare(
    'UPDATE colleges SET tier = ?, country = ?, state = ?, description = ? WHERE lower(name) = lower(?) AND tier IS NULL AND description IS ? AND state IS ?'
  );
  db.exec('BEGIN');
  for (const [list, toRow] of [[STARTER_COLLEGES, indianRow], [ELITE_FOREIGN_COLLEGES, foreignRow]]) {
    for (const entry of list) {
      const r = toRow(entry);
      fix.run(r.tier, r.country, r.state, r.description, r.name, r.was.description, r.was.state);
    }
  }
  db.exec('COMMIT');
}

// Starter content, only while the table is empty.
for (const table of ['home_settings', 'home_slides', 'media_items']) {
  const { n } = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get();
  if (n === 0) db.exec(fs.readFileSync(path.join(root, 'database', 'seed', `${table}.sql`), 'utf8'));
}

// ---- Campus community, clubs, notifications and marketplace ----
db.exec(`
CREATE TABLE IF NOT EXISTS community_posts (
 id TEXT PRIMARY KEY, author_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 college_id TEXT REFERENCES colleges(id) ON DELETE SET NULL,
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_community_posts_created ON community_posts(created_at DESC);
CREATE TABLE IF NOT EXISTS community_comments (
 id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
 author_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 1000), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS community_reactions (
 post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), PRIMARY KEY(post_id,user_id)
);
CREATE TABLE IF NOT EXISTS campus_clubs (
 id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 80), description TEXT NOT NULL DEFAULT '',
 college_id TEXT REFERENCES colleges(id) ON DELETE SET NULL, created_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS club_members (
 club_id TEXT NOT NULL REFERENCES campus_clubs(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), PRIMARY KEY(club_id,user_id)
);
CREATE TABLE IF NOT EXISTS event_rsvps (
 event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'going' CHECK(status IN ('going','interested')), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), PRIMARY KEY(event_id,user_id)
);
CREATE TABLE IF NOT EXISTS campus_notifications (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 actor_id TEXT REFERENCES profiles(id) ON DELETE SET NULL, kind TEXT NOT NULL, message TEXT NOT NULL,
 target_id TEXT, is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_campus_notifications_user ON campus_notifications(user_id,is_read,created_at DESC);
CREATE TABLE IF NOT EXISTS marketplace_listings (
 id TEXT PRIMARY KEY, seller_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 college_id TEXT REFERENCES colleges(id) ON DELETE SET NULL,
 title TEXT NOT NULL CHECK(length(title) BETWEEN 3 AND 100), description TEXT NOT NULL DEFAULT '',
 category TEXT NOT NULL DEFAULT 'Other', price REAL NOT NULL DEFAULT 0 CHECK(price >= 0), condition TEXT NOT NULL DEFAULT 'Good',
 contact_note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','sold','removed')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_marketplace_active ON marketplace_listings(status,created_at DESC);
CREATE TABLE IF NOT EXISTS study_groups (
 id TEXT PRIMARY KEY, title TEXT NOT NULL CHECK(length(title) BETWEEN 3 AND 100), subject TEXT NOT NULL DEFAULT '',
 description TEXT NOT NULL DEFAULT '', meeting_info TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 college_id TEXT REFERENCES colleges(id) ON DELETE SET NULL, image_url TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS study_group_members (
 group_id TEXT NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), PRIMARY KEY(group_id,user_id)
);
CREATE TABLE IF NOT EXISTS campus_opportunities (
 id TEXT PRIMARY KEY, title TEXT NOT NULL CHECK(length(title) BETWEEN 3 AND 120), organization TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT 'Internship',
 description TEXT NOT NULL DEFAULT '', deadline TEXT, apply_url TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 college_id TEXT REFERENCES colleges(id) ON DELETE SET NULL, image_url TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS opportunity_saves (
 opportunity_id TEXT NOT NULL REFERENCES campus_opportunities(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), PRIMARY KEY(opportunity_id,user_id)
);
CREATE TABLE IF NOT EXISTS opportunity_application_tracking (
 opportunity_id TEXT NOT NULL REFERENCES campus_opportunities(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'interested' CHECK(status IN ('interested','applied','interview','offer','rejected','withdrawn')),
 notes TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 PRIMARY KEY(opportunity_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_opportunity_tracking_user ON opportunity_application_tracking(user_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS lost_found_items (
 id TEXT PRIMARY KEY, title TEXT NOT NULL CHECK(length(title) BETWEEN 3 AND 100), description TEXT NOT NULL DEFAULT '',
 item_type TEXT NOT NULL DEFAULT 'Lost' CHECK(item_type IN ('Lost','Found')), location TEXT NOT NULL DEFAULT '', contact_note TEXT NOT NULL DEFAULT '',
 image_url TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
 created_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, college_id TEXT REFERENCES colleges(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS campus_user_blocks (
 blocker_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, blocked_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), PRIMARY KEY(blocker_id,blocked_id), CHECK(blocker_id <> blocked_id)
);
CREATE TABLE IF NOT EXISTS campus_user_reports (
 id TEXT PRIMARY KEY, reporter_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, reported_user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
 target_type TEXT NOT NULL, target_id TEXT, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_study_groups_created ON study_groups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_created ON campus_opportunities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lost_found_status ON lost_found_items(status,created_at DESC);
CREATE TABLE IF NOT EXISTS campus_shared_uploads (upload_id TEXT PRIMARY KEY REFERENCES uploads(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
`);

if (!hasColumn('community_posts', 'college_id')) {
  db.exec('ALTER TABLE community_posts ADD COLUMN college_id TEXT REFERENCES colleges(id) ON DELETE SET NULL');
  db.exec('UPDATE community_posts SET college_id=(SELECT college_id FROM profiles WHERE profiles.id=community_posts.author_id) WHERE college_id IS NULL');
}
if (!hasColumn('marketplace_listings', 'college_id')) {
  db.exec('ALTER TABLE marketplace_listings ADD COLUMN college_id TEXT REFERENCES colleges(id) ON DELETE SET NULL');
  db.exec('UPDATE marketplace_listings SET college_id=(SELECT college_id FROM profiles WHERE profiles.id=marketplace_listings.seller_id) WHERE college_id IS NULL');
}

// ---- profile badges (see server/badges.js) ----
db.exec(`
CREATE TABLE IF NOT EXISTS badges (
 id TEXT PRIMARY KEY, label TEXT NOT NULL CHECK(length(label) BETWEEN 1 AND 24),
 color TEXT NOT NULL DEFAULT 'blue', icon TEXT NOT NULL DEFAULT 'badge-check', description TEXT NOT NULL DEFAULT '',
 officers_can_award INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0,
 created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS user_badges (
 user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, badge_id TEXT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
 granted_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), PRIMARY KEY(user_id, badge_id)
);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON user_badges(badge_id);
`);
// Starter badges, added once (version 4), so an admin can delete them without them coming back.
if (db.prepare('PRAGMA user_version').get().user_version < 4) {
  const add = db.prepare('INSERT INTO badges (id, label, color, icon, description, officers_can_award, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)');
  [
    ['Verified Alumni', 'emerald', 'graduation-cap', 'Confirmed graduate of this college', 0],
    ['Club Lead', 'violet', 'flag', 'Leads a club or student group', 1],
    ['TA', 'amber', 'book-open', 'Teaching assistant', 1],
  ].forEach(([label, color, icon, description, officers], i) => add.run(crypto.randomUUID(), label, color, icon, description, officers, i));
  db.exec('PRAGMA user_version = 4');
}

// ---- column metadata (used to whitelist columns and to turn 0/1 back into booleans) ----
export const tables = {};
for (const { name } of db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).all()) {
  const cols = db.prepare(`SELECT * FROM pragma_table_info(?)`).all(name);
  const fks = db.prepare(`SELECT * FROM pragma_foreign_key_list(?)`).all(name);
  tables[name] = {
    columns: new Set(cols.map((c) => c.name)),
    booleans: new Set(cols.filter((c) => c.type.toUpperCase() === 'BOOLEAN').map((c) => c.name)),
    fks: fks.map((f) => ({ from: f.from, table: f.table, to: f.to })),
  };
}
