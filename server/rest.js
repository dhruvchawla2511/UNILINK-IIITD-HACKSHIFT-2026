// A small query engine that understands the request shape sent by src/lib/supabase.ts
// (the same chainable API the app already used: from().select().eq().order()...).
import crypto from 'node:crypto';
import { db, tables } from './db.js';
import { policies } from './policies.js';
import { removeUploadByUrl } from './uploads.js';
import { removeLogoFile } from './colleges.js';
import { ensureLobby } from './defaultRooms.js';
import { notifyMentions } from './mentions.js';

export class HttpError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const FILTER_OPS = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'LIKE', ilike: 'LIKE' };
const q = (id) => `"${id}"`;

function tableInfo(name) {
  const info = tables[name];
  if (!info || !policies[name] || name === 'users' || name === 'sessions') throw new HttpError(`Unknown table "${name}"`, 404);
  return info;
}
function col(info, name) {
  if (!info.columns.has(name)) throw new HttpError(`Unknown column "${name}"`);
  return q(name);
}

// SQLite -> JSON: 0/1 -> boolean for BOOLEAN columns
function outRow(info, row) {
  const o = { ...row };
  for (const b of info.booleans) if (b in o && o[b] !== null) o[b] = !!o[b];
  return o;
}
// JSON -> SQLite: booleans -> 0/1, objects -> not allowed
function inValue(v) {
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === undefined) return null;
  if (v !== null && typeof v === 'object') throw new HttpError('Nested values are not supported');
  return v;
}

// "*, college:colleges(*), sender:profiles!sender_id(*)"  ->  { embeds: [{alias, table, hint, cols}] }
function parseSelect(sel = '*') {
  const embeds = [];
  const rest = sel.replace(/(\w+):(\w+)(?:!(\w+))?\(([^)]*)\)/g, (_, alias, table, hint, cols) => {
    embeds.push({ alias, table, hint, cols: cols.trim() });
    return '';
  });
  const cols = rest.split(',').map((s) => s.trim()).filter(Boolean);
  return { cols: cols.length ? cols : ['*'], embeds };
}

function whereClause(info, filters = []) {
  const parts = [];
  const params = [];
  for (const f of filters) {
    const c = col(info, f.col);
    if (f.op === 'in') {
      if (!Array.isArray(f.val) || f.val.length === 0) {
        parts.push('0=1');
        continue;
      }
      parts.push(`${c} IN (${f.val.map(() => '?').join(',')})`);
      params.push(...f.val.map(inValue));
    } else if (f.op === 'is') {
      parts.push(f.val === null ? `${c} IS NULL` : `${c} IS ${f.val ? 'TRUE' : 'FALSE'}`);
    } else if (FILTER_OPS[f.op]) {
      parts.push(`${c} ${FILTER_OPS[f.op]} ?`);
      params.push(inValue(f.val));
    } else throw new HttpError(`Unsupported filter "${f.op}"`);
  }
  return { parts, params };
}

function selectRows(ctx, table, { filters, order, limit, offset }, extraWhere) {
  const info = tableInfo(table);
  const [polSql, polParams] = policies[table].select(ctx);
  const w = whereClause(info, filters);
  const where = [`(${polSql})`, ...w.parts, ...(extraWhere ? [extraWhere[0]] : [])].join(' AND ');
  const params = [...polParams, ...w.params, ...(extraWhere ? extraWhere[1] : [])];
  let sql = `SELECT * FROM ${q(table)} WHERE ${where}`;
  if (order?.length) sql += ' ORDER BY ' + order.map((o) => `${col(info, o.col)} ${o.ascending === false ? 'DESC' : 'ASC'}`).join(', ');
  if (Number.isInteger(limit)) sql += ` LIMIT ${Math.max(0, limit)}`;
  if (Number.isInteger(offset) && offset > 0) sql += `${Number.isInteger(limit) ? '' : ' LIMIT -1'} OFFSET ${offset}`;
  return db.prepare(sql).all(...params).map((r) => redactRow(ctx, table, outRow(info, r)));
}

// Some tables hide certain columns from some readers (policies[table].redact, e.g. profiles.email).
const redactRow = (ctx, table, row) => (policies[table].redact ? policies[table].redact(ctx, row) : row);

