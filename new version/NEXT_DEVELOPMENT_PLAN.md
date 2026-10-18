# UniLink — Product and Engineering Plan

## Product vision
UniLink is an all-in-one learning, career, startup, and networking ecosystem for both college-verified members and public users. Its core workflows should be connected: teachers publish learning material, recruiters publish opportunities and review applicants, founders publish projects and find collaborators, students learn and apply, and administrators keep the platform safe.

## Implemented in this update
- **Unified professional publishing:** teacher, recruiter, and founder portals use one persistent content studio instead of a separate legacy teacher-only publisher.
- **Publishing audience controls:** content can be public or limited to verified members of the creator's college. Server-side event visibility policies remain authoritative; college-only publishing is subject to college permission rules.
- **Content management:** creators can review their own posts, edit them, delete them, and receive success/error feedback.
- **Live professional network:** professional portals query the existing verified-profile matching API, filter profiles by skills/interests/role/company, send connection requests, show request/connected state, and accept incoming requests.
- **Working recruiter workflow:** recruiter talent pipeline now opens the existing opportunity/application workflow instead of a static checklist.
- **Working founder workspace:** founder startup section now opens the existing collaboration workspace and opportunity tools instead of a static checklist.
- **Admin access correction:** accounts with website-admin privileges are no longer automatically redirected into the professional portal based solely on their portal type. The separate admin navigation remains available, and server-side admin authorization is unchanged.
- **Regression coverage:** smoke tests now assert that ordinary users cannot read the admin moderation queue and admins can.

## Product roadmap
### P0 — Reliability and safety
- Run typecheck, lint, production build, and end-to-end tests in a complete dependency environment.
- Verify every role's server-side permissions; never rely on hidden UI controls alone.
- Test public vs. college-only content with verified, unverified, and cross-college accounts.
- Confirm database backups, restore procedure, email delivery, upload limits, and production secrets.

### P1 — Finish the connected core workflows
- Teacher: classrooms, notes, assignments, submissions, grading, resource publishing, and engagement summaries.
- Recruiter: job creation, eligibility, applications, shortlist/interview/offer states, and candidate notifications.
- Founder: startup/project listings, team discovery, collaborator applications, milestones, and clear compensation/ownership details.
- Student: one feed for resources, events, internships, jobs, projects, and application updates.

### P2 — Platform administration
- Dedicated administrator workspace for account/college verification, reports, content moderation, role management, audit trail, and platform health.
- Least-privilege admin roles; reserve super-admin actions for the owner.
- Moderation actions must record who acted, what changed, and when.

### P3 — Discovery and retention
- Search across courses/resources, events, people, opportunities, and projects.
- Opt-in recommendations based on declared skills, interests, and goals.
- Notifications preferences, saved items, mobile polish, accessibility checks, and useful—not vanity—analytics.

## Release acceptance checklist
- Every create/edit/delete action persists after reload and is scoped to its owner.
- College-only records are invisible to unverified and cross-college users.
- A student can apply once, see status changes, and receive notifications.
- A teacher can publish a resource that appears in the student feed.
- A recruiter can review applications only for their own listings.
- A founder can publish a project and connect with available collaborators.
- Non-admins receive 403 responses for admin-only APIs.
- `npm run check`, `npm run smoke-test`, `npm run typecheck`, `npm run lint`, and `npm run build` pass before production deployment.
