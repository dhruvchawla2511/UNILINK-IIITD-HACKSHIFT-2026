import crypto from 'node:crypto';
import { db, newRoomCode } from './db.js';
import { HttpError } from './rest.js';
import { removeUploadByUrl } from './uploads.js';

db.exec(`CREATE TABLE IF NOT EXISTS event_attendance (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  attended INTEGER NOT NULL DEFAULT 0 CHECK(attended IN (0,1)),
  marked_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(event_id,user_id)
);`);

db.exec(`CREATE TABLE IF NOT EXISTS mentorship_offers (
  id TEXT PRIMARY KEY, mentor_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL, topics TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
  duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK(duration_minutes IN (15,30,45,60,90)),
  mode TEXT NOT NULL DEFAULT 'online' CHECK(mode IN ('online','in_person','either')),
  availability TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS mentorship_bookings (
  id TEXT PRIMARY KEY, offer_id TEXT NOT NULL REFERENCES mentorship_offers(id) ON DELETE CASCADE,
  mentee_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  preferred_at TEXT NOT NULL, goal TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','cancelled','completed')),
  mentor_note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(offer_id,mentee_id,preferred_at)
);
CREATE TABLE IF NOT EXISTS knowledge_resources (
  id TEXT PRIMARY KEY, author_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '', resource_url TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general', audience TEXT NOT NULL DEFAULT 'everyone' CHECK(audience IN ('everyone','students','teachers','professionals')),
  college_id TEXT REFERENCES colleges(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS interview_meetings (
  id TEXT PRIMARY KEY, application_id TEXT NOT NULL REFERENCES opportunity_applications(id) ON DELETE CASCADE,
  scheduled_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, scheduled_at TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK(duration_minutes IN (15,30,45,60,90)),
  meeting_url TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','completed','cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mentor_offers_active ON mentorship_offers(active,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mentor_bookings_mentor ON mentorship_bookings(offer_id,status,preferred_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_resources_created ON knowledge_resources(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interview_meetings_time ON interview_meetings(scheduled_at,status);`);

const id = () => crypto.randomUUID();
const clean = (v, max = 2000) => String(v ?? '').trim().slice(0, max);
const profile = (userId) => db.prepare('SELECT id,full_name,avatar_url,bio,college_id,is_verified FROM profiles WHERE id=?').get(userId);
function notify(userId, actorId, kind, message, targetId = null) {
  if (!userId || userId === actorId) return;
  db.prepare('INSERT INTO campus_notifications(id,user_id,actor_id,kind,message,target_id) VALUES(?,?,?,?,?,?)')
    .run(id(), userId, actorId, kind, message, targetId);
}

