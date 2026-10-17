// Custom profile badges. One shared cache for the whole app: any component that shows a person's name can call
// useUserBadges(userId); ids are looked up in batches and the cache refreshes itself when badges change
// (awarded, removed, edited or deleted), so badges update live without a page reload.
import { useEffect, useSyncExternalStore } from 'react';
import { apiPost, supabase } from '@/lib/supabase';

export interface Badge {
  id: string;
  label: string;
  color: string;
  icon: string;
  description: string;
  officers_can_award: boolean;
  sort_order: number;
}

export const BADGE_COLORS = ['slate', 'blue', 'emerald', 'amber', 'rose', 'violet', 'sky'] as const;
export const BADGE_ICONS = ['badge-check', 'graduation-cap', 'star', 'book-open', 'shield', 'sparkles', 'crown', 'heart', 'flag', 'users'] as const;

const defs = new Map<string, Badge>();
const held = new Map<string, string[]>(); // user id -> badge ids (display order)
const wanted = new Set<string>();
const queued = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let defsLoaded = false;

const emit = () => {
  version += 1;
  listeners.forEach((l) => l());
};

async function loadDefs() {
  const { data } = await apiPost<Badge[]>('/api/badges/list', {});
  if (!data) return;
  defs.clear();
  data.forEach((b) => defs.set(b.id, b));
  defsLoaded = true;
}

async function loadUsers(ids: string[]) {
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data } = await apiPost<{ users: Record<string, string[]> }>('/api/badges/lookup', { user_ids: chunk });
    if (data) for (const [id, list] of Object.entries(data.users)) held.set(id, list);
  }
}

function flush() {
  flushTimer = null;
  const ids = [...queued];
  queued.clear();
  if (!ids.length) return;
  Promise.all([defsLoaded ? null : loadDefs(), loadUsers(ids)]).then(emit);
}

function request(userId: string) {
  wanted.add(userId);
  if (held.has(userId) || queued.has(userId)) return;
  queued.add(userId);
  if (!flushTimer) flushTimer = setTimeout(flush, 25);
}

/** Re-reads everything currently on screen. Called when the server says any badge changed. */
async function refreshAll() {
  await Promise.all([loadDefs(), loadUsers([...wanted])]);
  emit();
}

function start() {
  if (started) return;
  started = true;
  supabase.channel('badges').on('postgres_changes', { event: '*', schema: 'public', table: 'user_badges' }, () => { void refreshAll(); }).subscribe();
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
};
const getVersion = () => version;

/** The badges a person currently holds, in display order. Empty until loaded. */
export function useUserBadges(userId: string | null | undefined): Badge[] {
  useSyncExternalStore(subscribe, getVersion);
  useEffect(() => {
    if (!userId) return;
    start();
    request(userId);
  }, [userId]);
  if (!userId) return [];
  return (held.get(userId) ?? []).map((id) => defs.get(id)).filter((b): b is Badge => !!b);
}

/** Forces a refresh after this browser changes badges (the live event covers everyone else). */
export const refreshBadges = () => refreshAll();
