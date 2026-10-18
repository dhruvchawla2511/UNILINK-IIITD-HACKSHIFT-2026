// Who has how much authority in a chat room. No imports, so any server file can use it without a circular import.
//
//   Website owner        102   Website super admin  101   Website admin  100   President 4 / Vice president 3 / Secretary 2 (own college, verified)
//   Room owner (private room) 2   Room creator 1   Everyone else 0
export const COLLEGE_RANK = { member: 0, committee_head: 1, secretary: 2, vice_president: 3, president: 4 };

/** How much authority this person has in this room. 0 = none. `u` needs role, id, college_id, is_verified, college_role. */
export function powerIn(u, room) {
  if (u.is_owner) return 102;
  if (u.role === 'super_admin') return 101;
  if (u.role === 'admin') return 100;
  if (room.dm_key) return 0; // a direct message has no owner and no moderators (reports reach website admins above)
  if (room.room_type === 'global') return 0; // only website admins moderate global rooms
  if (room.room_type === 'private') return room.created_by === u.id ? 2 : 0;
  // college room: ranks only count for verified members of that same college
  if (!u.is_verified || !u.college_id || u.college_id !== room.college_id) return 0;
  const rank = COLLEGE_RANK[u.college_role] ?? 0;
  let p = rank >= COLLEGE_RANK.secretary ? rank : 0;
  if (room.created_by === u.id) p = Math.max(p, 1);
  return p;
}

/** "Officers" for /lock and /slowmode: anyone with moderation power here, plus every verified college officer
 *  (committee heads included) of the room's own college. */
export function isOfficerIn(u, room) {
  if (powerIn(u, room) >= 1) return true;
  return room.room_type === 'college' && !!u.is_verified && u.college_id === room.college_id && (COLLEGE_RANK[u.college_role] ?? 0) >= COLLEGE_RANK.committee_head;
}
