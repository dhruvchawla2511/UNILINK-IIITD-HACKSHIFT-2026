import { useEffect, useState } from 'react';
import { supabase, type HomeSettings, type MediaRow } from '@/lib/supabase';
import type { MediaItem } from '@/data/images';
import { allMedia } from '@/data';

export const defaultHomeSettings: HomeSettings = {
  id: 1,
  hero_title: 'Welcome to Unilink',
  hero_subtitle: 'Connect Beyond Campus',
  show_slideshow: true,
  show_events: true,
  show_images: true,
  show_videos: true,
  events_count: 6,
};

export function rowToMedia(r: MediaRow): MediaItem {
  return {
    id: r.id,
    type: r.media_type,
    title: r.title,
    description: r.description,
    url: r.url,
    thumbnailUrl: r.thumbnail_url || (r.media_type === 'image' ? r.url : ''),
    category: r.category,
    author: r.author,
    width: r.width,
    height: r.height,
  };
}

export async function fetchMediaRows(): Promise<{ rows: MediaRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('media_items')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  return { rows: (data as MediaRow[]) ?? [], error: error?.message ?? null };
}

/** Gallery media from the database. Falls back to built-in samples if the table is not set up yet. */
export function useMediaItems() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingSamples, setUsingSamples] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchMediaRows().then(({ rows, error }) => {
      if (!alive) return;
      if (error) {
        setItems(allMedia);
        setUsingSamples(true);
      } else {
        setItems(rows.map(rowToMedia));
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  return { items, loading, usingSamples };
}
