# UniLink update notes

## College email verification (fixes and completion)
- **Automatic college verification now works in the app that actually runs.** It was only implemented as a Supabase SQL migration, which the Node/SQLite server never used. The server now verifies a student when their **confirmed** email domain exactly matches the domain registered for exactly one college (`server/collegeEmail.js`).
- **Email confirmation added** (`server/emailConfirm.js`, `server/mailer.js`). Sign-up and email changes send a one-time link (24 h); until it is opened the address is unconfirmed and cannot verify anyone. A reminder banner with "Resend email" shows meanwhile. Sending uses Resend over HTTPS (no new npm package); see `.env.example`.
- **Pre-registration takeover closed.** Someone could sign up with a victim's address first, then the victim's Google login would land in an account the attacker could also open. Google sign-in now revokes the earlier password and sessions of an unconfirmed account it takes over.
- **Google sign-in crashed for every new user** (`crypto.randomBytes` was used without importing `node:crypto` in `server/index.js`). Fixed. The server also now checks the token issuer.
- Public mail providers (gmail.com ...) never verify, two colleges on one domain are treated as ambiguous, and people who are already verified are never changed.
- **Supabase migration `20261017150000` corrected** (only matters if you really deploy on Supabase): the matcher function is no longer callable through the API (anyone could verify any account), `www.` stripping works, the first-user super-admin bootstrap is kept, and students can still choose a college (verification is dropped when they do, as on the Node server).
- Run `npm run test:college-email` for an end-to-end check against a throwaway database. Existing SQLite databases are upgraded automatically; existing accounts start as unconfirmed.

## Latest UI and event updates
- The AI assistant launcher is moved above the composer on Chat rooms and Messages so it no longer covers the send button. The assistant panel is shorter on those pages.
- Profile access and the dark/light theme toggle are available in the top-right app bar on desktop and mobile.
- Chat-room information headers and message composers stay anchored while the message history scrolls; direct-message headers/composers are anchored too.
- Campus events now support start and end dates. The end date cannot be earlier than the start date, and date ranges are displayed in event cards, the Home page, Community feed, event attendance/certificates, and the admin Home manager. Existing events are backfilled as single-day events.

## Database migration
- Local SQLite databases are upgraded automatically when the server starts.
- For Supabase deployments, apply `supabase/migrations/20261016100000_event_end_dates.sql` before using the updated event form.

## Validation status
- Server/script syntax checks and SQLite startup smoke test were run.
- Frontend production build/typecheck could not be completed in this environment because npm dependencies could not be installed; run `npm ci`, `npm run typecheck`, and `npm run build` before deploying.
- Existing external services (Supabase project settings and any configured AI provider) still need their own credentials and deployment configuration.

## Review fixes (server and events)
- Events: the server now rejects an end date before the start date or an invalid date (create and edit), and stores a single-day event's end date as its start date. Before, only the browser form checked this.
- Events: the upcoming/past check on the Events page no longer marks today's events as past for people west of UTC; the Home page now shows the date range on event cards and parses dates as local days.
- Events (Community tab): the list shows upcoming events first, so old events can no longer push new ones past the 100-row limit.
- RSVP to a college-only event and joining a college-only study group now check college membership on the server.
- An event's organizer can no longer be changed through an edit.
- Still not run here (npm registry was unreachable): `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`. Run them before deploying.
- Student tools > My Dashboard crashed to a blank page (the saved-goals list was read as the wrong shape). Fixed in src/pages/StudentToolsPages.tsx.
- AI assistant: higher token limit (Gemini 2.5/3 models can use the budget on thinking and return an empty answer) and the provider's real error is now printed in the server terminal as `[assistant] ...`.

## UniLink v7 — all-in-one student platform upgrade

This release builds on the v6 friends/chat project and keeps the existing page-based layout compact.

### Social and messaging
- Added the ability to cancel an outgoing friend request from Messages → Friends & requests.
- Added a confirmation-protected Remove friend action for accepted friends.
- Existing friend request acceptance/rejection, friend-only message privacy, blocking/unblocking, direct-message attachments, unread counts, and conversation search are retained.
- Existing group/room chat supports chat reactions through the chat reaction API.

### Campus community and collaboration
- Existing Community page includes the student feed, clubs, event RSVP, marketplace, student discovery, and notifications.
- Existing Events page, collaboration/project hub, campus hub, planner, and tutoring pages remain available.
- Existing career coach, resume builder, student growth tools, and application-oriented resources remain available.

### Important deployment note
Some student-tool modules intentionally store personal draft data in the current browser and display that fact in their UI. They are useful single-user tools but are not shared multi-user services until a secure authenticated backend is connected. Real-time typing indicators, direct-message reactions/editing, and delivery/read receipts beyond the existing unread/seen behavior are not claimed as implemented by this release.

### Validation
- Checked modified server JavaScript files with Node's syntax checker.
- Run `npm install`, `npm run typecheck`, and `npm run build` locally before deploying; this archive was edited without installed dependencies in the build environment.

## UniLink v8 — usability and resilience refinement

- Page navigation now uses URL hashes, so the current section can be bookmarked, refreshed, or shared as a link, and browser Back/Forward navigation moves between recently visited sections.
- Added a page-level React error boundary. If an individual feature page crashes, users see a recovery screen instead of losing the entire app shell; changing to another page resets the boundary.
- Added a keyboard-accessible “Skip to main content” link and a named main navigation landmark.
- Added consistent high-visibility keyboard focus outlines for interactive controls.
- Added a system-level reduced-motion preference to tone down transitions and animations for users who request less motion.

### Validation
- `node scripts/check.mjs` passes (34 server/script files).
- Frontend typecheck could not be completed because the package install was interrupted and the local type-definition packages are incomplete. Run `npm ci`, then `npm run typecheck` and `npm run build` before deployment.

## v10 — Functional reliability update

- Added `GET /api/health` for hosting health checks without exposing secrets or filesystem paths.
- Changed the default Node server bind address to `0.0.0.0` so hosted services can reach it; local-only setups can set `HOST=127.0.0.1`.
- Friend request, acceptance, and rejection now create persistent notifications for the other participant.
- Added `npm run smoke-test`, which launches an isolated temporary database and checks key account, privacy, friend, DM, notification, planner, and community-feed flows.
- Added production hosting, persistent storage, backup/restore, and launch checklist guidance in `PRODUCTION_READINESS.md`.
- Verification: server/script syntax check and the end-to-end smoke test passed. TypeScript and production build could not be verified here because dependency installation did not complete in this environment.

## v11 — PWA and launch readiness

- Added a web app manifest and mobile install metadata.
- Added a conservative service worker that caches only the static shell and assets; API/private responses and non-GET requests are never cached.
- Added an install prompt and offline connectivity notice, including a clear note that private data is not available offline.
- Extended `npm run check` with manifest and service-worker privacy assertions.
- Added a functionality inventory and production launch checklist.
