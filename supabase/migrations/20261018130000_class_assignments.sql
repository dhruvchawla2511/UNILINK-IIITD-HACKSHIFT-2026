-- Classroom assignments and student submissions. The API additionally checks teacher ownership and class membership.
CREATE TABLE IF NOT EXISTS teacher_class_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 160),
  instructions text NOT NULL CHECK (char_length(instructions) BETWEEN 2 AND 8000),
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS teacher_class_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES teacher_class_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  answer text NOT NULL CHECK (char_length(answer) BETWEEN 1 AND 8000),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  grade text NOT NULL DEFAULT '',
  feedback text NOT NULL DEFAULT '',
  reviewed_at timestamptz,
  UNIQUE (assignment_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_class_due ON teacher_class_assignments(class_id, due_at);
CREATE INDEX IF NOT EXISTS idx_teacher_submissions_assignment ON teacher_class_submissions(assignment_id, submitted_at DESC);
ALTER TABLE teacher_class_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_class_submissions ENABLE ROW LEVEL SECURITY;
-- Use the authenticated API for writes; production deployments should mirror teacher ownership and enrolled-student checks in RLS policies.
