# UniLink functionality and launch checklist

This release adds an installable PWA shell and offline-state messaging while preserving the existing application and its server-backed modules.

## Implemented in this project

- Authentication and profile management, including profile completeness and account security UI.
- Chat rooms, direct messages, friend requests, room moderation, attachments, polls, and reactions (availability depends on configured realtime provider).
- Community feed with posts, comments, and reactions; college/global visibility scopes.
- Campus clubs and study groups with membership controls.
- Events with RSVP, organizer attendance tracking, and attendance certificates.
- Marketplace listings, saved listings, lost-and-found, and safety reports/blocking.
- Career opportunities, saved opportunities, and application tracking.
- Planner and student study/career tools.
- Admin moderation/report review, college management, and platform analytics.
- PWA manifest, service worker shell caching, install prompt, and online/offline indicator.

## PWA privacy design

The service worker only caches the static app shell and static assets. It explicitly bypasses `/api/` and all non-GET requests. It does not store authenticated responses, messages, account data, or other private records for offline access. Offline mode is a shell fallback, not offline chat or offline form submission.

## Before a public launch

1. Run `npm ci`, `npm run check`, `npm run typecheck`, `npm run build`, and `npm run smoke-test` on the target Node version.
2. Configure production HTTPS and a strong unique secret for every auth/session integration.
3. Verify the database and uploaded files use persistent storage and schedule encrypted backups with a tested restore procedure.
4. Verify authorization rules at the API/database layer for every private resource; do not rely on hidden UI controls.
5. Configure email/password recovery and validate delivery before enabling public registration.
6. Configure upload limits, MIME validation, abuse/rate limits, logging redaction, and report escalation.
7. Test two accounts in separate browsers for friend requests, privacy restrictions, blocking, messaging, event RSVP, marketplace visibility, and account deletion.
8. Test mobile sizes, keyboard navigation, screen-reader labels, dark mode, and the PWA install flow over HTTPS.
9. Review legal/privacy disclosures and retention/deletion behavior before inviting real students.

## Deployment note

A static-only host cannot run the Node API or persist the SQLite database. Deploy the Node server and client build together, or deploy the API and frontend separately with correct CORS/auth configuration. If using a serverless/ephemeral filesystem, migrate SQLite and local uploads to managed persistent services first.
