// College-level ranks. They are separate from the website-wide role (student / admin / super_admin)
// and only ever apply inside the person's own college, while they are verified there.
// The server enforces the same rules in server/policies.js; this file only decides what to show.
import type { ChatRoom, CollegeRole, Message, Profile } from '@/lib/supabase';

export const COLLEGE_RANK: Record<CollegeRole, number> = {
  member: 0,
  committee_head: 1,
  secretary: 2,
  vice_president: 3,
  president: 4,
};

export const COLLEGE_ROLE_LABEL: Record<CollegeRole, string> = {
  member: 'Member',
  committee_head: 'Committee Head',
  secretary: 'Secretary',
  vice_president: 'Vice President',
  president: 'President',
};

export const COLLEGE_ROLE_HELP: Record<CollegeRole, string> = {
  member: 'Regular student',
  committee_head: 'Can create college rooms and manage the ones they created',
  secretary: 'Can manage every college room and its messages',
  vice_president: 'Secretary powers, plus assigning ranks below vice president',
  president: 'Everything in their college, including assigning ranks',
};

type Who = Pick<Profile, 'id' | 'role' | 'college_id' | 'is_verified' | 'college_role' | 'committee_name'> | null | undefined;

export const isGlobalAdmin = (p: Who) => p?.role === 'admin' || p?.role === 'super_admin';

/** 0 = no rank. Ranks only count for verified members of a college. */
export function officerLevel(p: Who): number {
  if (!p || !p.college_id || !p.is_verified) return 0;
  return COLLEGE_RANK[p.college_role] ?? 0;
}

/** Any college rank may verify students of their own college (the server enforces this in server/policies.js). */
export const VERIFY_MIN_RANK = COLLEGE_RANK.committee_head;
export const canVerifyStudents = (p: Who) => officerLevel(p) >= VERIFY_MIN_RANK;

/** "President", "Committee Head · Cultural", or null for a plain member. */
export function rankLabel(p: Pick<Profile, 'college_role' | 'committee_name'> | null | undefined): string | null {
  if (!p || !p.college_role || p.college_role === 'member') return null;
  const base = COLLEGE_ROLE_LABEL[p.college_role];
  return p.college_role === 'committee_head' && p.committee_name ? `${base} · ${p.committee_name}` : base;
}

/** Ranks this person may hand out (website admins: all of them; president/VP: only ranks below their own). */
export function assignableRoles(p: Who): CollegeRole[] {
  const all = Object.keys(COLLEGE_RANK) as CollegeRole[];
  if (isGlobalAdmin(p)) return all;
  const level = officerLevel(p);
  if (level < COLLEGE_RANK.vice_president) return [];
  return all.filter((r) => COLLEGE_RANK[r] < level);
}

export function canChangeRankOf(viewer: Who, target: Profile): boolean {
  if (!viewer) return false;
  if (isGlobalAdmin(viewer)) return !!target.college_id;
  const level = officerLevel(viewer);
  return (
    viewer.id !== target.id &&
    level >= COLLEGE_RANK.vice_president &&
    !!target.college_id &&
    target.college_id === viewer.college_id &&
    target.is_verified &&
    COLLEGE_RANK[target.college_role] < level
  );
}

type RoomLike = Pick<ChatRoom, 'room_type' | 'college_id' | 'created_by'>;

/** Edit a room: its creator, or a secretary and above in the room's own college. */
export function canEditRoom(p: Who, room: RoomLike | null): boolean {
  if (!p || !room) return false;
  if (room.created_by === p.id) return true;
  return room.room_type === 'college' && room.college_id === p.college_id && officerLevel(p) >= COLLEGE_RANK.secretary;
}

/** Delete a room: same as editing, and website admins can delete any room. */
export const canDeleteRoom = (p: Who, room: RoomLike | null) => isGlobalAdmin(p) || canEditRoom(p, room);

/** Delete someone else's message. Own messages are handled separately. */
export function canModerateMessage(p: Who, room: RoomLike | null, msg: Pick<Message, 'sender_id'>): boolean {
  if (!p || !room) return false;
  if (msg.sender_id === p.id || isGlobalAdmin(p)) return true;
  if (room.room_type !== 'college' || room.college_id !== p.college_id) return false;
  const level = officerLevel(p);
  if (level >= COLLEGE_RANK.secretary) return true;
  return level >= COLLEGE_RANK.committee_head && room.created_by === p.id;
}
