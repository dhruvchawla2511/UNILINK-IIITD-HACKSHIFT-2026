-- Unilink local database (SQLite)
-- Mirrors the Supabase schema in supabase/migrations/, plus the `users` and
-- `sessions` tables that Supabase Auth used to provide.
-- Applied automatically by server/db.js. Every statement is idempotent.

PRAGMA foreign_keys = ON;

-- ============ AUTH ============

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ============ APP TABLES ============

CREATE TABLE IF NOT EXISTS colleges (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  name        TEXT NOT NULL,
  domain      TEXT,
  city        TEXT,
  state       TEXT,
  country     TEXT,
  -- 'Tier 1' | 'Tier 2' | 'Elite' (international), or empty. A rough grouping for the directory, not an official ranking.
  tier        TEXT,
  description TEXT,
  logo_url    TEXT,
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS profiles (
  id          TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin', 'super_admin')),
  college_id  TEXT REFERENCES colleges(id) ON DELETE SET NULL,
  is_verified BOOLEAN NOT NULL DEFAULT 0,
  avatar_url  TEXT,
  bio         TEXT,
  -- College-level rank. It only counts inside the user's own college (see server/policies.js).
  college_role   TEXT NOT NULL DEFAULT 'member' CHECK (college_role IN ('member', 'committee_head', 'secretary', 'vice_president', 'president')),
  committee_name TEXT,
  -- The single website owner: a super admin who also sees every room (see server/policies.js visibleRoomSql). Never changeable through the data API.
  is_owner    BOOLEAN NOT NULL DEFAULT 0,
  -- 0 until the new-user guide (choose college, get verified, join a room) has been finished or skipped
  onboarding_done BOOLEAN NOT NULL DEFAULT 0,
  -- Optional social / portfolio links shown on the profile card (validated in server/socialLinks.js)
  linkedin_url  TEXT,
  github_url    TEXT,
  portfolio_url TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS chat_rooms (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  name        TEXT NOT NULL,
  description TEXT,
  room_type   TEXT NOT NULL CHECK (room_type IN ('global', 'college', 'private')),
  -- 6-digit code people share to join the room (set by the server, see server/rooms.js; unique index is created in server/db.js)
  room_code   TEXT,
  college_id  TEXT REFERENCES colleges(id) ON DELETE CASCADE,
  created_by  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS room_members (
  id        TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  room_id   TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (room_id, user_id)
);

-- Chat history lives here.
CREATE TABLE IF NOT EXISTS messages (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  room_id    TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  -- text | image | video | audio | file | poll   (attachments and polls: see server/uploads.js, server/chat.js)
  msg_type        TEXT NOT NULL DEFAULT 'text' CHECK (msg_type IN ('text', 'image', 'video', 'audio', 'file', 'poll')),
  attachment_url  TEXT,
  attachment_name TEXT,
  attachment_mime TEXT,
  attachment_size INTEGER,
  reply_to_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Read receipts: one row per person per room, holding how far they have read.
-- A message counts as "seen" by someone when their last_read_at is at or after the message's created_at.
-- People who turn read receipts off simply never get a row (see server/presence.js).
CREATE TABLE IF NOT EXISTS chat_message_reactions (
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (emoji IN ('👍', '❤️', '😂', '🎉', '😮', '🙏')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (message_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS idx_chat_message_reactions_message ON chat_message_reactions(message_id);

CREATE TABLE IF NOT EXISTS room_reads (
  room_id      TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at TEXT NOT NULL,
  PRIMARY KEY (room_id, user_id)
);

-- Direct messages: a conversation is a private chat_rooms row with dm_key set (see server/dm.js).
-- Blocking: the blocker and the blocked person can no longer message each other. Never readable through the data API.
CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (blocker_id, blocked_id)
);

-- Files sent in chat. The bytes live in database/uploads/<id>; this row says who owns them.
CREATE TABLE IF NOT EXISTS uploads (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  mime          TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('image', 'video', 'audio', 'file')),
  size          INTEGER NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Polls posted in chat (one poll = one message of type 'poll').
CREATE TABLE IF NOT EXISTS polls (
  id         TEXT PRIMARY KEY,
  message_id TEXT NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
  room_id    TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  question   TEXT NOT NULL,
  multiple   BOOLEAN NOT NULL DEFAULT 0,
  is_closed  BOOLEAN NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS poll_options (
  id         TEXT PRIMARY KEY,
  poll_id    TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id    TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id  TEXT NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (option_id, user_id)
);

CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  event_date  TEXT NOT NULL,
  end_date    TEXT,
  location    TEXT,
  category    TEXT DEFAULT 'general',
  college_id  TEXT REFERENCES colleges(id) ON DELETE SET NULL,
  created_by  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  show_on_home BOOLEAN NOT NULL DEFAULT 1,
  -- 'everyone' | 'college' (only verified students of college_id, plus admins and the creator; see server/policies.js)
  visibility  TEXT NOT NULL DEFAULT 'everyone' CHECK (visibility IN ('everyone', 'college')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- "My college is not listed" requests. Admins approve them (server/colleges.js), which adds the college.
CREATE TABLE IF NOT EXISTS college_requests (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  name        TEXT NOT NULL,
  city        TEXT,
  state       TEXT,
  country     TEXT,
  domain      TEXT,
  note        TEXT,
  requested_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  college_id  TEXT REFERENCES colleges(id) ON DELETE SET NULL,   -- the college that was created (or already existed) when approved
  resolved_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS verifications (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  user_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  college_id  TEXT NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  verified_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS home_settings (
  id             INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hero_title     TEXT NOT NULL DEFAULT 'Welcome to Unilink',
  hero_subtitle  TEXT NOT NULL DEFAULT 'Connect Beyond Campus',
  show_slideshow BOOLEAN NOT NULL DEFAULT 1,
  show_events    BOOLEAN NOT NULL DEFAULT 1,
  show_images    BOOLEAN NOT NULL DEFAULT 1,
  show_videos    BOOLEAN NOT NULL DEFAULT 1,
  events_count   INTEGER NOT NULL DEFAULT 6 CHECK (events_count BETWEEN 1 AND 24),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS home_slides (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  title      TEXT NOT NULL DEFAULT '',
  subtitle   TEXT NOT NULL DEFAULT '',
  image_url  TEXT NOT NULL,
  link_page  TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS media_items (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  media_type    TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  url           TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL DEFAULT '',
  category      TEXT NOT NULL DEFAULT 'General',
  author        TEXT NOT NULL DEFAULT '',
  width         INTEGER NOT NULL DEFAULT 0,
  height        INTEGER NOT NULL DEFAULT 0,
  show_on_home  BOOLEAN NOT NULL DEFAULT 1,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_by    TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Extra profile details (degree, branch, year, phone...). The super admin decides which fields exist
-- (Admin Panel > Profile Fields); each person fills in their own values. See server/profileFields.js.
CREATE TABLE IF NOT EXISTS profile_fields (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  label      TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'textarea', 'number', 'select', 'phone', 'date')),
  options    TEXT NOT NULL DEFAULT '',            -- choices for 'select' fields, one per line
  required   BOOLEAN NOT NULL DEFAULT 0,
  visibility TEXT NOT NULL DEFAULT 'everyone' CHECK (visibility IN ('everyone', 'admins')),  -- admins = only the person and website admins
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS profile_values (
  user_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  field_id   TEXT NOT NULL REFERENCES profile_fields(id) ON DELETE CASCADE,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, field_id)
);

-- Chat moderation: bans, mutes and kicks issued with /ban /mute /kick (see server/commands.js).
-- A row is "active" while revoked_at IS NULL and (expires_at IS NULL or in the future). Rows are kept as a history.
--   ban / kick : the person cannot see or post in the room.   mute : they can read but not post.
CREATE TABLE IF NOT EXISTS room_sanctions (
  id         TEXT PRIMARY KEY,
  room_id    TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('ban', 'mute', 'kick')),
  reason     TEXT,
  expires_at TEXT,                       -- NULL = permanent
  issued_by  TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  issuer_power INTEGER NOT NULL DEFAULT 0, -- the issuer's authority in the room; only equal or higher authority can lift it
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  revoked_at TEXT,
  revoked_by TEXT REFERENCES profiles(id) ON DELETE SET NULL
);

-- Warnings from /warn. Strikes count per room; the third one auto-mutes and the three are then marked cleared.
CREATE TABLE IF NOT EXISTS room_warnings (
  id           TEXT PRIMARY KEY,
  room_id      TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL,
  issued_by    TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  issuer_power INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  cleared_at   TEXT                      -- set when the strikes were used up by an auto-mute
);

-- Minimum rank per chat command, as set by the super admin in the Admin Panel (Chat commands tab).
-- A row only exists while a command differs from its default in server/commands.js; deleting the row resets it.
CREATE TABLE IF NOT EXISTS command_permissions (
  command    TEXT PRIMARY KEY,
  min_power  INTEGER NOT NULL,           -- 0 everyone, 1 room creator, 2 secretary, 3 vice president, 4 president, 100 admins, 101 super admin
  updated_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Reports: "Report message" in chat puts a row here for the room's moderators (see server/reports.js).
-- The text of the message is copied into the row, so the report still makes sense after the message is deleted.
-- Everyone who reports the same message gets their own row; moderators see them grouped.
CREATE TABLE IF NOT EXISTS message_reports (
  id              TEXT PRIMARY KEY,
  message_id      TEXT REFERENCES messages(id) ON DELETE SET NULL,   -- NULL once the message is gone
  room_id         TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  reporter_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id       TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,   -- the author of the reported message
  reason          TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'hate', 'inappropriate', 'other')),
  details         TEXT,
  content         TEXT NOT NULL DEFAULT '',
  msg_type        TEXT NOT NULL DEFAULT 'text',
  attachment_name TEXT,
  message_sent_at TEXT,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'actioned', 'dismissed')),
  action          TEXT CHECK (action IN ('delete', 'mute', 'ban', 'dismiss')),
  message_deleted BOOLEAN NOT NULL DEFAULT 0,
  resolved_by     TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at     TEXT,
  resolution_note TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ============ INDEXES ============

CREATE INDEX IF NOT EXISTS idx_room_warnings_lookup ON room_warnings(room_id, user_id, cleared_at);

CREATE INDEX IF NOT EXISTS idx_profiles_college      ON profiles(college_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_college    ON chat_rooms(college_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_type       ON chat_rooms(room_type);
CREATE INDEX IF NOT EXISTS idx_messages_room         ON messages(room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_polls_room            ON polls(room_id);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll     ON poll_options(poll_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll       ON poll_votes(poll_id, user_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user     ON room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_room_members_room     ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_sanctions_lookup ON room_sanctions(room_id, user_id, kind);
CREATE UNIQUE INDEX IF NOT EXISTS idx_message_reports_once ON message_reports(message_id, reporter_id);
CREATE INDEX IF NOT EXISTS idx_message_reports_status ON message_reports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_message_reports_room   ON message_reports(room_id, status);
CREATE INDEX IF NOT EXISTS idx_events_college        ON events(college_id);
CREATE INDEX IF NOT EXISTS idx_events_date           ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_verifications_status  ON verifications(status);
CREATE INDEX IF NOT EXISTS idx_college_requests_status ON college_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_home_slides_order     ON home_slides(sort_order);
CREATE INDEX IF NOT EXISTS idx_media_items_order     ON media_items(sort_order, created_at DESC);

-- ============ TRIGGERS ============

-- A profile is created for every new user. The very first user becomes super_admin.
CREATE TRIGGER IF NOT EXISTS on_user_created
AFTER INSERT ON users
BEGIN
  INSERT INTO profiles (id, email, full_name, role, is_owner)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.full_name, ''), NEW.email),
    CASE WHEN (SELECT COUNT(*) FROM profiles) = 0 THEN 'super_admin' ELSE 'student' END,
    CASE WHEN (SELECT COUNT(*) FROM profiles) = 0 THEN 1 ELSE 0 END
  );
END;

-- The creator of a private room is automatically a member (otherwise they could not see it).
CREATE TRIGGER IF NOT EXISTS on_private_room_created
AFTER INSERT ON chat_rooms
WHEN NEW.room_type = 'private'
BEGIN
  INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (NEW.id, NEW.created_by);
END;

-- Admins and super admins only see rooms they have joined, so a global/college room an admin creates
-- must start with the admin as a member (private rooms are handled by the trigger above).
CREATE TRIGGER IF NOT EXISTS on_admin_room_created
AFTER INSERT ON chat_rooms
WHEN NEW.room_type <> 'private' AND NEW.dm_key IS NULL
  AND EXISTS (SELECT 1 FROM profiles WHERE id = NEW.created_by AND role IN ('admin', 'super_admin'))
BEGIN
  INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (NEW.id, NEW.created_by);
END;

-- Friend requests and accepted friendships for private messaging.
CREATE TABLE IF NOT EXISTS friend_requests (
  id TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(requester_id, addressee_id),
  CHECK(requester_id <> addressee_id)
);
CREATE INDEX IF NOT EXISTS idx_friend_requests_addressee ON friend_requests(addressee_id,status);
