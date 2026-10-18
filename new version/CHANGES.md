# UniLink update notes

## Direct uploads, marketplace messaging, and event chat rooms
- Community posts can now include up to six direct image/video uploads. The server validates that media belongs to the posting user, returns media type metadata, and enforces post visibility when serving attached files.
- Marketplace listings support up to six uploaded product photos. Photos appear on listing cards, and buyers can use **Chat with Seller** to open a direct message with the seller.
- Fixed the room member profile card so the avatar is not clipped by the header overlap. Selecting the photo opens the full image in a fit-to-screen viewer.
- Every newly posted event now gets an event chat room owned by its creator. **Join Event** adds the user to the room and marks their RSVP as going, then opens the room in Chat. Legacy events get their room on first join.
- Existing SQLite databases automatically add the new media and event-room columns. `npm run smoke-test` now covers direct image/video upload, marketplace photos, event room ownership, membership, and RSVP, using temporary storage for test uploads.

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

## Classrooms (2026-10-18)
- Added a Classes page for teacher-created classrooms and student code-based joining.
- Teachers can share the unique join code, publish lesson notes, and post class announcements.
- Students can view notes and announcements only for classes they have joined.
- Added authenticated `/api/classrooms` actions with server-side role and membership checks, SQLite schema, and a hosted-schema migration.
- Added Classes navigation and a shortcut from the teacher portal overview.

## Teacher classrooms (2026-10-18)
- Added teacher-managed classrooms with unique shareable join codes.
- Added student code entry and membership-based classroom access.
- Added class feed posts for lesson notes and student-facing announcements.
- Enforced teacher ownership on class creation and publishing, and student-only class joining in the backend.
- Added SQLite runtime schema and a hosted Supabase migration for classroom tables.
- Added a Classrooms area to the teacher portal and a Classes page in student navigation.
- Validation: backend JavaScript syntax check passes. Full frontend typecheck/build could not be confirmed because dependency installation timed out in this environment.

## Recruiter and Founder portal additions (2026-10-18)
- Added a dedicated Recruiter Talent Pipeline section with structured hiring stages, role scorecards, candidate communication guidance, and early-career pipeline planning.
- Added a dedicated Founder Startup Workspace section for startup briefs, co-founder skills, scoped projects, milestones, and faculty/recruiter partnerships.
- Added role-specific dashboard cards and navigation, while hiding teacher-only classroom/research sections from recruiter and founder navigation.
- Recruiter and Founder account choices already exist in the authentication portal selector; their role-specific workspace now has clearer dedicated entry points.
- Note: these are workspace/planning views; live candidate tracking and persistent startup milestone APIs still require backend integration.

## UniLink all-workflows upgrade (2026-10-18)
- Added classroom assignments with optional due dates, student submissions, teacher submission review, grading, and feedback.
- Class notes, announcements, and newly created assignments now create in-app notifications for enrolled students.
- Replaced the professional portal's static opportunities information panel with a live marketplace backed by existing opportunity APIs: verified recruiters, founders, and teachers can publish jobs, internships, startup projects, referrals, scholarships, and volunteer opportunities; members can express interest/apply; owners can remove their own listings.
- Added the matching Supabase migration for assignment and submission records.
- Existing collaboration, mentorship, events, career assistant, role-based authentication, and account/security modules remain included.
- Validation: server/script syntax and PWA checks passed; API smoke test passed. A production frontend build could not be run in this environment because Vite is missing from the extracted dependencies (`npm run build` reports `vite: not found`). Run `npm install` and then `npm run typecheck`, `npm run build`, and `npm run smoke-test` locally before deployment.

### Frontend build validation follow-up (2026-10-18)
- Fixed an extra closing parenthesis in the classroom assignments/submissions JSX that caused TypeScript parsing to fail.
- Parsed all 80 non-declaration TypeScript/TSX source files using the locally available TypeScript transpiler; no syntax errors remain.
- A full Vite production build and dependency-aware typecheck remain blocked in this environment because the npm registry cannot be resolved and the extracted `node_modules` directory is incomplete. Run `npm ci`, then `npm run typecheck` and `npm run build` in an environment with npm registry access.

