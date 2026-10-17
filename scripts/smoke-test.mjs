// End-to-end API smoke test using an isolated temporary SQLite database.
// Run with `npm run smoke-test`; it never touches the user's real database.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', CAMPUSCONNECT_DB: dbPath },
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
async function signup(email, full_name) {
  const result = await request('/api/auth/signup', { body: { email, full_name, password: 'test-password-123' } });
  assert(result.session?.access_token, `No session token returned for ${email}`);
  return { token: result.session.access_token, id: result.user.id };
}

try {
  await waitForServer();
  const health = await request('/api/health', { method: 'GET' });
  assert(health.status === 'ok' && health.database === 'ok', 'Health check should report app and database as ready');

  const alice = await signup('alice@example.test', 'Alice Example');
  const bob = await signup('bob@example.test', 'Bob Example');
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

  await request('/api/auth/user', { token: 'invalid-token', method: 'GET', expected: 401 });
  
  // REST endpoint input validation
  await request('/api/rest', { token: alice.token, body: { table: 'messages', op: 'insert', values: 'oops' }, expected: 400 });
  await request('/api/rest', { token: alice.token, body: { table: 'messages', op: 'insert', values: null }, expected: 400 });
  await request('/api/rest', { token: alice.token, body: { table: 'messages', op: 'select', limit: 5000 } });
  console.log('UniLink smoke test passed: health, signup/session, message privacy, friend requests, notifications, direct messages, planner persistence, community feed, and auth rejection.');
} catch (error) {
  console.error(error?.stack || error);
  if (logs) console.error('\n--- server logs ---\n' + logs);
  process.exitCode = 1;
} finally {
  child.kill('SIGTERM');
  await new Promise((resolve) => { child.once('exit', resolve); setTimeout(resolve, 3000); });
  fs.rmSync(temp, { recursive: true, force: true });
}