const isAdminUser = (u) => ['admin', 'super_admin'].includes(u?.role);
// User ids are server-generated UUIDs; refuse anything else before it is placed in SQL text.
const safeId = (v) => { if (!/^[0-9a-f-]{36}$/i.test(String(v))) throw new HttpError('Invalid session', 401); return String(v); };
// "All" means: shared with everyone + my own college (admins see everything). It must never expose other colleges' college-only content.
function allScopeSql(alias, user) {
  if (isAdminUser(user)) return '';
  return ` AND (${alias}.college_id IS NULL OR ${alias}.college_id = (SELECT college_id FROM profiles WHERE id='${safeId(user.id)}'))`;
}
// Hide anything made by people the viewer blocked or who blocked the viewer.
function blockedSql(col, user) {
  const me = safeId(user.id);
  return ` AND NOT EXISTS(SELECT 1 FROM campus_user_blocks bk WHERE (bk.blocker_id='${me}' AND bk.blocked_id=${col}) OR (bk.blocker_id=${col} AND bk.blocked_id='${me}'))`;
}
function assertPostVisible(user, postId) {
  const row = db.prepare('SELECT p.college_id FROM community_posts p WHERE p.id=?').get(postId);
  if (!row) throw new HttpError('Post not found', 404);
  if (row.college_id && !isAdminUser(user) && profile(user.id)?.college_id !== row.college_id) throw new HttpError('This post is limited to its college', 403);
}
function requireProfile(user) {
  const p = profile(user.id);
  if (!p) throw new HttpError('Profile not found', 404);
  return p;
}
function visibilityCollege(me, scope) {
  if (scope === 'global') return null;
  if (!me?.college_id) throw new HttpError('Select your college in your profile before sharing college-only content.');
  return me.college_id;
}
function shareImageUpload(userId, url) {
  const match = /^\/api\/files\/([0-9a-f-]{36})$/.exec(clean(url, 500));
  if (!match) return;
  const upload = db.prepare('SELECT id,user_id,kind FROM uploads WHERE id=?').get(match[1]);
  if (!upload || upload.user_id !== userId || upload.kind !== 'image') throw new HttpError('The selected image is unavailable or does not belong to you', 400);
  db.prepare('INSERT OR IGNORE INTO campus_shared_uploads(upload_id,user_id) VALUES(?,?)').run(upload.id,userId);
}
function validateMediaUrls(userId, value, allowedKinds, max = 6) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new HttpError('Media must be uploaded from your device', 400);
  if (value.length > max) throw new HttpError(`Choose no more than ${max} files`, 400);
  const urls = [];
  for (const raw of value) {
    const url = clean(raw, 500);
    const match = /^\/api\/files\/([0-9a-f-]{36})$/.exec(url);
    if (!match) throw new HttpError('One of the uploaded files is invalid', 400);
    const upload = db.prepare('SELECT id,user_id,kind FROM uploads WHERE id=?').get(match[1]);
    if (!upload || upload.user_id !== userId || !allowedKinds.includes(upload.kind)) throw new HttpError('A selected file is unavailable or has an unsupported type', 400);
    urls.push(url);
  }
  return [...new Set(urls)];
}
function ensureEventChatRoom(event) {
  let room = db.prepare('SELECT id,name,created_by,room_code FROM chat_rooms WHERE event_id=?').get(event.id);
  if (room) return room;
  const roomId = id();
  const name = `${clean(event.title, 100)} — Event Chat`.slice(0, 120);
  db.prepare('INSERT INTO chat_rooms(id,name,description,room_type,room_code,event_id,created_by) VALUES(?,?,?,?,?,?,?)')
    .run(roomId, name, `Official chat for ${clean(event.title, 140)}`, 'private', newRoomCode(), event.id, event.created_by);
  db.prepare('INSERT OR IGNORE INTO room_members(room_id,user_id) VALUES(?,?)').run(roomId, event.created_by);
  return db.prepare('SELECT id,name,created_by,room_code FROM chat_rooms WHERE id=?').get(roomId);
}
function listFeed(user, scope = 'all') {
  const me = profile(user.id);
  const scopeSql = scope === 'college' ? ' AND p.college_id = ?' : scope === 'global' ? ' AND p.college_id IS NULL' : allScopeSql('p', user);
  const posts = db.prepare(`SELECT p.id,p.body,p.media_urls,p.created_at,p.author_id,p.college_id,pr.full_name AS author_name,pr.avatar_url AS author_avatar,
    (SELECT COUNT(*) FROM community_reactions r WHERE r.post_id=p.id) AS reaction_count,
    EXISTS(SELECT 1 FROM community_reactions r WHERE r.post_id=p.id AND r.user_id=?) AS reacted,
    (SELECT COUNT(*) FROM community_comments c WHERE c.post_id=p.id) AS comment_count
    FROM community_posts p JOIN profiles pr ON pr.id=p.author_id WHERE 1=1 ${scopeSql} ${blockedSql('p.author_id', user)}
    ORDER BY p.created_at DESC LIMIT 60`).all(...(scope === 'college' ? [user.id, me.college_id] : [user.id]));
  const comments = db.prepare(`SELECT c.id,c.post_id,c.body,c.created_at,c.author_id,p.full_name AS author_name
    FROM community_comments c JOIN profiles p ON p.id=c.author_id WHERE c.post_id IN (${posts.length ? posts.map(() => '?').join(',') : "''"}) ORDER BY c.created_at ASC`).all(...posts.map(p => p.id));
  return posts.map(p => { const mediaUrls = (() => { try { return JSON.parse(p.media_urls || '[]'); } catch { return []; } })(); const media_items = mediaUrls.map(url => { const match = /^\/api\/files\/([0-9a-f-]{36})$/.exec(url); const upload = match ? db.prepare('SELECT kind FROM uploads WHERE id=?').get(match[1]) : null; return { url, kind: upload?.kind === 'video' ? 'video' : 'image' }; }); return { ...p, media_urls: mediaUrls, media_items, reacted: !!p.reacted, comments: comments.filter(c => c.post_id === p.id).slice(-5) }; });
}
function runFeature(user, b) {
  requireProfile(user);
  const action = clean(b.action, 40);
  switch (action) {
    case 'profile.avatar': {
      const url=clean(b.url,500); if(url&&!/^\/api\/files\/[0-9a-f-]{36}$/.test(url)) throw new HttpError('Choose an image from your device',400);
      const old=db.prepare('SELECT avatar_url FROM profiles WHERE id=?').get(user.id)?.avatar_url;
      shareImageUpload(user.id,url); db.prepare('UPDATE profiles SET avatar_url=? WHERE id=?').run(url||null,user.id);
      if(old&&old!==url&&/^\/api\/files\//.test(old)&&!db.prepare('SELECT 1 FROM messages WHERE attachment_url=?').get(old)) removeUploadByUrl(old); // drop the replaced photo
      return {avatar_url:url||null};
    }
    case 'feed.list': return listFeed(user, ['college','global','all'].includes(b.scope) ? b.scope : 'all');
    case 'feed.create': {
      const body = clean(b.body);
      const mediaUrls = validateMediaUrls(user.id, b.media_urls, ['image', 'video'], 6);
      if (!body && !mediaUrls.length) throw new HttpError('Write a message or add an image/video before posting');
      const postId = id();
      const me = profile(user.id); const scope = b.scope === 'global' ? 'global' : 'college';
      db.prepare('INSERT INTO community_posts(id,author_id,body,college_id,media_urls) VALUES(?,?,?,?,?)').run(postId,user.id,body || ' ',visibilityCollege(me, scope),JSON.stringify(mediaUrls));
      return listFeed(user, 'all').find(p => p.id === postId);
    }
    case 'feed.delete': {
      const post = db.prepare('SELECT author_id FROM community_posts WHERE id=?').get(clean(b.id,80));
      if (!post) throw new HttpError('Post not found',404);
      if (post.author_id !== user.id && !['admin','super_admin'].includes(user.role)) throw new HttpError('You can only delete your own posts',403);
      db.prepare('DELETE FROM community_posts WHERE id=?').run(clean(b.id,80)); return { ok:true };
    }
    case 'feed.comment': {
      assertPostVisible(user, clean(b.post_id,80));
      const post = db.prepare('SELECT id,author_id FROM community_posts WHERE id=?').get(clean(b.post_id,80));
      const body = clean(b.body,1000); if (!post) throw new HttpError('Post not found',404); if (!body) throw new HttpError('Comment cannot be empty');
      const commentId=id(); db.prepare('INSERT INTO community_comments(id,post_id,author_id,body) VALUES(?,?,?,?)').run(commentId,post.id,user.id,body);
      notify(post.author_id,user.id,'comment','commented on your post',post.id); return {id:commentId};
    }
    case 'feed.react': {
      assertPostVisible(user, clean(b.post_id,80));
      const post = db.prepare('SELECT id,author_id FROM community_posts WHERE id=?').get(clean(b.post_id,80)); if (!post) throw new HttpError('Post not found',404);
      const existing = db.prepare('SELECT 1 FROM community_reactions WHERE post_id=? AND user_id=?').get(post.id,user.id);
      if (existing) db.prepare('DELETE FROM community_reactions WHERE post_id=? AND user_id=?').run(post.id,user.id);
      else { db.prepare('INSERT INTO community_reactions(post_id,user_id) VALUES(?,?)').run(post.id,user.id); notify(post.author_id,user.id,'reaction','reacted to your post',post.id); }
      return { reacted:!existing };
    }
    case 'clubs.list': { const me=profile(user.id), scope=['college','global','all'].includes(b.scope)?b.scope:'all'; const where=(scope==='college'?'WHERE c.college_id = ?':scope==='global'?'WHERE c.college_id IS NULL':'WHERE 1=1'+allScopeSql('c',user))+blockedSql('c.created_by',user); const params=scope==='college'?[user.id,me.college_id]:[user.id]; return db.prepare(`SELECT c.*,p.full_name AS creator_name,(SELECT COUNT(*) FROM club_members m WHERE m.club_id=c.id) AS member_count, EXISTS(SELECT 1 FROM club_members m WHERE m.club_id=c.id AND m.user_id=?) AS joined FROM campus_clubs c JOIN profiles p ON p.id=c.created_by ${where} ORDER BY c.created_at DESC LIMIT 100`).all(...params).map(c=>({...c,joined:!!c.joined})); }
    case 'clubs.create': {
      const name=clean(b.name,80), description=clean(b.description,800); if(name.length<2) throw new HttpError('Club name must be at least 2 characters');
      const me=profile(user.id); const clubId=id(); const collegeId=visibilityCollege(me,b.scope); db.prepare('INSERT INTO campus_clubs(id,name,description,college_id,created_by) VALUES(?,?,?,?,?)').run(clubId,name,description,collegeId,user.id);
      db.prepare('INSERT INTO club_members(club_id,user_id) VALUES(?,?)').run(clubId,user.id); return {id:clubId};
    }
    case 'clubs.join': {
      const club=db.prepare('SELECT id,name,created_by,college_id FROM campus_clubs WHERE id=?').get(clean(b.club_id,80)); if(!club) throw new HttpError('Club not found',404);
      const me=profile(user.id); if(club.college_id && me.college_id !== club.college_id && !['admin','super_admin'].includes(user.role)) throw new HttpError('This club is limited to its college',403);
      const exists=db.prepare('SELECT 1 FROM club_members WHERE club_id=? AND user_id=?').get(club.id,user.id);
      if(exists) db.prepare('DELETE FROM club_members WHERE club_id=? AND user_id=?').run(club.id,user.id); else { db.prepare('INSERT INTO club_members(club_id,user_id) VALUES(?,?)').run(club.id,user.id); notify(club.created_by,user.id,'club','joined your club',club.id); }
      return {joined:!exists};
    }
    case 'events.list': { const me=profile(user.id), scope=['college','global','all'].includes(b.scope)?b.scope:'all'; const scopeSql=scope==='college'?' AND e.college_id = ?':scope==='global'?" AND (e.college_id IS NULL OR COALESCE(e.visibility,'everyone')='everyone')":''; const params=[user.id,user.is_verified?1:0,user.college_id,user.id,user.role]; if(scope==='college') params.push(me.college_id); return db.prepare(`SELECT e.id,e.title,e.description,e.event_date,e.end_date,e.location,e.category,e.college_id, (SELECT id FROM chat_rooms cr WHERE cr.event_id=e.id) AS event_room_id, (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id=e.id AND r.status='going') AS going_count, (SELECT status FROM event_rsvps r WHERE r.event_id=e.id AND r.user_id=?) AS my_rsvp FROM events e WHERE (COALESCE(e.visibility,'everyone')='everyone' OR (?=1 AND e.college_id=?) OR e.created_by=? OR ? IN ('admin','super_admin')) ${scopeSql} ORDER BY (COALESCE(e.end_date,e.event_date) < date('now')) ASC, CASE WHEN COALESCE(e.end_date,e.event_date) >= date('now') THEN e.event_date END ASC, e.event_date DESC LIMIT 100`).all(...params); }
    case 'events.manage.list': {
      const admin=isAdminUser(user);
      return db.prepare(`SELECT e.id,e.title,e.event_date,e.end_date,e.location,(SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id=e.id AND r.status='going') AS going_count FROM events e WHERE (?=1 OR e.created_by=?) ORDER BY e.event_date DESC LIMIT 100`).all(admin?1:0,user.id);
    }
    case 'events.attendance.list': {
      const event=db.prepare('SELECT id,created_by FROM events WHERE id=?').get(clean(b.id,80));
      if(!event) throw new HttpError('Event not found',404);
      if(event.created_by!==user.id&&!isAdminUser(user)) throw new HttpError('Only the event organizer can manage attendance',403);
      return db.prepare(`SELECT p.id AS user_id,p.full_name,p.email,r.status AS rsvp_status,COALESCE(a.attended,0) AS attended,a.updated_at FROM event_rsvps r JOIN profiles p ON p.id=r.user_id LEFT JOIN event_attendance a ON a.event_id=r.event_id AND a.user_id=r.user_id WHERE r.event_id=? ORDER BY p.full_name`).all(event.id).map(row=>({...row,attended:!!row.attended}));
    }
    case 'events.attendance.set': {
      const event=db.prepare('SELECT id,title,created_by FROM events WHERE id=?').get(clean(b.id,80));
      if(!event) throw new HttpError('Event not found',404);
      if(event.created_by!==user.id&&!isAdminUser(user)) throw new HttpError('Only the event organizer can manage attendance',403);
      const attendee=clean(b.user_id,80); if(!db.prepare("SELECT 1 FROM event_rsvps WHERE event_id=? AND user_id=? AND status='going'").get(event.id,attendee)) throw new HttpError('Student must RSVP as going before attendance can be recorded',400);
      const attended=b.attended===true?1:0;
      db.prepare(`INSERT INTO event_attendance(event_id,user_id,attended,marked_by) VALUES(?,?,?,?) ON CONFLICT(event_id,user_id) DO UPDATE SET attended=excluded.attended,marked_by=excluded.marked_by,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`).run(event.id,attendee,attended,user.id);
      if(attended) notify(attendee,user.id,'event_attendance',`attendance confirmed for ${event.title}`,event.id);
      return {ok:true,attended:!!attended};
    }
    case 'events.certificates.list': return db.prepare(`SELECT e.id AS event_id,e.title,e.event_date,e.end_date,e.location,a.updated_at AS confirmed_at FROM event_attendance a JOIN events e ON e.id=a.event_id WHERE a.user_id=? AND a.attended=1 ORDER BY e.event_date DESC`).all(user.id);
    case 'events.chat.create': {
      const event = db.prepare('SELECT id,title,created_by,visibility,college_id FROM events WHERE id=?').get(clean(b.event_id,80));
      if (!event) throw new HttpError('Event not found',404);
      if (event.created_by !== user.id && !isAdminUser(user)) throw new HttpError('Only the event creator can create its chat room',403);
      const room = ensureEventChatRoom(event);
      return { room_id: room.id, created_by: room.created_by };
    }
    case 'events.chat.join': {
      const event = db.prepare('SELECT id,title,created_by,visibility,college_id FROM events WHERE id=?').get(clean(b.event_id,80));
      if (!event) throw new HttpError('Event not found',404);
      if (event.visibility==='college' && event.created_by!==user.id && !isAdminUser(user) && !(user.is_verified && user.college_id===event.college_id)) throw new HttpError('This event is limited to its college',403);
      if (db.prepare('SELECT 1 FROM campus_user_blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)').get(user.id,event.created_by,event.created_by,user.id)) throw new HttpError('This action is unavailable',403);
      const room = ensureEventChatRoom(event);
      db.prepare('INSERT OR IGNORE INTO room_members(room_id,user_id) VALUES(?,?)').run(room.id,user.id);
      db.prepare("INSERT INTO event_rsvps(event_id,user_id,status) VALUES(?,?,'going') ON CONFLICT(event_id,user_id) DO UPDATE SET status='going'").run(event.id,user.id);
      if (event.created_by !== user.id) notify(event.created_by,user.id,'event',`joined your event: ${event.title}`,event.id);
      return { room_id: room.id, joined: true };
    }
    case 'events.rsvp': {
      const event=db.prepare('SELECT id,title,created_by,event_date,visibility,college_id FROM events WHERE id=?').get(clean(b.event_id,80)); if(!event) throw new HttpError('Event not found',404);
      if(event.visibility==='college' && event.created_by!==user.id && !isAdminUser(user) && !(user.is_verified && user.college_id===event.college_id)) throw new HttpError('This event is limited to its college',403);
      const status=b.status==='interested'?'interested':'going'; const old=db.prepare('SELECT status FROM event_rsvps WHERE event_id=? AND user_id=?').get(event.id,user.id);
      if(old?.status===status) db.prepare('DELETE FROM event_rsvps WHERE event_id=? AND user_id=?').run(event.id,user.id);
      else db.prepare('INSERT INTO event_rsvps(event_id,user_id,status) VALUES(?,?,?) ON CONFLICT(event_id,user_id) DO UPDATE SET status=excluded.status').run(event.id,user.id,status);
      if(!old || old.status!==status) notify(event.created_by,user.id,'event',`responded to your event: ${event.title}`,event.id);
      return {status:old?.status===status?null:status};
    }
    case 'mentorship.offers.list': {
      return db.prepare(`SELECT o.*,p.full_name AS mentor_name,p.avatar_url AS mentor_avatar,p.bio AS mentor_bio,p.college_id,
        (SELECT COUNT(*) FROM mentorship_bookings b WHERE b.offer_id=o.id AND b.status IN ('pending','accepted')) AS active_bookings
        FROM mentorship_offers o JOIN profiles p ON p.id=o.mentor_id WHERE o.active=1 AND o.mentor_id<>?
        AND NOT EXISTS(SELECT 1 FROM campus_user_blocks x WHERE (x.blocker_id=? AND x.blocked_id=o.mentor_id) OR (x.blocker_id=o.mentor_id AND x.blocked_id=?))
        ORDER BY o.created_at DESC LIMIT 100`).all(user.id,user.id,user.id);
    }
    case 'mentorship.my_offers': {
      return db.prepare('SELECT * FROM mentorship_offers WHERE mentor_id=? ORDER BY created_at DESC LIMIT 100').all(user.id);
    }
    case 'mentorship.mine': {
      return db.prepare(`SELECT b.*,o.title AS offer_title,o.mentor_id,p.full_name AS mentor_name,m.full_name AS mentee_name
        FROM mentorship_bookings b JOIN mentorship_offers o ON o.id=b.offer_id JOIN profiles p ON p.id=o.mentor_id JOIN profiles m ON m.id=b.mentee_id
        WHERE b.mentee_id=? OR o.mentor_id=? ORDER BY b.preferred_at DESC LIMIT 100`).all(user.id,user.id);
    }
    case 'mentorship.offer.save': {
      const portalType=db.prepare('SELECT portal_type FROM profiles WHERE id=?').get(user.id)?.portal_type;
      if(!['teacher','recruiter','founder'].includes(portalType)&&!isAdminUser(user)) throw new HttpError('Only professional accounts can publish mentorship offers',403);
      const title=clean(b.title,120), topics=clean(b.topics,300), description=clean(b.description,1200), availability=clean(b.availability,300);
      if(title.length<3) throw new HttpError('Add a mentorship title of at least 3 characters');
      const duration=Number(b.duration_minutes||30); if(![15,30,45,60,90].includes(duration)) throw new HttpError('Choose a supported session duration');
      const mode=['online','in_person','either'].includes(b.mode)?b.mode:'online'; const existing=db.prepare('SELECT id FROM mentorship_offers WHERE mentor_id=? AND id=?').get(user.id,clean(b.id,80));
      if(existing) db.prepare('UPDATE mentorship_offers SET title=?,topics=?,description=?,duration_minutes=?,mode=?,availability=?,active=? WHERE id=? AND mentor_id=?').run(title,topics,description,duration,mode,availability,b.active===false?0:1,existing.id,user.id);
      else db.prepare('INSERT INTO mentorship_offers(id,mentor_id,title,topics,description,duration_minutes,mode,availability) VALUES(?,?,?,?,?,?,?,?)').run(id(),user.id,title,topics,description,duration,mode,availability);
      return {ok:true};
    }
    case 'mentorship.offer.delete': {
      const offer=db.prepare('SELECT id FROM mentorship_offers WHERE id=? AND mentor_id=?').get(clean(b.id,80),user.id); if(!offer) throw new HttpError('Mentorship offer not found',404);
      db.prepare('UPDATE mentorship_offers SET active=0 WHERE id=?').run(offer.id); return {ok:true};
    }
    case 'mentorship.request': {
      const offer=db.prepare('SELECT id,mentor_id,title FROM mentorship_offers WHERE id=? AND active=1').get(clean(b.offer_id,80)); if(!offer) throw new HttpError('This mentorship offer is unavailable',404);
      if(offer.mentor_id===user.id) throw new HttpError('You cannot book your own offer',400);
      const when=clean(b.preferred_at,80), timestamp=Date.parse(when); if(!Number.isFinite(timestamp)||timestamp<Date.now()-60000) throw new HttpError('Choose a future date and time');
      const goal=clean(b.goal,800); if(goal.length<5) throw new HttpError('Describe what you hope to get from the session');
      if(db.prepare('SELECT 1 FROM campus_user_blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)').get(user.id,offer.mentor_id,offer.mentor_id,user.id)) throw new HttpError('This action is unavailable',403);
      const bookingId=id();
      try { db.prepare('INSERT INTO mentorship_bookings(id,offer_id,mentee_id,preferred_at,goal) VALUES(?,?,?,?,?)').run(bookingId,offer.id,user.id,new Date(timestamp).toISOString(),goal); }
      catch { throw new HttpError('You already requested this offer for that time'); }
      notify(offer.mentor_id,user.id,'mentorship',`requested a mentorship session: ${offer.title}`,bookingId); return {id:bookingId};
    }
    case 'mentorship.booking.review': {
      const booking=db.prepare(`SELECT b.*,o.mentor_id,o.title FROM mentorship_bookings b JOIN mentorship_offers o ON o.id=b.offer_id WHERE b.id=?`).get(clean(b.id,80)); if(!booking) throw new HttpError('Booking not found',404);
      const status=clean(b.status,20); if(!['accepted','declined','cancelled','completed'].includes(status)) throw new HttpError('Invalid booking status');
      if(booking.mentor_id===user.id && ['accepted','declined','completed'].includes(status)) db.prepare('UPDATE mentorship_bookings SET status=?,mentor_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status,clean(b.mentor_note,500),booking.id);
      else if(booking.mentee_id===user.id && status==='cancelled' && booking.status==='pending') db.prepare('UPDATE mentorship_bookings SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status,booking.id);
      else throw new HttpError('You are not allowed to update this booking',403);
      notify(booking.mentor_id===user.id?booking.mentee_id:booking.mentor_id,user.id,'mentorship',`updated the mentorship booking: ${booking.title}`,booking.id); return {ok:true};
    }
    case 'knowledge.list': {
      const me=profile(user.id); const audienceRole=db.prepare('SELECT portal_type FROM profiles WHERE id=?').get(user.id)?.portal_type||'student';
      return db.prepare(`SELECT r.*,p.full_name AS author_name,p.avatar_url AS author_avatar FROM knowledge_resources r JOIN profiles p ON p.id=r.author_id
        WHERE (r.college_id IS NULL OR r.college_id=? OR ? IN ('admin','super_admin')) AND (r.audience='everyone' OR r.audience='students' AND ?='student' OR r.audience='teachers' AND ?='teacher' OR r.audience='professionals' AND ? IN ('recruiter','founder','teacher'))
        AND NOT EXISTS(SELECT 1 FROM campus_user_blocks x WHERE (x.blocker_id=? AND x.blocked_id=r.author_id) OR (x.blocker_id=r.author_id AND x.blocked_id=?)) ORDER BY r.created_at DESC LIMIT 100`).all(me.college_id,user.role,audienceRole,audienceRole,audienceRole,user.id,user.id);
    }
    case 'knowledge.create': {
      const title=clean(b.title,160), summary=clean(b.summary,1500), url=clean(b.resource_url,1000), category=clean(b.category,60)||'general';
      if(title.length<3) throw new HttpError('Resource title must be at least 3 characters');
      if(url && !/^https?:\/\//i.test(url)) throw new HttpError('Resource links must start with http:// or https://');
      const audience=['everyone','students','teachers','professionals'].includes(b.audience)?b.audience:'everyone'; const me=profile(user.id); const collegeId=b.scope==='college'?visibilityCollege(me,'college'):null;
      const resourceId=id(); db.prepare('INSERT INTO knowledge_resources(id,author_id,title,summary,resource_url,category,audience,college_id) VALUES(?,?,?,?,?,?,?,?)').run(resourceId,user.id,title,summary,url,category,audience,collegeId);
      return {id:resourceId};
    }
    case 'knowledge.delete': {
      const resource=db.prepare('SELECT author_id FROM knowledge_resources WHERE id=?').get(clean(b.id,80)); if(!resource) throw new HttpError('Resource not found',404);
      if(resource.author_id!==user.id&&!isAdminUser(user)) throw new HttpError('You can only remove your own resources',403);
      db.prepare('DELETE FROM knowledge_resources WHERE id=?').run(clean(b.id,80)); return {ok:true};
    }
    case 'interviews.list': {
      return db.prepare(`SELECT im.*,a.id AS application_id,a.applicant_id,o.id AS opportunity_id,o.title AS opportunity_title,o.organization,p.full_name AS candidate_name,poster.full_name AS recruiter_name,a.status AS application_status
        FROM interview_meetings im JOIN opportunity_applications a ON a.id=im.application_id JOIN professional_opportunities o ON o.id=a.opportunity_id JOIN profiles p ON p.id=a.applicant_id JOIN profiles poster ON poster.id=o.posted_by
        WHERE a.applicant_id=? OR o.posted_by=? ORDER BY im.scheduled_at DESC LIMIT 150`).all(user.id,user.id);
    }
    case 'interviews.applications': {
      return db.prepare(`SELECT a.id AS application_id,a.applicant_id,a.status AS application_status,a.message,a.created_at,o.title AS opportunity_title,o.organization,p.full_name AS candidate_name
        FROM opportunity_applications a JOIN professional_opportunities o ON o.id=a.opportunity_id JOIN profiles p ON p.id=a.applicant_id
        WHERE o.posted_by=? AND a.status NOT IN ('rejected','withdrawn') ORDER BY a.created_at DESC LIMIT 150`).all(user.id);
    }
    case 'interviews.schedule': {
      const application=db.prepare(`SELECT a.id,a.applicant_id,a.status,o.posted_by,o.title FROM opportunity_applications a JOIN professional_opportunities o ON o.id=a.opportunity_id WHERE a.id=?`).get(clean(b.application_id,80));
      if(!application) throw new HttpError('Application not found',404);
      if(application.posted_by!==user.id && !isAdminUser(user)) throw new HttpError('Only the opportunity owner can schedule interviews',403);
      if(['rejected','withdrawn'].includes(application.status)) throw new HttpError('This application is no longer active');
      const when=clean(b.scheduled_at,80), timestamp=Date.parse(when); if(!Number.isFinite(timestamp)||timestamp<Date.now()-60000) throw new HttpError('Choose a future interview date and time');
      const duration=Number(b.duration_minutes||30); if(![15,30,45,60,90].includes(duration)) throw new HttpError('Choose a supported interview duration');
      const url=clean(b.meeting_url,1000); if(url&&!/^https:\/\//i.test(url)) throw new HttpError('Meeting links must use HTTPS');
      const meetingId=id(); db.prepare('INSERT INTO interview_meetings(id,application_id,scheduled_by,scheduled_at,duration_minutes,meeting_url,notes) VALUES(?,?,?,?,?,?,?)').run(meetingId,application.id,user.id,new Date(timestamp).toISOString(),duration,url,clean(b.notes,800));
      db.prepare("UPDATE opportunity_applications SET status='interview' WHERE id=?").run(application.id); notify(application.applicant_id,user.id,'interview',`interview scheduled for ${application.title}`,meetingId); return {id:meetingId};
    }
    case 'interviews.update': {
      const meeting=db.prepare(`SELECT im.id,im.application_id,im.scheduled_by,a.applicant_id,o.posted_by,o.title FROM interview_meetings im JOIN opportunity_applications a ON a.id=im.application_id JOIN professional_opportunities o ON o.id=a.opportunity_id WHERE im.id=?`).get(clean(b.id,80));
      if(!meeting) throw new HttpError('Interview not found',404);
      if(meeting.posted_by!==user.id&&!isAdminUser(user)) throw new HttpError('Only the opportunity owner can update the interview',403);
      const status=['scheduled','completed','cancelled'].includes(b.status)?b.status:'scheduled';
      db.prepare('UPDATE interview_meetings SET status=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status,clean(b.notes,800),meeting.id);
      notify(meeting.applicant_id,user.id,'interview',`interview status updated for ${meeting.title}`,meeting.id); return {ok:true};
    }
    case 'notifications.list': return db.prepare(`SELECT n.*,p.full_name AS actor_name FROM campus_notifications n LEFT JOIN profiles p ON p.id=n.actor_id WHERE n.user_id=? ORDER BY n.created_at DESC LIMIT 100`).all(user.id).map(n=>({...n,is_read:!!n.is_read}));
    case 'notifications.read': {
      if(b.id) db.prepare('UPDATE campus_notifications SET is_read=1 WHERE id=? AND user_id=?').run(clean(b.id,80),user.id);
      else db.prepare('UPDATE campus_notifications SET is_read=1 WHERE user_id=?').run(user.id);
      return {ok:true};
    }
    case 'market.list': { const me=profile(user.id), scope=['college','global','all'].includes(b.scope)?b.scope:'all'; const where=(scope==='college'?' AND l.college_id = ?':scope==='global'?' AND l.college_id IS NULL':allScopeSql('l',user))+blockedSql('l.seller_id',user); const search=clean(b.search,100); const searchSql=search?" AND (l.title LIKE ? OR l.description LIKE ? OR l.category LIKE ?)":''; const params=scope==='college'?[me.college_id]:[]; if(search) params.push(`%${search}%`,`%${search}%`,`%${search}%`); return db.prepare(`SELECT l.*,p.full_name AS seller_name,p.avatar_url AS seller_avatar, EXISTS(SELECT 1 FROM marketplace_saves s WHERE s.listing_id=l.id AND s.user_id=?) AS saved FROM marketplace_listings l JOIN profiles p ON p.id=l.seller_id WHERE l.status='active' ${where} ${searchSql} ORDER BY l.created_at DESC LIMIT 100`).all(user.id,...params).map(l=>({...l,photo_urls:(()=>{try{return JSON.parse(l.photo_urls||'[]')}catch{return []}})(),saved:!!l.saved})); }
    case 'market.save': { const listing=db.prepare("SELECT id,college_id FROM marketplace_listings WHERE id=? AND status='active'").get(clean(b.id,80)); if(!listing) throw new HttpError('Listing not found',404); const me=profile(user.id); if(listing.college_id && listing.college_id!==me.college_id && !['admin','super_admin'].includes(user.role)) throw new HttpError('This listing is limited to its college',403); const old=db.prepare('SELECT 1 FROM marketplace_saves WHERE user_id=? AND listing_id=?').get(user.id,listing.id); if(old) db.prepare('DELETE FROM marketplace_saves WHERE user_id=? AND listing_id=?').run(user.id,listing.id); else db.prepare('INSERT INTO marketplace_saves(user_id,listing_id) VALUES(?,?)').run(user.id,listing.id); return {saved:!old}; }
    case 'market.saved.list': { const me=profile(user.id), scope=['college','global','all'].includes(b.scope)?b.scope:'all'; const where=(scope==='college'?' AND l.college_id = ?':scope==='global'?' AND l.college_id IS NULL':allScopeSql('l',user))+blockedSql('l.seller_id',user); return db.prepare(`SELECT l.*,p.full_name AS seller_name,p.avatar_url AS seller_avatar,1 AS saved FROM marketplace_listings l JOIN marketplace_saves s ON s.listing_id=l.id JOIN profiles p ON p.id=l.seller_id WHERE s.user_id=? AND l.status='active' ${where} ORDER BY s.created_at DESC LIMIT 100`).all(user.id,...(scope==='college'?[me.college_id]:[])).map(l=>({...l,photo_urls:(()=>{try{return JSON.parse(l.photo_urls||'[]')}catch{return []}})(),saved:true})); }
    case 'planner.list': return db.prepare(`SELECT * FROM student_tasks WHERE user_id=? ORDER BY CASE status WHEN 'todo' THEN 0 WHEN 'doing' THEN 1 ELSE 2 END, CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, COALESCE(due_date,'9999-12-31'), created_at DESC`).all(user.id);
    case 'planner.create': { const title=clean(b.title,140), details=clean(b.details,1200), due=clean(b.due_date,30), priority=['low','normal','high'].includes(b.priority)?b.priority:'normal'; if(title.length<2) throw new HttpError('Task title must be at least 2 characters'); if(due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new HttpError('Use a valid due date'); const taskId=id(); db.prepare('INSERT INTO student_tasks(id,user_id,title,details,due_date,priority) VALUES(?,?,?,?,?,?)').run(taskId,user.id,title,details,due||null,priority); return db.prepare('SELECT * FROM student_tasks WHERE id=?').get(taskId); }
    case 'planner.update': { const task=db.prepare('SELECT id FROM student_tasks WHERE id=? AND user_id=?').get(clean(b.id,80),user.id); if(!task) throw new HttpError('Task not found',404); const fields=[],params=[]; if(typeof b.status==='string' && ['todo','doing','done'].includes(b.status)){fields.push('status=?');params.push(b.status)} if(typeof b.title==='string'){const t=clean(b.title,140);if(t.length<2)throw new HttpError('Task title must be at least 2 characters');fields.push('title=?');params.push(t)} if(typeof b.priority==='string' && ['low','normal','high'].includes(b.priority)){fields.push('priority=?');params.push(b.priority)} if(typeof b.due_date==='string'){const d=clean(b.due_date,30);if(d && !/^\d{4}-\d{2}-\d{2}$/.test(d))throw new HttpError('Use a valid due date');fields.push('due_date=?');params.push(d||null)} if(typeof b.details==='string'){fields.push('details=?');params.push(clean(b.details,1200))} if(fields.length){fields.push("updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')");db.prepare(`UPDATE student_tasks SET ${fields.join(',')} WHERE id=? AND user_id=?`).run(...params,task.id,user.id)} return db.prepare('SELECT * FROM student_tasks WHERE id=?').get(task.id); }
    case 'planner.delete': { const r=db.prepare('DELETE FROM student_tasks WHERE id=? AND user_id=?').run(clean(b.id,80),user.id); if(!r.changes) throw new HttpError('Task not found',404); return {ok:true}; }
    case 'market.create': {
      const title=clean(b.title,100), description=clean(b.description,1000), category=clean(b.category,40)||'Other', condition=clean(b.condition,30)||'Good', contact=clean(b.contact_note,200);
      const photoUrls = validateMediaUrls(user.id, b.photo_urls, ['image'], 6);
      const price=Number(b.price); if(title.length<3) throw new HttpError('Title must be at least 3 characters'); if(!Number.isFinite(price)||price<0||price>100000000) throw new HttpError('Enter a valid price');
      const me=profile(user.id), listingId=id(), collegeId=visibilityCollege(me,b.scope); db.prepare('INSERT INTO marketplace_listings(id,seller_id,college_id,title,description,category,price,condition,contact_note,photo_urls) VALUES(?,?,?,?,?,?,?,?,?,?)').run(listingId,user.id,collegeId,title,description,category,price,condition,contact,JSON.stringify(photoUrls)); return {id:listingId};
    }
    case 'market.status': {
      const listing=db.prepare('SELECT seller_id FROM marketplace_listings WHERE id=?').get(clean(b.id,80)); if(!listing) throw new HttpError('Listing not found',404);
      if(listing.seller_id!==user.id && !['admin','super_admin'].includes(user.role)) throw new HttpError('Not allowed',403);
      const status=b.status==='sold'?'sold':'active'; db.prepare('UPDATE marketplace_listings SET status=? WHERE id=?').run(status,clean(b.id,80)); return {status};
    }
    case 'discover.list': {
      const me=profile(user.id); const search=clean(b.search,80); const params=[user.id]; let where='p.id <> ?'+blockedSql('p.id',user);
      if(me.college_id && b.same_college) { where += ' AND p.college_id = ?'; params.push(me.college_id); }
      if(search) { where += ' AND (p.full_name LIKE ? OR COALESCE(p.bio,\'\') LIKE ? OR COALESCE(c.name,\'\') LIKE ?)'; params.push(`%${search}%`,`%${search}%`,`%${search}%`); }
      // Search by role: a badge, a college rank (ranks only count while verified), or verified students only.
      if(b.badge_id) { where += ' AND EXISTS(SELECT 1 FROM user_badges ub WHERE ub.user_id=p.id AND ub.badge_id=?)'; params.push(clean(b.badge_id,80)); }
      if(b.rank==='officer') where += " AND p.is_verified=1 AND p.college_id IS NOT NULL AND p.college_role<>'member'";
      else if(['committee_head','secretary','vice_president','president'].includes(b.rank)) { where += ' AND p.is_verified=1 AND p.college_id IS NOT NULL AND p.college_role=?'; params.push(b.rank); }
      if(b.verified_only) where += ' AND p.is_verified=1';
      return db.prepare(`SELECT p.id,p.full_name,p.avatar_url,p.bio,p.college_id,p.is_verified,p.college_role,p.committee_name,c.name AS college_name FROM profiles p LEFT JOIN colleges c ON c.id=p.college_id WHERE ${where} ORDER BY p.is_verified DESC,p.full_name COLLATE NOCASE LIMIT 60`).all(...params).map(p=>({...p,is_verified:!!p.is_verified}));
    }
    case 'groups.list': { const me=profile(user.id), scope=['college','global','all'].includes(b.scope)?b.scope:'all'; const scopeSql=scope==='college'?' AND g.college_id = ?':scope==='global'?' AND g.college_id IS NULL':allScopeSql('g',user); const params=[user.id,user.id,user.id]; if(scope==='college') params.push(me.college_id); return db.prepare(`SELECT g.*,p.full_name AS creator_name,
      (SELECT COUNT(*) FROM study_group_members m WHERE m.group_id=g.id) AS member_count,
      EXISTS(SELECT 1 FROM study_group_members m WHERE m.group_id=g.id AND m.user_id=?) AS joined
      FROM study_groups g JOIN profiles p ON p.id=g.created_by
      WHERE NOT EXISTS(SELECT 1 FROM campus_user_blocks b WHERE (b.blocker_id=? AND b.blocked_id=g.created_by) OR (b.blocker_id=g.created_by AND b.blocked_id=?))
      ${scopeSql} ORDER BY g.created_at DESC LIMIT 100`).all(...params).map(g=>({...g,joined:!!g.joined})); }
    case 'groups.create': {
      const title=clean(b.title,100), subject=clean(b.subject,80), description=clean(b.description,1200), meeting=clean(b.meeting_info,240), image=clean(b.image_url,500);
      if(title.length<3) throw new HttpError('Group title must be at least 3 characters');
      const me=profile(user.id), groupId=id(); shareImageUpload(user.id,image);
      const collegeId=visibilityCollege(me,b.scope); db.prepare('INSERT INTO study_groups(id,title,subject,description,meeting_info,created_by,college_id,image_url) VALUES(?,?,?,?,?,?,?,?)').run(groupId,title,subject,description,meeting,user.id,collegeId,image);
      db.prepare('INSERT INTO study_group_members(group_id,user_id) VALUES(?,?)').run(groupId,user.id); return {id:groupId};
    }
    case 'groups.join': {
      const group=db.prepare('SELECT id,created_by,college_id FROM study_groups WHERE id=?').get(clean(b.group_id,80)); if(!group) throw new HttpError('Study group not found',404);
      if(group.college_id && profile(user.id)?.college_id!==group.college_id && !isAdminUser(user)) throw new HttpError('This study group is limited to its college',403);
      if(db.prepare('SELECT 1 FROM campus_user_blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)').get(user.id,group.created_by,group.created_by,user.id)) throw new HttpError('This action is unavailable',403);
      const old=db.prepare('SELECT 1 FROM study_group_members WHERE group_id=? AND user_id=?').get(group.id,user.id);
      if(old) db.prepare('DELETE FROM study_group_members WHERE group_id=? AND user_id=?').run(group.id,user.id); else db.prepare('INSERT INTO study_group_members(group_id,user_id) VALUES(?,?)').run(group.id,user.id);
      if(!old) notify(group.created_by,user.id,'study_group','joined your study group',group.id); return {joined:!old};
    }
    case 'opportunities.list': { const me=profile(user.id), scope=['college','global','all'].includes(b.scope)?b.scope:'all'; const scopeSql=scope==='college'?' AND o.college_id = ?':scope==='global'?' AND o.college_id IS NULL':allScopeSql('o',user); const params=[user.id,user.id,user.id,user.id]; if(scope==='college') params.push(me.college_id); return db.prepare(`SELECT o.*,p.full_name AS creator_name,EXISTS(SELECT 1 FROM opportunity_saves s WHERE s.opportunity_id=o.id AND s.user_id=?) AS saved,
      (SELECT a.status FROM opportunity_application_tracking a WHERE a.opportunity_id=o.id AND a.user_id=?) AS application_status
      FROM campus_opportunities o JOIN profiles p ON p.id=o.created_by
      WHERE NOT EXISTS(SELECT 1 FROM campus_user_blocks b WHERE (b.blocker_id=? AND b.blocked_id=o.created_by) OR (b.blocker_id=o.created_by AND b.blocked_id=?))
      ${scopeSql} ORDER BY CASE WHEN o.deadline IS NULL OR o.deadline='' THEN 1 ELSE 0 END,o.deadline ASC,o.created_at DESC LIMIT 100`).all(...params).map(o=>({...o,saved:!!o.saved})); }
    case 'opportunities.create': {
      const title=clean(b.title,120), organization=clean(b.organization,100), kind=clean(b.kind,40)||'Opportunity', description=clean(b.description,2000), deadline=clean(b.deadline,40)||null, apply=clean(b.apply_url,500), image=clean(b.image_url,500);
      if(title.length<3) throw new HttpError('Opportunity title must be at least 3 characters');
      if(apply && !/^https?:\/\//i.test(apply)) throw new HttpError('Application link must start with http:// or https://');
      const me=profile(user.id), opportunityId=id(), collegeId=visibilityCollege(me,b.scope); shareImageUpload(user.id,image); db.prepare('INSERT INTO campus_opportunities(id,title,organization,kind,description,deadline,apply_url,created_by,college_id,image_url) VALUES(?,?,?,?,?,?,?,?,?,?)').run(opportunityId,title,organization,kind,description,deadline,apply,user.id,collegeId,image); return {id:opportunityId};
    }
    case 'opportunities.save': {
      const oid=clean(b.id,80); if(!db.prepare('SELECT 1 FROM campus_opportunities WHERE id=?').get(oid)) throw new HttpError('Opportunity not found',404);
      const old=db.prepare('SELECT 1 FROM opportunity_saves WHERE opportunity_id=? AND user_id=?').get(oid,user.id);
      if(old) db.prepare('DELETE FROM opportunity_saves WHERE opportunity_id=? AND user_id=?').run(oid,user.id); else db.prepare('INSERT INTO opportunity_saves(opportunity_id,user_id) VALUES(?,?)').run(oid,user.id); return {saved:!old};
    }
    case 'opportunities.track': {
      const oid=clean(b.id,80), status=clean(b.status,20), notes=clean(b.notes,500);
      if(!db.prepare('SELECT 1 FROM campus_opportunities WHERE id=?').get(oid)) throw new HttpError('Opportunity not found',404);
      if(!['interested','applied','interview','offer','rejected','withdrawn'].includes(status)) throw new HttpError('Choose a valid application status');
      db.prepare(`INSERT INTO opportunity_application_tracking(opportunity_id,user_id,status,notes,updated_at) VALUES(?,?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        ON CONFLICT(opportunity_id,user_id) DO UPDATE SET status=excluded.status,notes=excluded.notes,updated_at=excluded.updated_at`).run(oid,user.id,status,notes);
      return {id:oid,status};
    }
    case 'opportunities.tracking.list': return db.prepare(`SELECT a.opportunity_id,a.status,a.notes,a.updated_at,o.title,o.organization,o.deadline,o.apply_url
      FROM opportunity_application_tracking a JOIN campus_opportunities o ON o.id=a.opportunity_id WHERE a.user_id=? ORDER BY a.updated_at DESC LIMIT 100`).all(user.id);
    case 'lost.list': { const me=profile(user.id), scope=['college','global','all'].includes(b.scope)?b.scope:'all'; const scopeSql=scope==='college'?' AND i.college_id = ?':scope==='global'?' AND i.college_id IS NULL':allScopeSql('i',user); const params=[user.id,user.id]; if(scope==='college') params.push(me.college_id); return db.prepare(`SELECT i.*,p.full_name AS creator_name,p.avatar_url AS creator_avatar
      FROM lost_found_items i JOIN profiles p ON p.id=i.created_by WHERE i.status='open'
      AND NOT EXISTS(SELECT 1 FROM campus_user_blocks b WHERE (b.blocker_id=? AND b.blocked_id=i.created_by) OR (b.blocker_id=i.created_by AND b.blocked_id=?))
      ${scopeSql} ORDER BY i.created_at DESC LIMIT 100`).all(...params); }
    case 'lost.create': {
      const title=clean(b.title,100), description=clean(b.description,1200), type=b.item_type==='Found'?'Found':'Lost', location=clean(b.location,160), contact=clean(b.contact_note,240), image=clean(b.image_url,500);
      if(title.length<3) throw new HttpError('Item title must be at least 3 characters');
      const me=profile(user.id), itemId=id(), collegeId=visibilityCollege(me,b.scope); shareImageUpload(user.id,image); db.prepare('INSERT INTO lost_found_items(id,title,description,item_type,location,contact_note,image_url,created_by,college_id) VALUES(?,?,?,?,?,?,?,?,?)').run(itemId,title,description,type,location,contact,image,user.id,collegeId); return {id:itemId};
    }
    case 'lost.resolve': {
      const item=db.prepare('SELECT created_by FROM lost_found_items WHERE id=?').get(clean(b.id,80)); if(!item) throw new HttpError('Item not found',404);
      if(item.created_by!==user.id && !['admin','super_admin'].includes(user.role)) throw new HttpError('Only the author or an administrator can resolve this item',403);
      db.prepare("UPDATE lost_found_items SET status='resolved' WHERE id=?").run(clean(b.id,80)); return {ok:true};
    }
    case 'safety.block': {
      const target=clean(b.user_id,80); if(!target || target===user.id || !db.prepare('SELECT 1 FROM profiles WHERE id=?').get(target)) throw new HttpError('Choose a valid student to block');
      db.prepare('INSERT OR IGNORE INTO campus_user_blocks(blocker_id,blocked_id) VALUES(?,?)').run(user.id,target); return {ok:true};
    }
    case 'safety.unblock': { db.prepare('DELETE FROM campus_user_blocks WHERE blocker_id=? AND blocked_id=?').run(user.id,clean(b.user_id,80)); return {ok:true}; }
    case 'safety.blocks': return db.prepare('SELECT b.blocked_id AS user_id,p.full_name,p.avatar_url,b.created_at FROM campus_user_blocks b JOIN profiles p ON p.id=b.blocked_id WHERE b.blocker_id=? ORDER BY b.created_at DESC').all(user.id);
    case 'safety.report': {
      const reason=clean(b.reason,500), targetType=clean(b.target_type,40)||'user', targetId=clean(b.target_id,80)||null, reported=clean(b.reported_user_id,80)||null;
      if(reason.length<5) throw new HttpError('Please provide a short explanation (at least 5 characters)');
      if(reported && !db.prepare('SELECT 1 FROM profiles WHERE id=?').get(reported)) throw new HttpError('Reported student not found',404);
      db.prepare('INSERT INTO campus_user_reports(id,reporter_id,reported_user_id,target_type,target_id,reason) VALUES(?,?,?,?,?,?)').run(id(),user.id,reported,targetType,targetId,reason); return {ok:true};
    }
    case 'safety.admin_reports': {
      if(!['admin','super_admin'].includes(user.role)) throw new HttpError('Administrator access required',403);
      return db.prepare(`SELECT r.*,reporter.full_name AS reporter_name,reported.full_name AS reported_name FROM campus_user_reports r
        JOIN profiles reporter ON reporter.id=r.reporter_id LEFT JOIN profiles reported ON reported.id=r.reported_user_id
        ORDER BY CASE WHEN r.status='open' THEN 0 ELSE 1 END,r.created_at DESC LIMIT 200`).all();
    }
    case 'safety.resolve_report': {
      if(!['admin','super_admin'].includes(user.role)) throw new HttpError('Administrator access required',403);
      db.prepare("UPDATE campus_user_reports SET status='resolved' WHERE id=?").run(clean(b.id,80)); return {ok:true};
    }
    case 'search.all': {
      const q=clean(b.search,100); if(q.length<2) return {students:[],groups:[],opportunities:[],items:[],clubs:[]}; const like=`%${q}%`;
      const me=profile(user.id), scope=['college','global','all'].includes(b.scope)?b.scope:'all';
      const collegeSql=(alias)=>scope==='college'?` AND ${alias}.college_id = ?`:scope==='global'?` AND ${alias}.college_id IS NULL`:allScopeSql(alias,user);
      const extra=(alias)=>scope==='college'?[me.college_id]:[];
      return {
        students:db.prepare(`SELECT p.id,p.full_name,p.bio,p.avatar_url,p.is_verified,c.name AS college_name FROM profiles p LEFT JOIN colleges c ON c.id=p.college_id WHERE p.id<>? AND (p.full_name LIKE ? OR COALESCE(p.bio,'') LIKE ?) AND NOT EXISTS(SELECT 1 FROM campus_user_blocks b WHERE (b.blocker_id=? AND b.blocked_id=p.id) OR (b.blocker_id=p.id AND b.blocked_id=?)) ${collegeSql('p')} ORDER BY p.is_verified DESC,p.full_name LIMIT 8`).all(user.id,like,like,user.id,user.id,...extra('p')),
        groups:db.prepare(`SELECT g.id,g.title AS name,g.subject AS detail,g.created_by AS owner_id FROM study_groups g WHERE (g.title LIKE ? OR g.subject LIKE ? OR g.description LIKE ?) AND NOT EXISTS(SELECT 1 FROM campus_user_blocks b WHERE (b.blocker_id=? AND b.blocked_id=g.created_by) OR (b.blocker_id=g.created_by AND b.blocked_id=?)) ${collegeSql('g')} LIMIT 8`).all(like,like,like,user.id,user.id,...extra('g')),
        opportunities:db.prepare(`SELECT o.id,o.title AS name,o.organization AS detail,o.created_by AS owner_id FROM campus_opportunities o WHERE (o.title LIKE ? OR o.organization LIKE ? OR o.description LIKE ?) AND NOT EXISTS(SELECT 1 FROM campus_user_blocks b WHERE (b.blocker_id=? AND b.blocked_id=o.created_by) OR (b.blocker_id=o.created_by AND b.blocked_id=?)) ${collegeSql('o')} LIMIT 8`).all(like,like,like,user.id,user.id,...extra('o')),
        items:db.prepare(`SELECT i.id,i.title AS name,i.location AS detail,i.created_by AS owner_id FROM lost_found_items i WHERE i.status='open' AND (i.title LIKE ? OR i.description LIKE ? OR i.location LIKE ?) AND NOT EXISTS(SELECT 1 FROM campus_user_blocks b WHERE (b.blocker_id=? AND b.blocked_id=i.created_by) OR (b.blocker_id=i.created_by AND b.blocked_id=?)) ${collegeSql('i')} LIMIT 8`).all(like,like,like,user.id,user.id,...extra('i')),
        clubs:db.prepare(`SELECT c.id,c.name,c.description AS detail,c.created_by AS owner_id FROM campus_clubs c WHERE (c.name LIKE ? OR c.description LIKE ?) AND NOT EXISTS(SELECT 1 FROM campus_user_blocks b WHERE (b.blocker_id=? AND b.blocked_id=c.created_by) OR (b.blocker_id=c.created_by AND b.blocked_id=?)) ${collegeSql('c')} LIMIT 8`).all(like,like,user.id,user.id,...extra('c'))
      };
    }
    default: throw new HttpError('Unknown feature action',404);
  }
}
export function handleFeature(user, body) { return { data: runFeature(user, body || {}) }; }
