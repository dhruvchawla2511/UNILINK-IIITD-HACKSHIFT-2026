// Chat file uploads. Files are stored in database/uploads/<id> (no extension, so nothing on disk can be
// executed or guessed), and the `uploads` table remembers the name, type and owner.
// Downloads go through GET /api/files/<id>, which checks that the person may see the room the file was sent in.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { HttpError } from './rest.js';
import { visibleRoomSql } from './policies.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const UPLOAD_DIR = process.env.CAMPUSCONNECT_UPLOADS
  ? path.resolve(process.env.CAMPUSCONNECT_UPLOADS)
  : path.join(root, 'database', 'uploads');
export const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 50;
const MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// extension -> [kind, mime]. Anything else is stored as a plain downloadable file.
const KNOWN = {
  jpg: ['image', 'image/jpeg'], jpeg: ['image', 'image/jpeg'], png: ['image', 'image/png'],
  gif: ['image', 'image/gif'], webp: ['image', 'image/webp'], avif: ['image', 'image/avif'],
  mp4: ['video', 'video/mp4'], m4v: ['video', 'video/mp4'], webm: ['video', 'video/webm'],
  ogv: ['video', 'video/ogg'], mov: ['video', 'video/quicktime'],
  mp3: ['audio', 'audio/mpeg'], wav: ['audio', 'audio/wav'], ogg: ['audio', 'audio/ogg'],
  m4a: ['audio', 'audio/mp4'], aac: ['audio', 'audio/aac'],
  pdf: ['file', 'application/pdf'],
};
// Programs and scripts are not allowed to be shared.
const BLOCKED = new Set(['exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'vbs', 'vbe', 'ps1', 'sh', 'dll', 'jar', 'apk', 'app', 'pif', 'lnk', 'reg']);
// Shown in the browser instead of downloaded.
const INLINE_KINDS = new Set(['image', 'video', 'audio']);

const ID_RE = /^[0-9a-f-]{36}$/;
export const fileIdFromUrl = (url) => {
  const m = /^\/api\/files\/([0-9a-f-]{36})$/.exec(String(url || ''));
  return m ? m[1] : null;
};
const filePath = (id) => path.join(UPLOAD_DIR, id);

function cleanName(raw) {
  let name = String(raw || 'file');
  try {
    name = decodeURIComponent(name);
  } catch {
    /* keep as is */
  }
  name = path.basename(name.replace(/\\/g, '/')).replace(/[\u0000-\u001f<>:"|?*]/g, '').trim();
  if (name.length > 120) {
    const ext = path.extname(name).slice(0, 12);
    name = name.slice(0, 120 - ext.length) + ext;
  }
  return name || 'file';
}

/** Saves the request body as a new upload owned by `user`. */
export async function saveUpload(req, user) {
  const name = cleanName(req.headers['x-file-name']);
  const ext = path.extname(name).slice(1).toLowerCase();
  if (BLOCKED.has(ext)) throw new HttpError('This file type is not allowed');

  const declared = Number(req.headers['content-length']);
  if (!declared) throw new HttpError('The file is empty');
  if (declared > MAX_BYTES) throw new HttpError(`File is too large (limit ${MAX_UPLOAD_MB} MB)`, 413);

  const [kind, mime] = KNOWN[ext] ?? ['file', 'application/octet-stream'];
  const id = crypto.randomUUID();
  const tmp = filePath(`${id}.part`);

  let size = 0;
  const counter = new Transform({
    transform(chunk, _enc, cb) {
      size += chunk.length;
      if (size > MAX_BYTES) return cb(new HttpError(`File is too large (limit ${MAX_UPLOAD_MB} MB)`, 413));
      cb(null, chunk);
    },
  });

  try {
    await pipeline(req, counter, fs.createWriteStream(tmp));
    if (size === 0) throw new HttpError('The file is empty');
    fs.renameSync(tmp, filePath(id));
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }

  db.prepare('INSERT INTO uploads (id, user_id, original_name, mime, kind, size) VALUES (?, ?, ?, ?, ?, ?)').run(id, user.id, name, mime, kind, size);
  return { id, url: `/api/files/${id}`, name, mime, kind, size };
}

function mayRead(user, row) {
  if (row.user_id === user.id) return true;
  if (db.prepare('SELECT 1 FROM campus_shared_uploads WHERE upload_id = ?').get(row.id)) return true;
  // Team files are visible only to the project owner and accepted members.
  if (db.prepare(`SELECT 1 FROM collaboration_files f JOIN collaboration_projects p ON p.id=f.project_id LEFT JOIN collaboration_members m ON m.project_id=p.id AND m.user_id=? AND m.status='accepted' WHERE f.upload_id=? AND (p.owner_id=? OR m.user_id=?)`).get(user.id, row.id, user.id, user.id)) return true;
  const msg = db.prepare('SELECT room_id FROM messages WHERE attachment_url = ?').get(`/api/files/${row.id}`);
  if (!msg) return false;
  const [sql, params] = visibleRoomSql({ user });
  return !!db.prepare(`SELECT 1 FROM chat_rooms WHERE id = ? AND ${sql}`).get(msg.room_id, ...params);
}

/** Streams a stored file (with Range support so videos can be skipped through). */
export function sendFile(req, res, user, id, { download = false } = {}) {
  if (!ID_RE.test(id)) throw new HttpError('Not found', 404);
  const row = db.prepare('SELECT * FROM uploads WHERE id = ?').get(id);
  if (!row || !mayRead(user, row) || !fs.existsSync(filePath(id))) throw new HttpError('File not found', 404);

  const total = fs.statSync(filePath(id)).size;
  let start = 0;
  let end = total - 1;
  let status = 200;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range && (range[1] || range[2])) {
    if (range[1]) {
      start = Number(range[1]);
      if (range[2]) end = Math.min(Number(range[2]), total - 1);
    } else {
      start = Math.max(0, total - Number(range[2])); // "last N bytes"
    }
    if (start > end || start >= total) {
      res.writeHead(416, { 'Content-Range': `bytes */${total}` });
      return res.end();
    }
    status = 206;
  }

  const inline = !download && (INLINE_KINDS.has(row.kind) || row.mime === 'application/pdf');
  const headers = {
    'Content-Type': row.mime,
    'Content-Length': end - start + 1,
    'Accept-Ranges': 'bytes',
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(row.original_name)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=3600',
  };
  if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${total}`;
  res.writeHead(status, headers);
  fs.createReadStream(filePath(id), { start, end }).pipe(res);
}

/** Deletes the file and its record (used when a message or room is deleted). */
export function removeUpload(id) {
  if (!id || !ID_RE.test(id)) return;
  fs.rmSync(filePath(id), { force: true });
  db.prepare('DELETE FROM uploads WHERE id = ?').run(id);
}
export const removeUploadByUrl = (url) => removeUpload(fileIdFromUrl(url));

/** At startup: forget uploads that were never sent in a message (older than a day) and stray files. */
export function sweepUploads() {
  const cutoff = new Date(Date.now() - 86400_000).toISOString();
  for (const { id } of db.prepare('SELECT id FROM uploads WHERE created_at < ?').all(cutoff)) {
    if (!db.prepare('SELECT 1 FROM messages WHERE attachment_url = ?').get(`/api/files/${id}`) && !db.prepare('SELECT 1 FROM campus_shared_uploads WHERE upload_id = ?').get(id)) removeUpload(id);
  }
  for (const f of fs.readdirSync(UPLOAD_DIR)) {
    const full = path.join(UPLOAD_DIR, f);
    const old = Date.now() - fs.statSync(full).mtimeMs > 3600_000;
    if (f.endsWith('.part') ? old : ID_RE.test(f) && !db.prepare('SELECT 1 FROM uploads WHERE id = ?').get(f) && old) fs.rmSync(full, { force: true });
  }
}
