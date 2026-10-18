// End-to-end API smoke test using an isolated temporary SQLite database.
// Run with `npm run smoke-test`; it never touches the user's real database.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'unilink-smoke-'));
const dbPath = path.join(temp, 'smoke.sqlite');
const portServer = createServer();
await new Promise((resolve, reject) => portServer.once('error', reject).listen(0, '127.0.0.1', resolve));
const port = portServer.address().port;
await new Promise((resolve) => portServer.close(resolve));
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [path.join(root, 'server', 'index.js')], {
  cwd: root,
  env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', CAMPUSCONNECT_DB: dbPath, CAMPUSCONNECT_UPLOADS: path.join(temp, 'uploads') },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
child.stdout.on('data', (x) => { logs += x.toString(); });
child.stderr.on('data', (x) => { logs += x.toString(); });
const assert = (condition, message) => { if (!condition) throw new Error(message); };
async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited early.\n${logs}`);
    try { const r = await fetch(`${base}/api/health`); if (r.ok) return; } catch { /* wait for boot */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server did not become ready.\n${logs}`);
}
async function request(route, { token, body, method = 'POST', expected = 200 } = {}) {
  const response = await fetch(`${base}${route}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => ({}));
  assert(response.status === expected, `${method} ${route}: expected ${expected}, got ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}
async function signup(email, full_name, portal_type = 'student') {
  const result = await request('/api/auth/signup', { body: { email, full_name, password: 'test-password-123', portal_type } });
  assert(result.session?.access_token, `No session token returned for ${email}`);
  return { token: result.session.access_token, id: result.user.id };
}

try {
  await waitForServer();
  const health = await request('/api/health', { method: 'GET' });
  assert(health.status === 'ok' && health.database === 'ok', 'Health check should report app and database as ready');

  const alice = await signup('alice@example.test', 'Alice Example');
  const bob = await signup('bob@example.test', 'Bob Example');
  const teacher = await signup('teacher@example.test', 'Teacher Example', 'teacher');
  const teacherDb = new DatabaseSync(dbPath);
  teacherDb.prepare('UPDATE users SET email_confirmed_at = ? WHERE id = ?').run(new Date().toISOString(), teacher.id);
  teacherDb.prepare("UPDATE profiles SET is_verified = 1 WHERE id = ?").run(teacher.id);
  teacherDb.close();
  const roleBadges = await request('/api/badges/lookup', { token: alice.token, body: { user_ids: [teacher.id] } });
  assert(roleBadges.data?.users?.[teacher.id]?.includes('role-teacher'), 'teacher portal should receive its automatic role badge');
  assert(roleBadges.data?.users?.[teacher.id]?.includes('verified-teacher'), 'confirmed college-verified teacher should receive the verified teacher badge');
  const recruiter = await request('/api/auth/signup', { body: { email: 'recruiter@example.test', full_name: 'Recruiter Example', password: 'test-password-123', portal_type: 'recruiter' } });
  const recruiterBadges = await request('/api/badges/lookup', { token: alice.token, body: { user_ids: [recruiter.user.id] } });
  assert(recruiterBadges.data?.users?.[recruiter.user.id]?.includes('role-recruiter'), 'recruiter portal should receive its automatic role badge');

  // Recruiter verification requires a confirmed email and an exact seeded corporate domain.
  const corporateRecruiter = await signup('recruiter@google.com', 'Corporate Recruiter', 'recruiter');
  const companyDb = new DatabaseSync(dbPath);
  companyDb.prepare('UPDATE users SET email_confirmed_at=? WHERE id=?').run(new Date().toISOString(), corporateRecruiter.id);
  companyDb.close();
  const companyList = await request('/api/company-verification', { token: corporateRecruiter.token, body: { action: 'companies.list' } });
  const googleCompany = companyList.data?.companies?.find((c) => c.name === 'Google');
  assert(googleCompany, 'company directory should include Google');
  await request('/api/company-verification', { token: corporateRecruiter.token, body: { action: 'recruiter.verify', company_id: googleCompany.id } });
  const verifiedRecruiterBadges = await request('/api/badges/lookup', { token: alice.token, body: { user_ids: [corporateRecruiter.id] } });
  assert(verifiedRecruiterBadges.data?.users?.[corporateRecruiter.id]?.includes('verified-recruiter'), 'exact confirmed corporate domain should grant Verified Recruiter badge');
  const confirmPublicEmailDb = new DatabaseSync(dbPath);
  confirmPublicEmailDb.prepare('UPDATE users SET email=?,email_confirmed_at=? WHERE id=?').run('recruiter@gmail.com', new Date().toISOString(), recruiter.user.id);
  confirmPublicEmailDb.close();
  await request('/api/company-verification', { token: recruiter.session.access_token, body: { action: 'recruiter.verify', company_id: googleCompany.id }, expected: 400 });

  // Founder companies stay pending until an administrator approves them.
  const founder = await signup('founder@example.test', 'Startup Founder', 'founder');
  await request('/api/company-verification', { token: founder.token, body: { action: 'founder.submit', company_name: 'Example Startup Labs', domain: 'examplestartuplabs.com', website: 'https://examplestartuplabs.com', notes: 'Smoke test startup' } });
  const admin = await signup('admin@example.test', 'UniLink Admin');
  const companyAdminDb = new DatabaseSync(dbPath);
  companyAdminDb.prepare("UPDATE profiles SET role='super_admin' WHERE id=?").run(admin.id);
  companyAdminDb.close();
  const pendingCompanies = await request('/api/company-verification', { token: admin.token, body: { action: 'admin.list' } });
  const founderRequest = pendingCompanies.data?.requests?.find((r) => r.company_name === 'Example Startup Labs' && r.status === 'pending');
  assert(founderRequest, 'founder submission should appear in admin review queue');
  await request('/api/company-verification', { token: admin.token, body: { action: 'admin.resolve', id: founderRequest.id, status: 'approved' } });
  const founderBadges = await request('/api/badges/lookup', { token: alice.token, body: { user_ids: [founder.id] } });
  assert(founderBadges.data?.users?.[founder.id]?.includes('verified-founder'), 'admin approval should grant Verified Founder badge');
  await request('/api/auth/user', { method: 'GET', token: alice.token });

  // Privacy settings must be enforced by the server, not only by the UI.
  await request('/api/chat/message-privacy', { token: alice.token, body: { privacy: 'friends' } });
  await request('/api/chat/dm/start', { token: bob.token, body: { user_id: alice.id }, expected: 403 });

  await request('/api/chat/friends/request', { token: bob.token, body: { user_id: alice.id } });
  const incoming = await request('/api/chat/friends/list', { token: alice.token, body: {} });
  assert(incoming.data?.incoming?.some((p) => p.id === bob.id), 'Incoming friend request should appear for recipient');
  const notifications = await request('/api/features', { token: alice.token, body: { action: 'notifications.list' } });
  assert(notifications.data?.some((n) => n.kind === 'friend_request' && n.actor_id === bob.id), 'Friend request should create a notification');
  await request('/api/chat/friends/accept', { token: alice.token, body: { user_id: bob.id } });
  const friends = await request('/api/chat/friends/list', { token: alice.token, body: {} });
  assert(friends.data?.friends?.some((p) => p.id === bob.id), 'Accepted friend should appear in friends list');
  const dm = await request('/api/chat/dm/start', { token: bob.token, body: { user_id: alice.id } });
  assert(dm.data?.room_id, 'Friends should be able to start a direct conversation');

  const createdTask = await request('/api/features', { token: bob.token, body: { action: 'planner.create', title: 'Smoke test task', details: 'Persisted by the server', priority: 'high' } });
  assert(createdTask.data?.id, 'Planner task should be created');
  const tasks = await request('/api/features', { token: bob.token, body: { action: 'planner.list' } });
  assert(tasks.data?.some((t) => t.id === createdTask.data.id), 'Planner task should persist in SQLite');

  const post = await request('/api/features', { token: bob.token, body: { action: 'feed.create', scope: 'global', body: 'Hello from the UniLink smoke test' } });
  assert(post.data?.id, 'Global community post should be created');
  const feed = await request('/api/features', { token: alice.token, body: { action: 'feed.list', scope: 'global' } });
  assert(feed.data?.some((p) => p.id === post.data.id), 'Global post should be visible to another account');

  // Direct image/video uploads should attach to community posts and remain readable to permitted viewers.
  async function upload(token, name, bytes) {
    const response = await fetch(`${base}/api/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-File-Name': encodeURIComponent(name), 'Content-Length': String(bytes.length) }, body: bytes });
    const payload = await response.json().catch(() => ({}));
    assert(response.ok && payload.data?.url, `Upload ${name} should succeed: ${JSON.stringify(payload)}`);
    return payload.data;
  }
  const photo = await upload(bob.token, 'campus-photo.png', Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]));
  const video = await upload(bob.token, 'campus-video.mp4', Buffer.from([0,0,0,24,102,116,121,112,109,112,52,50]));
  const mediaPost = await request('/api/features', { token: bob.token, body: { action: 'feed.create', scope: 'global', body: 'Media upload smoke test', media_urls: [photo.url, video.url] } });
  assert(mediaPost.data?.id, 'Post with directly uploaded media should be created');
  const mediaFeed = await request('/api/features', { token: alice.token, body: { action: 'feed.list', scope: 'global' } });
  const visibleMediaPost = mediaFeed.data?.find((p) => p.id === mediaPost.data.id);
  assert(visibleMediaPost?.media_items?.length === 2 && visibleMediaPost.media_items.some((m) => m.kind === 'image') && visibleMediaPost.media_items.some((m) => m.kind === 'video'), 'Community feed should return uploaded image and video attachments');
  const mediaResponse = await fetch(`${base}${photo.url}`, { headers: { Authorization: `Bearer ${alice.token}` } });
  assert(mediaResponse.ok, 'Another permitted viewer should be able to load media attached to a global post');
  await mediaResponse.arrayBuffer();

  const listing = await request('/api/features', { token: bob.token, body: { action: 'market.create', scope: 'global', title: 'Smoke test camera', description: 'Marketplace photo test', price: 50, photo_urls: [photo.url] } });
  assert(listing.data?.id, 'Marketplace listing with a photo should be created');
  const market = await request('/api/features', { token: alice.token, body: { action: 'market.list', scope: 'global' } });
  assert(market.data?.some((l) => l.id === listing.data.id && l.photo_urls?.includes(photo.url)), 'Marketplace should return listing photos');

  // Event creation must provision a room owned by the creator; joining must add a member and RSVP.
  const eventId = crypto.randomUUID();
  const eventDb = new DatabaseSync(dbPath);
  eventDb.prepare("INSERT INTO events(id,title,description,event_date,end_date,category,created_by,visibility) VALUES(?,?,?,?,?,?,?,'everyone')")
    .run(eventId, 'Event chat smoke test', 'Checks the event room workflow', '2030-01-01', '2030-01-01', 'general', bob.id);
  eventDb.close();
  const eventRoom = await request('/api/features', { token: bob.token, body: { action: 'events.chat.create', event_id: eventId } });
  assert(eventRoom.data?.room_id, 'Creating an event should create its chat room');
  const joinedEvent = await request('/api/features', { token: alice.token, body: { action: 'events.chat.join', event_id: eventId } });
  assert(joinedEvent.data?.room_id === eventRoom.data.room_id, 'Joining an event should return its existing chat room');
  const verifyEventDb = new DatabaseSync(dbPath);
  const roomOwner = verifyEventDb.prepare('SELECT created_by,event_id FROM chat_rooms WHERE id=?').get(eventRoom.data.room_id);
  const roomMembers = verifyEventDb.prepare('SELECT COUNT(*) AS n FROM room_members WHERE room_id=?').get(eventRoom.data.room_id);
  const joinedRsvp = verifyEventDb.prepare("SELECT status FROM event_rsvps WHERE event_id=? AND user_id=?").get(eventId, alice.id);
  verifyEventDb.close();
  assert(roomOwner?.created_by === bob.id && roomOwner?.event_id === eventId, 'Event chat owner must be the event creator');
  assert(roomMembers.n === 2 && joinedRsvp?.status === 'going', 'Joining an event should add the user to its chat room and RSVP as going');

  // Exercise the full opportunity workflow and verify that employer-only actions are enforced server-side.
  const testDb = new DatabaseSync(dbPath);
  testDb.prepare("UPDATE profiles SET portal_type='recruiter',is_verified=1 WHERE id=?").run(alice.id);
  testDb.prepare("UPDATE profiles SET portal_type='student',is_verified=1 WHERE id=?").run(bob.id);
  testDb.prepare("INSERT INTO collaboration_skills(user_id,skills,interests,available,network_role) VALUES(?,?,'testing','1','student') ON CONFLICT(user_id) DO UPDATE SET skills=excluded.skills,interests=excluded.interests,available=1,network_role='student'").run(bob.id, 'TypeScript, QA testing');
  testDb.close();
  const networkPeople = await request('/api/collaboration', { token: alice.token, body: { action: 'collab.people' } });
  assert(networkPeople.data?.some((person) => person.id === bob.id && person.skills.includes('TypeScript')), 'Professional network should return verified, available profiles');
  const teamProject = await request('/api/collaboration', { token: alice.token, body: { action: 'collab.create', title: 'Smoke-test collaboration project', description: 'A shared project used to validate team collaboration.', skills: 'TypeScript, QA', capacity: 4, kind: 'project' } });
  assert(teamProject.data?.id, 'Verified member should be able to create a collaboration project');
  const visibleTeams = await request('/api/collaboration', { token: bob.token, body: { action: 'collab.projects' } });
  assert(visibleTeams.data?.some((project) => project.id === teamProject.data.id), 'Open collaboration projects should be discoverable');
  await request('/api/collaboration', { token: bob.token, body: { action: 'collab.apply', id: teamProject.data.id } });
  await request('/api/collaboration', { token: alice.token, body: { action: 'collab.review', id: teamProject.data.id, user_id: bob.id, status: 'accepted' } });
  const portfolioProject = await request('/api/collaboration', { token: alice.token, body: { action: 'collab.portfolio.create', title: 'Smoke-test portfolio project', description: 'A public portfolio entry for testing the project showcase.', technologies: 'TypeScript, QA', repo_url: 'https://example.test/repo', demo_url: 'https://example.test/demo' } });
  assert(portfolioProject.data?.id, 'Member should be able to add a project to their portfolio');
  const achievement = await request('/api/collaboration', { token: alice.token, body: { action: 'collab.achievements.create', title: 'Smoke-test achievement', issuer: 'UniLink QA', awarded_on: '2026-10-18', description: 'Achievement entry for portfolio validation.', credential_url: 'https://example.test/credential' } });
  assert(achievement.data?.id, 'Member should be able to add an achievement');
  const publicPortfolio = await request('/api/collaboration', { token: bob.token, body: { action: 'collab.portfolio.list' } });
  assert(publicPortfolio.data?.some((item) => item.id === portfolioProject.data.id), 'Portfolio projects should be visible to other users');
  const publicAchievements = await request('/api/collaboration', { token: bob.token, body: { action: 'collab.achievements.list' } });
  assert(publicAchievements.data?.some((item) => item.id === achievement.data.id), 'Achievements should be visible to other users');
  await request('/api/collaboration', { token: bob.token, body: { action: 'collab.achievements.delete', id: achievement.data.id }, expected: 404 });
  await request('/api/collaboration', { token: alice.token, body: { action: 'collab.achievements.delete', id: achievement.data.id } });
  await request('/api/collaboration', { token: alice.token, body: { action: 'collab.connect', user_id: bob.id } });
  const pendingConnections = await request('/api/collaboration', { token: bob.token, body: { action: 'collab.connections' } });
  assert(pendingConnections.data?.some((connection) => connection.requester_id === alice.id && connection.status === 'pending'), 'Connection request should appear for recipient');
  await request('/api/collaboration', { token: bob.token, body: { action: 'collab.connection.review', user_id: alice.id, status: 'accepted' } });
  const forbiddenStudentPost = await request('/api/collaboration', { token: bob.token, body: { action: 'collab.opportunities.create', title: 'Invalid student post', description: 'This must be rejected', deadline: '' }, expected: 403 });
  assert(forbiddenStudentPost.error, 'Students must not publish opportunities');
  const opportunity = await request('/api/collaboration', { token: alice.token, body: { action: 'collab.opportunities.create', title: 'Smoke-test internship', organization: 'UniLink QA', opportunity_type: 'internship', description: 'A test internship for validating application workflows.', skills: 'testing, TypeScript', deadline: '' } });
  assert(opportunity.data?.id, 'Recruiter should be able to publish an opportunity');
  const visible = await request('/api/collaboration', { token: bob.token, body: { action: 'collab.opportunities.list' } });
  assert(visible.data?.some((o) => o.id === opportunity.data.id), 'Student should see the published opportunity');
  await request('/api/collaboration', { token: bob.token, body: { action: 'collab.opportunities.apply', id: opportunity.data.id, message: 'I am interested in this role.' } });
  await request('/api/collaboration', { token: bob.token, body: { action: 'collab.opportunities.apply', id: opportunity.data.id, message: 'Duplicate should not create a second application.' } });
  const applications = await request('/api/collaboration', { token: alice.token, body: { action: 'collab.opportunities.applications', id: opportunity.data.id } });
  assert(applications.data?.length === 1 && applications.data[0].applicant_id === bob.id, 'Recruiter should see exactly one application per student');
  await request('/api/collaboration', { token: alice.token, body: { action: 'collab.opportunities.application.review', application_id: applications.data[0].id, status: 'shortlisted' } });
  const myApplications = await request('/api/collaboration', { token: bob.token, body: { action: 'collab.opportunities.my_applications' } });
  assert(myApplications.data?.some((a) => a.opportunity_id === opportunity.data.id && a.status === 'shortlisted'), 'Student should see updated application status');
  await request('/api/collaboration', { token: bob.token, body: { action: 'collab.opportunities.applications', id: opportunity.data.id }, expected: 404 });
  await request('/api/features', { token: bob.token, body: { action: 'mentorship.offer.save', title: 'Unauthorized student offer', duration_minutes: 30 }, expected: 403 });
  const mentorOffer = await request('/api/features', { token: teacher.token, body: { action: 'mentorship.offer.save', title: 'Smoke-test portfolio mentoring', topics: 'portfolio, career', description: 'Review goals and next steps.', duration_minutes: 30, mode: 'online', availability: 'Weekdays' } });
  assert(mentorOffer.data?.ok, 'Teacher should be able to publish a mentorship offer');
  const mentorOffers = await request('/api/features', { token: bob.token, body: { action: 'mentorship.offers.list' } });
  const foundMentorOffer = mentorOffers.data?.find((offer) => offer.title === 'Smoke-test portfolio mentoring');
  assert(foundMentorOffer, 'Students should be able to discover mentor offers');
  const mentorBooking = await request('/api/features', { token: bob.token, body: { action: 'mentorship.request', offer_id: foundMentorOffer.id, preferred_at: '2030-01-02T10:00', goal: 'I would like feedback on my portfolio and career plan.' } });
  assert(mentorBooking.data?.id, 'Student should be able to request a mentorship session');
  await request('/api/features', { token: teacher.token, body: { action: 'mentorship.booking.review', id: mentorBooking.data.id, status: 'accepted' } });
  const mentorBookings = await request('/api/features', { token: bob.token, body: { action: 'mentorship.mine' } });
  assert(mentorBookings.data?.some((booking) => booking.id === mentorBooking.data.id && booking.status === 'accepted'), 'Mentorship booking status should persist for both participants');
  const resource = await request('/api/features', { token: teacher.token, body: { action: 'knowledge.create', title: 'Smoke-test learning resource', summary: 'A useful overview.', resource_url: 'https://example.test/learning', category: 'Research', audience: 'everyone', scope: 'global' } });
  assert(resource.data?.id, 'Teacher should be able to publish a knowledge resource');
  const resources = await request('/api/features', { token: bob.token, body: { action: 'knowledge.list' } });
  assert(resources.data?.some((item) => item.id === resource.data.id), 'Students should be able to discover global learning resources');
  await request('/api/features', { token: bob.token, body: { action: 'interviews.schedule', application_id: applications.data[0].id, scheduled_at: '2030-01-03T10:00' }, expected: 403 });
  const interview = await request('/api/features', { token: alice.token, body: { action: 'interviews.schedule', application_id: applications.data[0].id, scheduled_at: '2030-01-03T10:00', duration_minutes: 30, meeting_url: 'https://meet.example.test/room', notes: 'Prepare a short project walkthrough.' } });
  assert(interview.data?.id, 'Recruiter should be able to schedule an interview for an application');
  const candidateInterviews = await request('/api/features', { token: bob.token, body: { action: 'interviews.list' } });
  assert(candidateInterviews.data?.some((item) => item.id === interview.data.id && item.candidate_name === 'Bob Example'), 'Candidate should see their interview details');
  await request('/api/features', { token: alice.token, body: { action: 'interviews.update', id: interview.data.id, status: 'completed', notes: 'Completed smoke-test interview.' } });
  const updatedInterviews = await request('/api/features', { token: bob.token, body: { action: 'interviews.list' } });
  assert(updatedInterviews.data?.some((item) => item.id === interview.data.id && item.status === 'completed'), 'Interview status changes should be visible to the candidate');
  await request('/api/collaboration', { token: bob.token, body: { action: 'collab.opportunities.applications', id: opportunity.data.id }, expected: 404 });
  // Reports are available to ordinary users only for submission; the report queue is admin-only.
  await request('/api/features', { token: bob.token, body: { action: 'safety.report', target_type: 'user', reported_user_id: alice.id, reason: 'Smoke-test report for admin queue authorization.' } });
  await request('/api/features', { token: bob.token, body: { action: 'safety.admin_reports' }, expected: 403 });
  const adminDb = new DatabaseSync(dbPath);
  adminDb.prepare("UPDATE profiles SET role='admin' WHERE id=?").run(alice.id);
  adminDb.close();
  const adminReports = await request('/api/features', { token: alice.token, body: { action: 'safety.admin_reports' } });
  assert(adminReports.data?.some((r) => r.reported_user_id === alice.id && r.status === 'open'), 'Admin should be able to review reports in the moderation queue');

  await request('/api/auth/user', { token: 'invalid-token', method: 'GET', expected: 401 });
  console.log('UniLink smoke test passed: health, signup/session, message privacy, friend requests, notifications, direct messages, planner persistence, community feed/media uploads, clubs, marketplace photos, event chat rooms, mentorship booking, knowledge resources, interview scheduling/status, auth rejection, professional networking, project collaboration, portfolio projects and achievements, opportunity application/review, and admin-only moderation.');
} catch (error) {
  console.error(error?.stack || error);
  if (logs) console.error('\n--- server logs ---\n' + logs);
  process.exitCode = 1;
} finally {
  child.kill('SIGTERM');
  await new Promise((resolve) => { child.once('exit', resolve); setTimeout(resolve, 3000); });
  fs.rmSync(temp, { recursive: true, force: true });
}
