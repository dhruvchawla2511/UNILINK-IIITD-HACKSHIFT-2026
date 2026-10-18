# UniLink v12 — Feature audit and discovery upgrade

## Implemented in this update

- The `Ctrl+K` / `Cmd+K` command palette now searches people as well as navigation destinations.
- People search starts after two characters, waits briefly before calling the authenticated API, limits visible results, handles loading/no-result states, and cancels stale requests.
- Selecting a person opens the direct-message workflow through the app's existing DirectMessageProvider.
- The people search UI does not display email addresses. Results come from the server's existing people-search endpoint, which excludes the signed-in user and respects blocking rules.
- Existing navigation and keyboard escape behavior are preserved.

## Existing modules present in the project

- Authentication and profile management
- College verification and role-based admin screens
- Direct messages, friend requests, blocking, unread counts, read/presence APIs, and room chat
- Community posts and moderation/report workflows
- Events and RSVP workflows
- Clubs/study groups and collaboration modules
- Marketplace and career/application tools
- Planner and student tools
- Resume builder and PDF/print workflow
- PWA shell caching and offline-state indicator

Presence of a module in source does not by itself prove every integration is configured or production-ready. Verify all workflows against the actual deployment and database policies.

## Verification performed for this archive

- `npm run check`: passed (server/script syntax and PWA static checks).
- `npm run typecheck`: could not complete because dependency installation in the build environment left missing type definitions. Run `npm ci` in a normal network-enabled development environment, then rerun typecheck and build.
- Production build and full multi-account end-to-end tests remain unverified in this environment.

## Recommended pre-launch test matrix

1. Create two student accounts and one admin account.
2. Search for students from `Ctrl+K`, open a DM, and verify blocked users are not discoverable/contactable.
3. Test friend request send, accept, reject, cancel, remove, and notifications.
4. Confirm message privacy is enforced server-side, not just in the UI.
5. Test posts, comments, reports, event RSVP, marketplace visibility, and group membership with different roles.
6. Verify data persists after a server restart and backups can be restored.
7. Confirm HTTPS, password recovery email delivery, upload limits, rate limits, session invalidation, and production secrets.
8. Run `npm ci`, `npm run check`, `npm run typecheck`, `npm run build`, and `npm run smoke-test` on the target Node version.
