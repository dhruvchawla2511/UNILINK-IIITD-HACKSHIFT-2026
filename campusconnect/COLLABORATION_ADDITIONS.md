# UniLink collaboration additions

Implemented: cross-campus student discovery, skill/interests matching (shared keyword ranking), visibility opt-in, verified-user discovery, block enforcement, connection requests and recipient approval, team/project/event team listings, hackathon team applications, owner approvals and capacity checks, shared team tasks and status updates, basic adoption statistics, and portfolio/GitHub links from existing profiles.

Entry point: **Collaborate** in the sidebar. New server module: `server/collaboration.js`. Database tables are created on startup. No external AI service is used; matching is deterministic keyword overlap.

Security: server checks session authentication, team membership for tasks, team owner for approvals, and blocks for discovery/applications. These are not a substitute for an independent security audit. Production should add persistent rate limiting, stronger moderation, structured migrations, pagination, notifications, and end-to-end tests.

Run: Node >=22.13; `npm install`, `npm run dev`; then visit Collaborate. Run `npm run typecheck`, `npm run lint`, `npm run check` before release. Existing admin bootstrap and authentication flows were not changed in this patch.
