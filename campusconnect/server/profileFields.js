// Extra profile details. The super admin defines the fields (profile_fields, edited through the normal
// data API); people fill in their own values here. Values are only ever read or written through these
// two functions, so the visibility rule ("everyone" or "admins only") cannot be bypassed.
import { db } from './db.js';
import { HttpError } from './rest.js';
import { normalizeOptions } from './policies.js';

const isAdmin = (user) => user.role === 'admin' || user.role === 'super_admin';

function cleanValue(field, raw, previous) {
  const v = String(raw ?? '').trim();
  if (!v) return '';
  const name = field.label;
  switch (field.field_type) {
    case 'text':
      if (v.length > 100) throw new HttpError(`${name} is too long (100 characters max)`);
      return v;
    case 'textarea':
      if (v.length > 500) throw new HttpError(`${name} is too long (500 characters max)`);
      return v;
    case 'number':
      if (!/^-?\d+(\.\d+)?$/.test(v) || v.length > 15) throw new HttpError(`${name} must be a number`);
      return v;
    case 'phone':
      if (!/^\+?[\d\s()-]{7,20}$/.test(v) || v.replace(/\D/g, '').length < 7 || v.replace(/\D/g, '').length > 15) throw new HttpError(`${name} must be a valid phone number`);
      return v;
    case 'date':
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw new HttpError(`${name} must be a valid date`);
      return v;
    case 'select':
      // a value whose choice was later removed by the super admin may stay as it is
      if (!normalizeOptions(field.options).includes(v) && v !== previous) throw new HttpError(`Choose one of the listed options for ${name}`);
      return v;
    default:
      throw new HttpError('Unknown field type');
  }
}

/** The profile fields one person may see for `body.user_id` (default: yourself), with their values. */
export function getProfileFields(user, body) {
  const target = String(body.user_id || user.id);
  if (!db.prepare('SELECT 1 FROM profiles WHERE id = ?').get(target)) throw new HttpError('Person not found', 404);
  const seeAll = target === user.id || isAdmin(user);
  const values = new Map(db.prepare('SELECT field_id, value FROM profile_values WHERE user_id = ?').all(target).map((r) => [r.field_id, r.value]));
  const fields = db.prepare('SELECT * FROM profile_fields ORDER BY sort_order, created_at').all();
  return {
    data: fields
      .filter((f) => seeAll || f.visibility === 'everyone')
      .map((f) => ({
        id: f.id,
        label: f.label,
        field_type: f.field_type,
        options: normalizeOptions(f.options),
        required: !!f.required,
        private: f.visibility === 'admins',
        value: values.get(f.id) ?? '',
      })),
  };
}

/** Saves the signed-in person's own values: { values: { <fieldId>: "text" } }. Empty text clears a value. */
export function saveProfileFields(user, body) {
  const submitted = body.values && typeof body.values === 'object' ? body.values : {};
  const fields = db.prepare('SELECT * FROM profile_fields').all();
  const byId = new Map(fields.map((f) => [f.id, f]));
  const current = new Map(db.prepare('SELECT field_id, value FROM profile_values WHERE user_id = ?').all(user.id).map((r) => [r.field_id, r.value]));

  const next = new Map(current);
  for (const [id, raw] of Object.entries(submitted)) {
    const field = byId.get(id);
    if (!field) continue; // the field was deleted in the meantime
    const v = cleanValue(field, raw, current.get(id));
    if (v) next.set(id, v);
    else next.delete(id);
  }
  for (const f of fields) if (f.required && !next.has(f.id)) throw new HttpError(`${f.label} is required`);

  db.exec('BEGIN');
  try {
    for (const id of Object.keys(submitted)) {
      if (!byId.has(id)) continue;
      if (next.has(id)) {
        db.prepare(
          `INSERT INTO profile_values (user_id, field_id, value) VALUES (?, ?, ?)
           ON CONFLICT (user_id, field_id) DO UPDATE SET value = excluded.value, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
        ).run(user.id, id, next.get(id));
      } else {
        db.prepare('DELETE FROM profile_values WHERE user_id = ? AND field_id = ?').run(user.id, id);
      }
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { data: { ok: true } };
}
