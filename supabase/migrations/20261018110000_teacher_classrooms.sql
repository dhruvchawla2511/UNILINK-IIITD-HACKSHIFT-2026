-- Teacher-managed classrooms: join codes, membership, lesson notes, and announcements.
CREATE TABLE IF NOT EXISTS teacher_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  subject text NOT NULL DEFAULT '',
  join_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS teacher_class_members (
  class_id uuid NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, student_id)
);
CREATE TABLE IF NOT EXISTS teacher_class_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS teacher_class_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_teacher_classes_teacher ON teacher_classes(teacher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_class_members_student ON teacher_class_members(student_id, joined_at DESC);
ALTER TABLE teacher_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_class_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_class_announcements ENABLE ROW LEVEL SECURITY;
-- The application API performs role, teacher-ownership, and class-membership checks.
