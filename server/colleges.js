// Colleges: approving "my college is not listed" requests, importing many colleges at once (CSV),
// and college logos. Every action here is for website admins only; the checks are made on the server.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { HttpError } from './rest.js';
import { checkCollege, COLLEGE_TIERS, isAdminUser } from './policies.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LOGO_DIR = process.env.CAMPUSCONNECT_LOGOS
  ? path.resolve(process.env.CAMPUSCONNECT_LOGOS)
  : path.join(root, 'database', 'logos');
fs.mkdirSync(LOGO_DIR, { recursive: true });

const ID_RE = /^[0-9a-f-]{36}$/;
const MAX_IMPORT_ROWS = 2000;
export const MAX_LOGO_KB = 512;
const FIELDS = ['name', 'domain', 'city', 'state', 'country', 'tier', 'description', 'logo_url'];

function requireAdmin(user) {
  if (!isAdminUser(user)) throw new HttpError('Only admins can do that', 403);
}
const findByName = (name) => db.prepare('SELECT * FROM colleges WHERE lower(name) = lower(?)').get(name);

// "tier 1", "1", "T1" and "elite" all become the stored tier names. Anything else is left for checkCollege to reject.
function normalizeTier(raw) {
  const v = String(raw ?? '').trim();
  if (!v) return '';
  const k = v.toLowerCase().replace(/[\s_-]+/g, '');
  if (['1', 't1', 'tier1'].includes(k)) return 'Tier 1';
  if (['2', 't2', 'tier2'].includes(k)) return 'Tier 2';
  if (k === 'elite') return 'Elite';
  return COLLEGE_TIERS.find((t) => t.toLowerCase() === v.toLowerCase()) ?? v;
}

// ---------------------------------------------------------------- requests

/**
 * Approve or reject a request. Approving adds the college (the admin may fix the details first),
 * or links the request to the college if one with that name has been added since.
 * body: { id, status: 'approved' | 'rejected', ...optional corrected name/city/state/country/domain/tier/description }
 */
