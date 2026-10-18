/*
# Home page content, controlled by the super admin

Adds the content that powers the Home page and lets only the super admin manage it.

## New tables
1. home_settings: one row with the hero title/subtitle and which sections are shown
2. home_slides: slideshow slides (title, subtitle, image, optional link to an app page)
3. media_items: images and videos used on the Home page and the Gallery

## Changes to existing tables
- events: new column show_on_home (super admin can hide an event from the Home page)

## Security
- RLS enabled on every new table
- Any signed-in user can read; only profiles.role = 'super_admin' can insert, update or delete
- Super admin may also update or delete any event (previously only the creator could)
*/

-- ============ TABLES ============

CREATE TABLE IF NOT EXISTS home_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hero_title text NOT NULL DEFAULT 'Welcome to Unilink',
  hero_subtitle text NOT NULL DEFAULT 'Connect Beyond Campus',
  show_slideshow boolean NOT NULL DEFAULT true,
  show_events boolean NOT NULL DEFAULT true,
  show_images boolean NOT NULL DEFAULT true,
  show_videos boolean NOT NULL DEFAULT true,
  events_count integer NOT NULL DEFAULT 6 CHECK (events_count BETWEEN 1 AND 24),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS home_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  subtitle text NOT NULL DEFAULT '',
  image_url text NOT NULL,
  link_page text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  url text NOT NULL,
  thumbnail_url text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'General',
  author text NOT NULL DEFAULT '',
  width integer NOT NULL DEFAULT 0,
  height integer NOT NULL DEFAULT 0,
  show_on_home boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS show_on_home boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_home_slides_order ON home_slides(sort_order);
CREATE INDEX IF NOT EXISTS idx_media_items_order ON media_items(sort_order, created_at DESC);

-- ============ RLS ============

ALTER TABLE home_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_items ENABLE ROW LEVEL SECURITY;

-- Read: any signed-in user
DROP POLICY IF EXISTS "read_home_settings" ON home_settings;
CREATE POLICY "read_home_settings" ON home_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "read_home_slides" ON home_slides;
CREATE POLICY "read_home_slides" ON home_slides FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "read_media_items" ON media_items;
CREATE POLICY "read_media_items" ON media_items FOR SELECT TO authenticated USING (true);

-- Write: super admin only
DROP POLICY IF EXISTS "insert_home_settings_super" ON home_settings;
CREATE POLICY "insert_home_settings_super" ON home_settings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));
DROP POLICY IF EXISTS "update_home_settings_super" ON home_settings;
CREATE POLICY "update_home_settings_super" ON home_settings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

DROP POLICY IF EXISTS "insert_home_slides_super" ON home_slides;
CREATE POLICY "insert_home_slides_super" ON home_slides FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));
DROP POLICY IF EXISTS "update_home_slides_super" ON home_slides;
CREATE POLICY "update_home_slides_super" ON home_slides FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));
DROP POLICY IF EXISTS "delete_home_slides_super" ON home_slides;
CREATE POLICY "delete_home_slides_super" ON home_slides FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

DROP POLICY IF EXISTS "insert_media_items_super" ON media_items;
CREATE POLICY "insert_media_items_super" ON media_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));
DROP POLICY IF EXISTS "update_media_items_super" ON media_items;
CREATE POLICY "update_media_items_super" ON media_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));
DROP POLICY IF EXISTS "delete_media_items_super" ON media_items;
CREATE POLICY "delete_media_items_super" ON media_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

-- Events: super admin can hide/show or remove any event
DROP POLICY IF EXISTS "update_events_super" ON events;
CREATE POLICY "update_events_super" ON events FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));
DROP POLICY IF EXISTS "delete_events_super" ON events;
CREATE POLICY "delete_events_super" ON events FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

-- ============ SEED DATA (only when empty) ============

INSERT INTO home_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

