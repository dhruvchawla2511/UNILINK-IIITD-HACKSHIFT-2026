-- Teacher Portal additions. The local SQLite backend also creates equivalent tables
-- idempotently in server/collaboration.js. This migration documents hosted schema intent.
CREATE TABLE IF NOT EXISTS teacher_mentorship_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentorship_id uuid NOT NULL REFERENCES mentorship_requests(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS teacher_mentorship_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentorship_id uuid NOT NULL REFERENCES mentorship_requests(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS teacher_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 15 AND 180),
  capacity integer NOT NULL DEFAULT 1 CHECK (capacity BETWEEN 1 AND 100),
  session_type text NOT NULL DEFAULT 'office_hours',
  location text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS teacher_session_bookings (
  session_id uuid NOT NULL REFERENCES teacher_sessions(id) ON DELETE CASCADE,
  attendee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, attendee_id)
);
CREATE TABLE IF NOT EXISTS teacher_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  resource_type text NOT NULL DEFAULT 'article' CHECK (resource_type IN ('article','workshop','webinar','resource')),
  visibility text NOT NULL DEFAULT 'network',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_teacher_sessions_teacher_start ON teacher_sessions(teacher_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_teacher_resources_author_created ON teacher_resources(author_id, created_at DESC);