export function resolveCollegeRequest(user, body) {
  requireAdmin(user);
  const status = body.status;
  if (status !== 'approved' && status !== 'rejected') throw new HttpError('Choose approve or reject');
  const reqRow = db.prepare('SELECT * FROM college_requests WHERE id = ?').get(String(body.id ?? ''));
  if (!reqRow) throw new HttpError('Request not found', 404);
  if (reqRow.status !== 'pending') throw new HttpError('This request was already handled', 409);
  const now = new Date().toISOString();

  if (status === 'rejected') {
    db.prepare('UPDATE college_requests SET status = ?, resolved_by = ?, resolved_at = ? WHERE id = ?').run('rejected', user.id, now, reqRow.id);
    return { data: { ok: true } };
  }

  const data = {};
  for (const k of ['name', 'domain', 'city', 'state', 'country', 'description']) data[k] = k in body ? body[k] : reqRow[k];
  data.tier = normalizeTier(body.tier);
  const err = checkCollege(data, true);
  if (err) throw new HttpError(err);

  let collegeId;
  let created = false;
  db.exec('BEGIN');
  try {
    const existing = findByName(data.name);
    if (existing) collegeId = existing.id;
    else {
      collegeId = crypto.randomUUID();
      db.prepare('INSERT INTO colleges (id, name, domain, city, state, country, tier, description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(collegeId, data.name, data.domain, data.city, data.state, data.country, data.tier, data.description, user.id);
      created = true;
    }
    db.prepare('UPDATE college_requests SET status = ?, college_id = ?, resolved_by = ?, resolved_at = ? WHERE id = ?').run('approved', collegeId, user.id, now, reqRow.id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { data: { ok: true, college_id: collegeId, created } };
}

// ---------------------------------------------------------------- CSV import

/**
 * body: { rows: [{ name, domain, city, state, country, tier, description, logo_url }], dry_run?: boolean }
 * Rows with a name that already exists (or that repeats earlier in the file) are skipped. Rows with a problem are
 * reported with their row number and are not added; the other rows still are. With dry_run nothing is saved.
 * The browser reads the CSV file; the checks here are the ones that count.
 */
export function importColleges(user, body) {
  requireAdmin(user);
  const rows = body.rows;
  if (!Array.isArray(rows) || rows.length === 0) throw new HttpError('The file has no colleges in it');
  if (rows.length > MAX_IMPORT_ROWS) throw new HttpError(`Too many rows (${MAX_IMPORT_ROWS} at most per import). Split the file`);

  const seen = new Set(db.prepare('SELECT lower(name) AS n FROM colleges').all().map((r) => r.n));
  const toAdd = [];
  const errors = [];
  let duplicates = 0;

  rows.forEach((raw, i) => {
    const rowNo = i + 2; // row 1 of the file is the header
    const data = {};
    for (const k of FIELDS) data[k] = raw && typeof raw === 'object' ? String(raw[k] ?? '') : '';
    data.tier = normalizeTier(data.tier);
    const err = checkCollege(data, true);
    if (err) return errors.push({ row: rowNo, name: data.name || '', message: err });
    const key = data.name.toLowerCase();
    if (seen.has(key)) return duplicates++;
    seen.add(key);
    toAdd.push(data);
  });

  if (!body.dry_run && toAdd.length) {
    const add = db.prepare('INSERT INTO colleges (id, name, domain, city, state, country, tier, description, logo_url, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    db.exec('BEGIN');
    try {
      for (const d of toAdd) add.run(crypto.randomUUID(), d.name, d.domain, d.city, d.state, d.country, d.tier, d.description, d.logo_url, user.id);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  return { data: { added: toAdd.length, duplicates, errors: errors.slice(0, 50), error_count: errors.length, dry_run: !!body.dry_run } };
}

// ---------------------------------------------------------------- logos

// Pictures only, and the type is read from the file's first bytes, not from what the browser says.
// SVG is not accepted (it can contain scripts).
function sniffImage(buf) {
  if (buf.length > 12 && buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG') return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 6 && buf.toString('latin1', 0, 4) === 'GIF8') return 'image/gif';
  if (buf.length > 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}
const logoPath = (collegeId) => path.join(LOGO_DIR, collegeId);

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (declared > maxBytes) return reject(new HttpError(`The picture is too large (${MAX_LOGO_KB} KB at most)`, 413));
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) {
        reject(new HttpError(`The picture is too large (${MAX_LOGO_KB} KB at most)`, 413));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** POST /api/colleges/logo?college_id=...  with the picture as the request body. */
export async function saveLogo(req, user, collegeId) {
  requireAdmin(user);
  if (!ID_RE.test(collegeId) || !db.prepare('SELECT 1 FROM colleges WHERE id = ?').get(collegeId)) throw new HttpError('College not found', 404);
  const buf = await readBody(req, MAX_LOGO_KB * 1024);
  if (!buf.length) throw new HttpError('The picture is empty');
  if (!sniffImage(buf)) throw new HttpError('Use a PNG, JPG, GIF or WebP picture');
  fs.writeFileSync(logoPath(collegeId), buf);
  const url = `/api/college-logos/${collegeId}?v=${Date.now()}`;
  db.prepare('UPDATE colleges SET logo_url = ? WHERE id = ?').run(url, collegeId);
  return { data: { logo_url: url } };
}

/** Removes the logo of a college, whether it was uploaded or is a link. */
export function removeLogo(user, body) {
  requireAdmin(user);
  const id = String(body.college_id ?? '');
  if (!ID_RE.test(id) || !db.prepare('SELECT 1 FROM colleges WHERE id = ?').get(id)) throw new HttpError('College not found', 404);
  removeLogoFile(id);
  db.prepare('UPDATE colleges SET logo_url = NULL WHERE id = ?').run(id);
  return { data: { ok: true } };
}

/** Deletes the stored picture (used when a college is deleted). Safe to call when there is none. */
export function removeLogoFile(collegeId) {
  if (!ID_RE.test(String(collegeId))) return;
  try {
    fs.rmSync(logoPath(collegeId), { force: true });
  } catch {
    /* nothing to clean up */
  }
}

/** GET /api/college-logos/<id>. Logos are part of the public directory, so <img> can load them without a token. */
export function sendLogo(res, collegeId) {
  if (!ID_RE.test(collegeId) || !fs.existsSync(logoPath(collegeId))) throw new HttpError('Not found', 404);
  const buf = fs.readFileSync(logoPath(collegeId));
  const mime = sniffImage(buf);
  if (!mime) throw new HttpError('Not found', 404);
  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': buf.length,
    'Cache-Control': 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; img-src 'self'",
  });
  res.end(buf);
}
