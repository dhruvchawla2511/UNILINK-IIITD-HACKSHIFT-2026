# UniLink production readiness and deployment

This release adds a server health endpoint, persisted friend-request notifications, and an end-to-end smoke test. It also changes the server's default bind address to `0.0.0.0`, which is required by most hosted web services. For local-only development, set `HOST=127.0.0.1` in `.env`.

## Verify the core flows

Use Node.js 22.13 or newer (the project uses the built-in `node:sqlite` module):

```bash
npm ci
npm run check
npm run typecheck
npm run build
npm run smoke-test
```

The smoke test starts an isolated temporary database and checks signup/session creation, server health, server-enforced direct-message privacy, friend request and acceptance, notification creation, direct-message creation, planner persistence, community feed visibility, and invalid-session rejection. It does not modify your real database.

After starting the app, `GET /api/health` returns only a minimal status object for platform health checks. It does not reveal database paths, credentials, or account data.

## Run locally

```bash
cp .env.example .env
npm install
npm run dev
```

The Vite development server proxies `/api` requests to the Node API on port 3001. For a production build, run `npm run build` and then `npm run server` (or `npm start`, which builds first).

## Hosting requirements

UniLink is a full-stack Node application, not a static-only site. The same Node process serves the API and the built frontend. Deploy it to a Node host that supports long-running processes and a persistent writable disk. Use Node 22.13+ and set:

- `HOST=0.0.0.0`
- `PORT` to the port supplied by the host
- `CAMPUSCONNECT_DB` to a database file on the host's **persistent disk**, for example `/var/data/unilink/campusconnect.db`
- `AI_API_KEY` only if you intentionally enable the optional AI provider; keep it server-side and never put it in `VITE_*` variables

The default SQLite file lives under `database/campusconnect.db`. On a host with an ephemeral filesystem, accounts, messages, uploads, and other records can be lost on restart or redeploy. Do not deploy production users to ephemeral storage. SQLite is suitable for a single app instance with a persistent disk; for multiple instances, use a shared production database and shared object storage, which this starter does not configure automatically.

Terminate HTTPS at the hosting provider or a trusted reverse proxy. Configure backups and test restoring them before accepting real users. Run `npm run backup` for a point-in-time SQLite backup; copy backups off the server rather than keeping the only copy beside the live database.

## Launch checklist

- [ ] `npm run check`, `npm run typecheck`, `npm run build`, and `npm run smoke-test` all pass.
- [ ] The hosting platform reports `GET /api/health` as healthy.
- [ ] Persistent disk is mounted and `CAMPUSCONNECT_DB` points to it.
- [ ] HTTPS is enabled and the real domain is configured.
- [ ] A backup and restore have been tested.
- [ ] Change the first-account-created super-admin flow before opening public signup if your deployment needs a pre-provisioned owner.
- [ ] Review privacy policy, terms, moderation, reporting, retention, and account deletion processes before inviting real users.
- [ ] Configure an AI provider only if wanted; built-in study and career tools can run without one, and should not be described as AI-powered unless a provider is configured.

## Known boundaries

The app has server-side authentication, SQLite persistence, SSE chat updates, friend requests, direct messages, notifications, community posts, event RSVPs, clubs, marketplace, study groups, opportunities, lost-and-found, and collaboration flows. This smoke test covers representative critical paths, not every screen or every permission edge case. A successful smoke test is not a security audit or a substitute for testing with real browsers, multiple accounts, mobile devices, and your chosen host.