INSERT INTO home_slides (title, subtitle, image_url, link_page, sort_order, is_active)
SELECT * FROM (VALUES
  ('Welcome to Unilink', 'Connect beyond your campus', 'https://images.pexels.com/photos/39894311/pexels-photo-39894311.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'events', 1, true),
  ('Discover events and opportunities', 'Find what is happening across colleges', 'https://images.pexels.com/photos/26926327/pexels-photo-26926327.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'events', 2, true),
  ('See campus life in pictures', 'Browse the community gallery', 'https://images.pexels.com/photos/31665026/pexels-photo-31665026.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'gallery', 3, true)
) AS v(title, subtitle, image_url, link_page, sort_order, is_active)
WHERE NOT EXISTS (SELECT 1 FROM home_slides);

INSERT INTO media_items (media_type, title, description, url, thumbnail_url, category, author, width, height, show_on_home, sort_order)
SELECT * FROM (VALUES
  ('image', 'Tian Shan Mountains', 'Beautiful view of the Tian Shan mountains in Xinjiang, China, under a bright blue sky.', 'https://images.pexels.com/photos/39894311/pexels-photo-39894311.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/39894311/pexels-photo-39894311.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nature', 'Lywin', 940, 650, true, 1),
  ('image', 'Machapuchare Peak', 'Beautiful view of Machapuchare mountain in Nepal''s Himalayas blanketed by clouds.', 'https://images.pexels.com/photos/26926327/pexels-photo-26926327.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/26926327/pexels-photo-26926327.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nature', 'Razone Gn', 940, 650, true, 2),
  ('image', 'Dolomites at Toblach', 'Breathtaking beauty of the Dolomites in Toblach with this stunning mountain landscape.', 'https://images.pexels.com/photos/31665026/pexels-photo-31665026.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/31665026/pexels-photo-31665026.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nature', 'Joerg Hartmann', 940, 650, true, 3),
  ('image', 'Mountain Range at Sunset', 'Stunning view of a mountain range at sunset with dramatic lighting and rocky terrain.', 'https://images.pexels.com/photos/675257/pexels-photo-675257.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/675257/pexels-photo-675257.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nature', 'eberhard grossgasteiger', 940, 650, true, 4),
  ('image', 'Silhouette Mountains Sunset', 'Stunning silhouette of mountains during a vibrant sunset with warm orange hues.', 'https://images.pexels.com/photos/6915292/pexels-photo-6915292.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/6915292/pexels-photo-6915292.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nature', 'Henrik Pfitzenmaier', 940, 650, true, 5),
  ('image', 'Snowcapped Range', 'A breathtaking view of a snowcapped mountain range under a cloudy sky.', 'https://images.pexels.com/photos/15215323/pexels-photo-15215323.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/15215323/pexels-photo-15215323.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nature', 'Marko Obrvan', 940, 650, true, 6),
  ('image', 'Dresden Old Town', 'Historic street view of Dresden''s charming architecture under a pastel sky.', 'https://images.pexels.com/photos/37718865/pexels-photo-37718865.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/37718865/pexels-photo-37718865.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Urban', 'Memory Lane', 940, 650, true, 7),
  ('image', 'Historic Alleyway', 'Empty alleyway flanked by historic buildings under a clear blue sky.', 'https://images.pexels.com/photos/18596360/pexels-photo-18596360.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/18596360/pexels-photo-18596360.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Urban', 'Matteo Angeloni', 940, 650, true, 8),
  ('image', 'Narrow Urban Pass', 'View of tall urban buildings in narrow alleyway with overcast sky.', 'https://images.pexels.com/photos/30926243/pexels-photo-30926243.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/30926243/pexels-photo-30926243.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Urban', 'Jerm Gonzalo', 940, 650, true, 9),
  ('image', 'Brussels at Sunset', 'Classic European architecture in Brussels city at sunset.', 'https://images.pexels.com/photos/27092877/pexels-photo-27092877.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/27092877/pexels-photo-27092877.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Urban', 'Dario Rawert', 940, 650, true, 10),
  ('video', 'Aerial Coastline', 'Aerial drone footage of a stunning coastline with crystal clear waters.', 'https://cdn.coverr.co/videos/coverr-aerial-view-of-the-coast-2633/1080p.mp4', 'https://images.pexels.com/photos/34448034/pexels-photo-34448034.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Aerial', 'Coverr', 1920, 1080, true, 11),
  ('video', 'Mountain Peak Clouds', 'Stunning view of a cloudy mountain peak captured in dramatic lighting.', 'https://cdn.coverr.co/videos/coverr-clouds-over-a-mountain-1573/1080p.mp4', 'https://images.pexels.com/photos/11847657/pexels-photo-11847657.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nature', 'Coverr', 1920, 1080, true, 12),
  ('video', 'Alpine Landscapes', 'Majestic alpine mountains with snow peaks under a clear blue sky.', 'https://cdn.coverr.co/videos/coverr-a-mountain-with-snow-on-top-2631/1080p.mp4', 'https://images.pexels.com/photos/34448034/pexels-photo-34448034.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nature', 'Coverr', 1920, 1080, true, 13)
) AS v(media_type, title, description, url, thumbnail_url, category, author, width, height, show_on_home, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM media_items);
