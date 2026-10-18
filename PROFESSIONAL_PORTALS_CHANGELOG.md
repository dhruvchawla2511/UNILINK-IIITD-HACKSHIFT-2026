# Professional portals update

Added separate Teacher, Recruiter, and Founder portal selection to the authentication screen. New accounts persist their selected portal type separately from the privileged admin role. After signing in, those accounts land in a dedicated professional workspace without the student sidebar or student dashboard content.

The workspace includes role-specific advice, professional network search UI, opportunities, mentorship guidance, and event/session planning guidance. A visible "Go to student portal" action switches into the existing student application. Existing student accounts default to the student experience.

Database startup migration adds `profiles.portal_type` for existing SQLite databases; new database schema includes the same field. Server signup accepts only the allow-listed professional portal values and otherwise defaults to student.

## Validation

- `node --check server/index.js`: passed
- `node --check server/db.js`: passed
- SQLite startup/migration check for `profiles.portal_type`: passed
- Frontend build/typecheck: could not be completed in this environment because dependency installation did not finish and the Vite executable is unavailable.

## Shared publishing studio update — 2026-10-18

- Added `src/pages/ProfessionalContentStudio.tsx`, a role-aware content publishing studio for teachers, recruiters, and founders.
- Teacher content types include learning resources, workshops/webinars, research opportunities, and announcements.
- Recruiter content types include career updates, career workshops, recruitment events, and announcements.
- Founder content types include startup events, workshops, project/team opportunities, and announcements.
- Published items are saved to the shared `events` table with `visibility: everyone` and `show_on_home: true` so they can be surfaced by the student events/home feed.
- Each role can view its own posts and delete posts it created. Deletion is scoped by both item ID and creator ID in the client query.
- The shared studio is available from the Events section for all professional roles, and on the overview for recruiters and founders. The teacher overview's existing publishing form is retained.
- Existing opportunity marketplace remains the workflow for jobs, internships, startup projects, student applications, and applicant status review.

Validation note: `npm run check` passed. A full TypeScript/build check could not be completed in this environment because `npm ci` timed out and left incomplete dependency folders; rerun `npm ci`, `npm run typecheck`, and `npm run build` on a normal development machine before deployment.