## Existing workflow completion (2026-10-18)
- Connected the Professional Network section to the existing verified-profile discovery endpoint, including live search, match context, and connection requests instead of a static placeholder.
- Completed opportunity application tracking: students can see their applications and statuses; opportunity owners can review applicants and move them through reviewing, shortlisted, interview, offer, or rejected stages.
- Enforced server-side publishing permissions so only verified recruiter, founder, teacher, or admin accounts can publish opportunities; applying requires college verification.
- Prevented duplicate application notifications and blocked applications after the deadline; expired opportunities are hidden from general discovery but remain visible to their owners.
- Added end-to-end smoke coverage for professional discovery, connection requests, opportunity publishing, applications, status changes, duplicate prevention, and non-owner access denial.
- Validation: `npm run check`, `npm run smoke-test`, and TypeScript transpilation of 80 TS/TSX files passed. Full dependency-aware typecheck and Vite production build remain unverified because dependencies could not be installed in this environment.

## UniLink connected-ecosystem update (2026-10-18)
- Consolidated teacher, recruiter, and founder publishing on the same content studio, with edit/delete controls and public vs. college-only audience selection.
- Replaced the professional portal's placeholder network search with live verified-profile matching, local filters, connection request states, and request acceptance.
- Recruiter talent pipeline now uses the live opportunity/application workspace; founder startup workspace now uses the collaboration and project workspace.
- Fixed portal-mode selection so website administrators with a professional portal type can still reach the separate admin interface.
- Extended API smoke coverage to assert admin-only access to the moderation report queue.
- Validation: `npm run check` and `npm run smoke-test` pass. Typecheck is currently blocked by incomplete installed type packages in this environment; production build is blocked because Vite is not installed locally. Run `npm ci`, then `npm run typecheck`, `npm run lint`, and `npm run build` before deployment.

## Portal switching navigation fix
- Fixed the professional-to-student switch being overridden by the automatic professional-portal default after a refresh.
- Store the signed-in user's selected portal in `sessionStorage`, restore it on reload, and retain the original role-based default only when no choice exists.
- Added a visible **Switch to professional portal** action in the student workspace for eligible teacher, founder, and recruiter accounts.
- Added `npm run test:portal-navigation` to verify both switch controls and the session-persistence wiring.


## University email domains and professional role badges

- Added an importable `database/seed/college-email-domains.csv` dataset for separately confirmed official university email domains that differ from the college website domain. The server imports these aliases idempotently into `college_email_domains` at startup.
- Added automatic Teacher, Recruiter, and Founder role badges based on the server-side portal profile. The Verified Teacher badge is shown only when the teacher profile is college-verified and the email address has been confirmed.
- System role badges are display-only and cannot be manually awarded or edited. Recruiter/Founder portal badges identify the chosen portal and do not claim employer/startup identity has been independently verified.
- Gmail and other public mailbox providers remain excluded from institutional affiliation verification; a personal Gmail address cannot prove that someone works at a university.
- Added smoke-test coverage for domain aliases and automatic role badges.

## Company verification for recruiters and founders
- Added a seeded company directory with major international and Indian employers and exact corporate email-domain allowlists.
- Recruiters can select an employer and automatically earn the Verified Recruiter badge only when their UniLink email is confirmed and its domain exactly matches that employer's curated domain list.
- Founders can submit a startup/company name, domain, website, and review notes; the request stays pending until a website admin approves it.
- Added an admin Company requests panel and server-side authorization for all review actions.
- Added Verified Recruiter and Verified Founder system badges sourced only from server-side approved verification records.
- Added smoke-test coverage for recruiter domain verification, public-email rejection, founder review, and verified badge assignment.


## Secure class and room codes
- Teacher class join codes now use eight cryptographically selected random words, normalized so students can enter spaces or hyphens.
- Chat room join codes now use 10-digit numeric codes, with frontend validation updated accordingly.
- Existing legacy room codes and class codes are rotated on server startup to the new formats; old codes stop working.
- Room-code attempts remain rate-limited.