function pick(row, cols) {
  if (cols === '*' || !cols) return row;
  const want = cols.split(',').map((s) => s.trim());
  return Object.fromEntries(want.filter((c) => c in row).map((c) => [c, row[c]]));
}

function attachEmbeds(ctx, table, rows, embeds) {
  const info = tableInfo(table);
  for (const e of embeds) {
    // find the foreign key on `table` that points at e.table
    const fk = info.fks.find((f) => f.table === e.table && (!e.hint || f.from === e.hint));
    if (!fk) throw new HttpError(`No relationship between ${table} and ${e.table}`);
    const ids = [...new Set(rows.map((r) => r[fk.from]).filter((v) => v != null))];
    const targets = ids.length
      ? selectRows(ctx, e.table, {}, [`${q(fk.to)} IN (${ids.map(() => '?').join(',')})`, ids])
      : [];
    const byKey = new Map(targets.map((t) => [t[fk.to], t]));
    for (const r of rows) {
      const t = byKey.get(r[fk.from]);
      r[e.alias] = t ? pick(t, e.cols) : null;
    }
  }
  return rows;
}

function newId() {
  return crypto.randomUUID();
}

export function run(ctx, req, broadcast) {
  const { table, op } = req;
  const info = tableInfo(table);
  const policy = policies[table];
  const { cols, embeds } = parseSelect(req.select);
  const wantRows = op === 'select' || req.select !== undefined;

  const finish = (rows, count) => {
    let data = rows.map((r) => redactRow(ctx, table, r));
    if (embeds.length) data = attachEmbeds(ctx, table, data, embeds);
    if (!cols.includes('*')) {
      const keep = cols.join(',');
      data = data.map((r) => ({ ...pick(r, keep), ...Object.fromEntries(embeds.map((e) => [e.alias, r[e.alias]])) }));
    }
    if (req.single === 'single') {
      if (data.length !== 1) throw new HttpError(data.length === 0 ? 'No rows found' : 'Multiple rows returned', 406);
      return { data: data[0], count };
    }
    if (req.single === 'maybeSingle') {
      if (data.length > 1) throw new HttpError('Multiple rows returned', 406);
      return { data: data[0] ?? null, count };
    }
    return { data, count };
  };

  // ---------------- SELECT ----------------
  if (op === 'select') {
    if (req.head) {
      const [polSql, polParams] = policy.select(ctx);
      const w = whereClause(info, req.filters);
      const { n } = db.prepare(`SELECT COUNT(*) AS n FROM ${q(table)} WHERE (${polSql})${w.parts.map((p) => ' AND ' + p).join('')}`).get(...polParams, ...w.params);
      return { data: null, count: n };
    }
    return finish(selectRows(ctx, table, req), undefined);
  }

  // ---------------- INSERT / UPSERT ----------------
  if (op === 'insert' || op === 'upsert') {
    const list = Array.isArray(req.values) ? req.values : [req.values];
    if (!list.length) return { data: [], count: undefined };
    const created = [];
    db.exec('BEGIN');
    try {
      for (const raw of list) {
        const row = { ...raw };
        for (const k of Object.keys(row)) col(info, k);
        for (const d of policy.defaults ?? []) if (row[d] == null) row[d] = ctx.user.id;
        if (info.columns.has('id') && table !== 'home_settings' && row.id == null) row.id = newId();

        let existing = null;
        if (op === 'upsert') {
          const key = req.onConflict || 'id';
          if (row[key] != null) existing = db.prepare(`SELECT * FROM ${q(table)} WHERE ${col(info, key)} = ?`).get(row[key]);
        }
        if (existing) {
          const before = outRow(info, existing);
          const [polSql, polParams] = policy.update(ctx);
          const ok = db.prepare(`SELECT 1 FROM ${q(table)} WHERE id = ? AND (${polSql})`).get(existing.id, ...polParams);
          if (!ok) throw new HttpError('Not allowed', 403);
          const err = policy.canUpdate?.(ctx, before, row);
          if (err) throw new HttpError(err, 403);
          const keys = Object.keys(row).filter((k) => k !== 'id');
          if (keys.length) db.prepare(`UPDATE ${q(table)} SET ${keys.map((k) => `${col(info, k)} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => inValue(row[k])), existing.id);
          created.push(existing.id);
        } else {
          const err = policy.canInsert(ctx, row, db);
          if (err) throw new HttpError(err, 403);
          const keys = Object.keys(row);
          try {
            db.prepare(`INSERT INTO ${q(table)} (${keys.map((k) => col(info, k)).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).run(...keys.map((k) => inValue(row[k])));
          } catch (e) {
            throw translateDbError(e);
          }
          created.push(row.id ?? 1);
        }
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    const idCol = info.columns.has('id') ? 'id' : null;
    const rows = idCol
      ? db.prepare(`SELECT * FROM ${q(table)} WHERE id IN (${created.map(() => '?').join(',')})`).all(...created).map((r) => outRow(info, r))
      : [];
    if (table === 'messages') for (const r of rows) { notifyMentions(r); broadcast({ eventType: 'INSERT', table, new: r, old: {} }); }
    return wantRows ? finish(rows) : { data: null };
  }

  // ---------------- UPDATE / DELETE ----------------
  if (op === 'update' || op === 'delete') {
    const [polSql, polParams] = policy[op](ctx);
    const w = whereClause(info, req.filters);
    const matched = db
      .prepare(`SELECT * FROM ${q(table)} WHERE (${polSql})${w.parts.map((p) => ' AND ' + p).join('')}`)
      .all(...polParams, ...w.params)
      .map((r) => outRow(info, r));
    const key = info.columns.has('id') ? 'id' : null;
    if (!key && matched.length) throw new HttpError('Table has no id column');

    if (op === 'update') {
      const patch = { ...req.values };
      for (const k of Object.keys(patch)) col(info, k);
      for (const m of matched) {
        const err = policy.canUpdate?.(ctx, m, patch);
        if (err) throw new HttpError(err, 403);
      }
      const keys = Object.keys(patch).filter((k) => k !== 'id');
      if (matched.length && keys.length) {
        try {
          db.prepare(`UPDATE ${q(table)} SET ${keys.map((k) => `${col(info, k)} = ?`).join(', ')} WHERE id IN (${matched.map(() => '?').join(',')})`).run(
            ...keys.map((k) => inValue(patch[k])),
            ...matched.map((m) => m.id)
          );
        } catch (e) {
          throw translateDbError(e);
        }
      }
      if (table === 'profiles' && matched.length && keys.includes('college_id')) ensureLobby(patch.college_id);
      const rows = matched.length
        ? db.prepare(`SELECT * FROM ${q(table)} WHERE id IN (${matched.map(() => '?').join(',')})`).all(...matched.map((m) => m.id)).map((r) => outRow(info, r))
        : [];
      return wantRows ? finish(rows) : { data: null };
    }

    // files sent in the messages that are about to disappear
    let doomed = [];
    if (table === 'messages') doomed = matched.map((m) => m.attachment_url);
    if (table === 'chat_rooms' && matched.length) {
      doomed = db
        .prepare(`SELECT attachment_url FROM messages WHERE attachment_url IS NOT NULL AND room_id IN (${matched.map(() => '?').join(',')})`)
        .all(...matched.map((m) => m.id))
        .map((r) => r.attachment_url);
    }

    if (matched.length) {
      try {
        db.prepare(`DELETE FROM ${q(table)} WHERE id IN (${matched.map(() => '?').join(',')})`).run(...matched.map((m) => m.id));
      } catch (e) {
        throw translateDbError(e);
      }
      for (const url of doomed) if (url) removeUploadByUrl(url);
      if (table === 'colleges') for (const m of matched) removeLogoFile(m.id); // uploaded logo pictures
      if (table === 'messages') for (const m of matched) broadcast({ eventType: 'DELETE', table, new: {}, old: { id: m.id, room_id: m.room_id } });
    }
    return wantRows ? finish(matched) : { data: null };
  }

  throw new HttpError(`Unsupported operation "${op}"`);
}

function translateDbError(e) {
  const m = String(e.message || e);
  if (/UNIQUE/i.test(m)) return new HttpError('That already exists', 409);
  if (/FOREIGN KEY/i.test(m)) return new HttpError('Related record not found', 409);
  if (/NOT NULL/i.test(m)) return new HttpError(`Missing required value (${m.split(':').pop().trim()})`);
  if (/CHECK/i.test(m)) return new HttpError('A value is out of range');
  return new HttpError(m, 400);
}
