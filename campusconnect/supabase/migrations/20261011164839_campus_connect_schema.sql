/*
# Unilink - Core Schema

## Overview
Creates the complete database schema for Unilink, a platform enabling college
student communities to connect, collaborate, and promote opportunities across campuses.

## New Tables
1. `colleges` - Registered colleges/universities with name, domain, city, description
2. `profiles` - Extended user info: role (student/admin/super_admin), college, verification
3. `chat_rooms` - Chat channels: global (all colleges), college (single college), private (DM)
4. `room_members` - Junction table for chat room membership
5. `messages` - Individual messages in chat rooms
6. `events` - Campus events/opportunities: title, description, date, location, category
7. `verifications` - Admin-issued verification records linking students to colleges

## Security
- RLS enabled on ALL tables
- Profiles: all authenticated users can read; users update their own; admins can update any
- Colleges: all can read; only admins can insert/update/delete
- Chat rooms: global and college rooms visible to all; private rooms visible to members only
- Messages: all authenticated can read; users insert only as themselves
- Events: all can read; creators manage their own
- Verifications: users read their own; admins read all and manage status
*/

-- ============ TABLES (all created first to resolve FK ordering) ============

CREATE TABLE IF NOT EXISTS colleges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text,
  city text,
  state text,
  description text,
  logo_url text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin', 'super_admin')),
  college_id uuid REFERENCES colleges(id) ON DELETE SET NULL,
  is_verified boolean NOT NULL DEFAULT false,
  avatar_url text,
  bio text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  room_type text NOT NULL CHECK (room_type IN ('global', 'college', 'private')),
  college_id uuid REFERENCES colleges(id) ON DELETE CASCADE,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(room_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  event_date date NOT NULL,
  end_date date,
  location text,
  category text DEFAULT 'general',
  college_id uuid REFERENCES colleges(id) ON DELETE SET NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  college_id uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

-- ============ ENABLE RLS ============

ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES: COLLEGES ============

DROP POLICY IF EXISTS "read_colleges" ON colleges;
CREATE POLICY "read_colleges" ON colleges FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_colleges_admin" ON colleges;
CREATE POLICY "insert_colleges_admin" ON colleges FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin'))
  );

DROP POLICY IF EXISTS "update_colleges_admin" ON colleges;
CREATE POLICY "update_colleges_admin" ON colleges FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin'))
  );

DROP POLICY IF EXISTS "delete_colleges_admin" ON colleges;
CREATE POLICY "delete_colleges_admin" ON colleges FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin'))
  );

-- ============ POLICIES: PROFILES ============

DROP POLICY IF EXISTS "read_profiles" ON profiles;
CREATE POLICY "read_profiles" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "admin_update_profiles" ON profiles;
CREATE POLICY "admin_update_profiles" ON profiles FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin'))
  );

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- ============ POLICIES: CHAT ROOMS ============

DROP POLICY IF EXISTS "read_chat_rooms" ON chat_rooms;
CREATE POLICY "read_chat_rooms" ON chat_rooms FOR SELECT
  TO authenticated USING (
    room_type IN ('global', 'college')
    OR EXISTS (SELECT 1 FROM room_members rm WHERE rm.room_id = chat_rooms.id AND rm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_chat_rooms" ON chat_rooms;
CREATE POLICY "insert_chat_rooms" ON chat_rooms FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "update_chat_rooms_owner" ON chat_rooms;
CREATE POLICY "update_chat_rooms_owner" ON chat_rooms FOR UPDATE
  TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "delete_chat_rooms_owner" ON chat_rooms;
CREATE POLICY "delete_chat_rooms_owner" ON chat_rooms FOR DELETE
  TO authenticated USING (auth.uid() = created_by);

-- ============ POLICIES: ROOM MEMBERS ============

DROP POLICY IF EXISTS "read_room_members" ON room_members;
CREATE POLICY "read_room_members" ON room_members FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_room_members" ON room_members;
CREATE POLICY "insert_room_members" ON room_members FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_room_members_own" ON room_members;
CREATE POLICY "delete_room_members_own" ON room_members FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ POLICIES: MESSAGES ============

DROP POLICY IF EXISTS "read_messages" ON messages;
CREATE POLICY "read_messages" ON messages FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_messages" ON messages;
CREATE POLICY "insert_messages" ON messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "delete_messages_own" ON messages;
CREATE POLICY "delete_messages_own" ON messages FOR DELETE
  TO authenticated USING (auth.uid() = sender_id);

-- ============ POLICIES: EVENTS ============

DROP POLICY IF EXISTS "read_events" ON events;
CREATE POLICY "read_events" ON events FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_events" ON events;
CREATE POLICY "insert_events" ON events FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "update_events_own" ON events;
CREATE POLICY "update_events_own" ON events FOR UPDATE
  TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "delete_events_own" ON events;
CREATE POLICY "delete_events_own" ON events FOR DELETE
  TO authenticated USING (auth.uid() = created_by);

-- ============ POLICIES: VERIFICATIONS ============

DROP POLICY IF EXISTS "read_verifications_own_admin" ON verifications;
CREATE POLICY "read_verifications_own_admin" ON verifications FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin'))
  );

DROP POLICY IF EXISTS "insert_verifications_own" ON verifications;
CREATE POLICY "insert_verifications_own" ON verifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_verifications_admin" ON verifications;
CREATE POLICY "update_verifications_admin" ON verifications FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin'))
  );

-- ============ INDEXES ============

CREATE INDEX IF NOT EXISTS idx_profiles_college ON profiles(college_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_college ON chat_rooms(college_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_type ON chat_rooms(room_type);
CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_room_members_room ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_events_college ON events(college_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_verifications_status ON verifications(status);

-- ============ TRIGGER: auto-create profile on signup ============

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'full_name', new.email));
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
