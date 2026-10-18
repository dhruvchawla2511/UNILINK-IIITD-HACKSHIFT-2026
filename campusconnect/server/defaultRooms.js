// Built-in chat rooms every installation gets without an admin having to set anything up:
//   - "General": one global room everybody can see and post in from their first sign-in.
//   - "<College> Lobby": one room per college, open to everyone who has CHOSEN that college on their profile
//     (verification is not needed). The verified-only college rooms work exactly as before.
// Lobbies are created the first time anyone picks a college, so there are no hundreds of empty rooms to start with.
import crypto from 'node:crypto';
import { db, newRoomCode } from './db.js';

db.exec('CREATE TABLE IF NOT EXISTS app_flags (key TEXT PRIMARY KEY)');

// Rooms need an owner (created_by). Prefer the super admin, then any admin, then the oldest account.
function ownerId() {
  return db.prepare(`SELECT id FROM profiles ORDER BY CASE role WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, rowid LIMIT 1`).get()?.id ?? null;
}

/** Creates the global "General" room once. An admin who deletes it later does not get it back. */
export function ensureGeneralRoom() {
  if (db.prepare(`SELECT 1 FROM app_flags WHERE key = 'general_room'`).get()) return;
  const owner = ownerId();
  if (!owner) return; // nobody has signed up yet; this runs again after the first sign-up
  db.exec('BEGIN');
  try {
    // If an admin already made a global room before this feature existed, do not add a second one.
    if (!db.prepare(`SELECT 1 FROM chat_rooms WHERE room_type = 'global'`).get()) {
      db.prepare(`INSERT INTO chat_rooms (id, name, description, room_type, room_code, created_by, system_key) VALUES (?, ?, ?, 'global', ?, ?, 'general')`)
        .run(crypto.randomUUID(), 'General', 'Everyone on UniLink. Say hello and meet students from other colleges.', newRoomCode(), owner);
    }
    db.prepare(`INSERT OR IGNORE INTO app_flags (key) VALUES ('general_room')`).run();
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** Makes sure the college has its lobby room (safe to call as often as you like). */
export function ensureLobby(collegeId) {
  if (!collegeId) return;
  if (db.prepare(`SELECT 1 FROM chat_rooms WHERE system_key = 'lobby' AND college_id = ?`).get(collegeId)) return;
  const college = db.prepare('SELECT name FROM colleges WHERE id = ?').get(collegeId);
  const owner = ownerId();
  if (!college || !owner) return;
  db.prepare(`INSERT INTO chat_rooms (id, name, description, room_type, room_code, college_id, created_by, system_key) VALUES (?, ?, ?, 'college', ?, ?, ?, 'lobby')`)
    .run(crypto.randomUUID(), `${college.name} Lobby`.slice(0, 120), `Open to everyone who chose ${college.name} on their profile. Verified students also get the verified-only college rooms.`, newRoomCode(), collegeId, owner);
}

/** Runs at start-up: General (if anyone has an account) and a lobby for every college that already has students. */
export function ensureDefaultRooms() {
  ensureGeneralRoom();
  for (const { college_id } of db.prepare('SELECT DISTINCT college_id FROM profiles WHERE college_id IS NOT NULL').all()) ensureLobby(college_id);
}
