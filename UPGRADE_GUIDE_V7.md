# UniLink v7 — Feature guide

## Main social features
- **Messages:** private conversations, attachments, conversation search, unread counts, block/unblock, and friends panel.
- **Friends:** search students, send requests, accept/reject incoming requests, cancel outgoing requests, remove friends, and message accepted friends.
- **Privacy:** profile message preference can be set to everyone or friends only; blocking remains available in direct messages.
- **Community:** student feed, comments/reactions, clubs, event RSVP, marketplace, discover students, and notifications.
- **Group chat:** use the existing Chat page to join and manage campus chat rooms. Room chat reactions are supported.
- **Events and campus:** Events, Campus Hub, Planner, and Collaborate pages remain available.
- **Career and student tools:** Resume Builder, Career Coach, AI Study Tools, Tutoring, Project & Hackathon Hub, Campus Navigator, and Campus Helpdesk remain available.

## Run locally
1. Extract this archive.
2. Open the `campusconnect` folder in a terminal.
3. Run `npm install`.
4. Run `npm run typecheck` and `npm run build` to validate the project.
5. Run `npm run dev` to start the development app.

## Production notes
- Configure the database, authentication, and environment variables required by your deployment before publishing.
- Browser-local drafts are local to a device/browser and do not sync across accounts.
- Test privacy, authorization, backups, and moderation before inviting real students.
