// Direct messages (1-on-1 chats). The server side is server/dm.js.
import { apiPost } from '@/lib/supabase';
import { rankLabel } from '@/lib/collegeRoles';
import type { CollegeRole, Role } from '@/lib/supabase';

/** The other person in a conversation, or someone you can start one with. Never includes an email address. */
export interface DmPerson {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: Role;
  is_owner?: boolean;
  is_verified: boolean;
  college_role: CollegeRole;
  committee_name: string | null;
  college_name: string | null;
}

export interface Conversation {
  room_id: string;
  peer: DmPerson;
  last: { preview: string; from_me: boolean; created_at: string } | null;
  activity_at: string;
  unread: number;
  /** true when YOU blocked this person (you are never told if they blocked you) */
  blocked_by_me: boolean;
}

export const dmApi = {
  start: (userId: string) => apiPost<{ room_id: string }>('/api/chat/dm/start', { user_id: userId }),
  list: () => apiPost<Conversation[]>('/api/chat/dm/list', {}),
  unread: () => apiPost<{ total: number; rooms: Record<string, number> }>('/api/chat/dm/unread', {}),
  seen: (roomId: string) => apiPost<{ ok: boolean }>('/api/chat/dm/seen', { room_id: roomId }),
  remove: (roomId: string) => apiPost<{ ok: boolean }>('/api/chat/dm/delete', { room_id: roomId }),
  block: (userId: string) => apiPost<{ ok: boolean }>('/api/chat/dm/block', { user_id: userId }),
  unblock: (userId: string) => apiPost<{ ok: boolean }>('/api/chat/dm/unblock', { user_id: userId }),
  people: (q: string) => apiPost<{ suggested: boolean; people: DmPerson[] }>('/api/chat/dm/people', { q }),
};

/** "Admin", "President", "Verified student" ... */
export function personLabel(p: DmPerson): string {
  if (p.is_owner) return 'Owner';
  if (p.role === 'super_admin') return 'Super Admin';
  if (p.role === 'admin') return 'Admin';
  return rankLabel(p) ?? (p.is_verified ? 'Verified student' : 'Student');
}

export const isSiteAdmin = (p: Pick<DmPerson, 'role'>) => p.role === 'admin' || p.role === 'super_admin';

/** Time for the conversation list: the hour today, otherwise the date. */
export function listTime(ts: string): string {
  const d = new Date(ts);
  if (d.toDateString() === new Date().toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}
