// Approving or rejecting "I study at this college" requests.
//   website admins   : any college
//   college officers : only requests for their own college, and not their own request
// (the generic /api/rest endpoint can only be used by admins for this, see policies.js)
import { db } from './db.js';
import { ensureLobby } from './defaultRooms.js';
import { HttpError } from './rest.js';
import { canVerifyStudents, isAdminUser } from './policies.js';

export function resolveVerification(user, body) {
  const status = body.status;
  if (status !== 'approved' && status !== 'rejected') throw new HttpError('Choose approve or reject');
  const v = db.prepare('SELECT * FROM verifications WHERE id = ?').get(String(body.id ?? ''));
  if (!v) throw new HttpError('Request not found', 404);
  if (v.status !== 'pending') throw new HttpError('This request was already handled', 409);

  if (!isAdminUser(user)) {
    if (!canVerifyStudents({ user })) throw new HttpError('Only admins and college officers can verify students', 403);
    if (v.college_id !== user.college_id) throw new HttpError('You can only verify students of your own college', 403);
    if (v.user_id === user.id) throw new HttpError('You cannot verify yourself', 403);
  }

  db.exec('BEGIN');
  try {
    db.prepare('UPDATE verifications SET status = ?, verified_by = ?, resolved_at = ? WHERE id = ?').run(status, user.id, new Date().toISOString(), v.id);
    if (status === 'approved') db.prepare('UPDATE profiles SET is_verified = 1, college_id = ? WHERE id = ?').run(v.college_id, v.user_id);
    db.exec('COMMIT');
    if (status === 'approved') ensureLobby(v.college_id);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { data: { ok: true } };
}
