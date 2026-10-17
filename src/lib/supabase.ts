// Local client for the Unilink server (server/index.js).
// It keeps the same chainable API the app used with Supabase (from().select().eq()...),
// but all data is stored in the SQLite file database/campusconnect.db on this computer.

export interface User {
  id: string;
  email: string;
}
export interface Session {
  access_token: string;
  user: User;
}

type DbError = { message: string };
type Result<T = any> = { data: T; error: DbError | null; count?: number | null }; // eslint-disable-line @typescript-eslint/no-explicit-any

const TOKEN_KEY = 'campusconnect.token';
const OFFLINE_MSG = 'Cannot reach the Unilink server. Start it with "npm run dev" (or "npm run server").';

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function setToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

async function call(path: string, body?: unknown, method = 'POST'): Promise<{ ok: boolean; json: any }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const token = getToken();
  try {
    const res = await fetch(path, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, json };
  } catch {
    return { ok: false, json: { error: { message: OFFLINE_MSG } } };
  }
}

// ---------------- chat files and polls ----------------

export interface UploadedFile {
  id: string;
  url: string;
  name: string;
  mime: string;
  kind: 'image' | 'video' | 'audio' | 'file';
  size: number;
}

/** URL for showing or downloading a chat file (the sign-in token is added because <img> and <video> cannot send headers). */
export function fileUrl(url: string, download = false): string {
  const token = getToken();
  return `${url}?token=${encodeURIComponent(token ?? '')}${download ? '&download=1' : ''}`;
}

/** Calls one of the server's own endpoints (polls etc.). */
export async function apiPost<T = any>(path: string, body: unknown): Promise<{ data: T | null; error: DbError | null }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { ok, json } = await call(path, body);
  if (!ok) return { data: null, error: { message: json?.error?.message ?? 'Request failed' } };
  return { data: (json.data ?? null) as T, error: null };
}

/** Uploads a college logo (admins only). Resolves with the new logo link, or an error message. */
export async function uploadCollegeLogo(collegeId: string, file: File): Promise<{ data: { logo_url: string } | null; error: DbError | null }> {
  try {
    const token = getToken();
    const res = await fetch(`/api/colleges/logo?college_id=${encodeURIComponent(collegeId)}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: file,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { data: null, error: { message: json?.error?.message ?? 'Upload failed' } };
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: { message: OFFLINE_MSG } };
  }
}

/** Uploads one file with progress (0-100). Resolves with the stored file, or an error message. */
export function uploadFile(file: File, onProgress?: (percent: number) => void): Promise<{ data: UploadedFile | null; error: DbError | null }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => resolve({ data: null, error: { message: OFFLINE_MSG } });
    xhr.onload = () => {
      let json: any = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        /* not JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300 && json.data) resolve({ data: json.data as UploadedFile, error: null });
      else resolve({ data: null, error: { message: json?.error?.message ?? 'Upload failed' } });
    };
    xhr.send(file);
  });
}

// ---------------- query builder ----------------

type Filter = { col: string; op: string; val: unknown };

class QueryBuilder implements PromiseLike<Result> {
  private req: Record<string, unknown> & { filters: Filter[]; order: { col: string; ascending: boolean }[] };

  constructor(table: string) {
    this.req = { table, op: 'select', filters: [], order: [] };
  }

  select(columns = '*', opts?: { count?: 'exact'; head?: boolean }) {
    this.req.select = columns;
    if (opts?.head) this.req.head = true;
    if (opts?.count) this.req.count = opts.count;
    return this;
  }
  insert(values: unknown) {
    this.req.op = 'insert';
    this.req.values = values;
    return this;
  }
  upsert(values: unknown, opts?: { onConflict?: string }) {
    this.req.op = 'upsert';
    this.req.values = values;
    if (opts?.onConflict) this.req.onConflict = opts.onConflict;
    return this;
  }
  update(values: unknown) {
    this.req.op = 'update';
    this.req.values = values;
    return this;
  }
  delete() {
    this.req.op = 'delete';
    return this;
  }

  private f(op: string, col: string, val: unknown) {
    this.req.filters.push({ col, op, val });
    return this;
  }
  eq(col: string, val: unknown) { return this.f('eq', col, val); }
  neq(col: string, val: unknown) { return this.f('neq', col, val); }
  gt(col: string, val: unknown) { return this.f('gt', col, val); }
  gte(col: string, val: unknown) { return this.f('gte', col, val); }
  lt(col: string, val: unknown) { return this.f('lt', col, val); }
  lte(col: string, val: unknown) { return this.f('lte', col, val); }
  like(col: string, val: string) { return this.f('like', col, val); }
  ilike(col: string, val: string) { return this.f('ilike', col, val); }
  is(col: string, val: boolean | null) { return this.f('is', col, val); }
  in(col: string, val: unknown[]) { return this.f('in', col, val); }

  order(col: string, opts?: { ascending?: boolean }) {
    this.req.order.push({ col, ascending: opts?.ascending !== false });
    return this;
  }
  limit(n: number) {
    this.req.limit = n;
    return this;
  }
  single() {
    this.req.single = 'single';
    return this;
  }
  maybeSingle() {
    this.req.single = 'maybeSingle';
    return this;
  }

  private async exec(): Promise<Result> {
    const { ok, json } = await call('/api/rest', this.req);
    if (!ok) return { data: null, error: { message: json?.error?.message ?? 'Request failed' }, count: null };
    return { data: json.data ?? null, error: null, count: json.count ?? null };
  }

  then<R1 = Result, R2 = never>(
    onfulfilled?: ((value: Result) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return this.exec().then(onfulfilled, onrejected);
  }
}

// ---------------- auth ----------------

type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT';
const authListeners = new Set<(event: AuthEvent, session: Session | null) => void>();
const emitAuth = (event: AuthEvent, session: Session | null) => {
  authListeners.forEach((cb) => cb(event, session));
  restartStream(true);
};

async function authRequest(path: string, body: unknown) {
  const { ok, json } = await call(path, body);
  if (!ok) return { data: { user: null, session: null }, error: { message: json?.error?.message ?? 'Request failed' } };
  setToken(json.session.access_token);
  emitAuth('SIGNED_IN', json.session as Session);
  return { data: { user: json.user as User, session: json.session as Session }, error: null };
}

const auth = {
  async getSession(): Promise<{ data: { session: Session | null } }> {
    const token = getToken();
    if (!token) return { data: { session: null } };
    const { ok, json } = await call('/api/auth/user', undefined, 'GET');
    if (ok) return { data: { session: { access_token: token, user: json.user as User } } };
    // keep the token if the server is just offline; drop it if it was rejected
    if (json?.error?.message !== OFFLINE_MSG) setToken(null);
    return { data: { session: null } };
  },
  onAuthStateChange(cb: (event: AuthEvent, session: Session | null) => void) {
    authListeners.add(cb);
    return { data: { subscription: { unsubscribe: () => authListeners.delete(cb) } } };
  },
  signUp(args: { email: string; password: string; options?: { data?: { full_name?: string } } }) {
    return authRequest('/api/auth/signup', { email: args.email, password: args.password, full_name: args.options?.data?.full_name });
  },
  signInWithPassword(args: { email: string; password: string }) {
    return authRequest('/api/auth/signin', args);
  },
  async signOut() {
    await call('/api/auth/signout', {});
    setToken(null);
    emitAuth('SIGNED_OUT', null);
    return { error: null };
  },
};

// ---------------- realtime chat (Server-Sent Events) ----------------

type ChangePayload = { eventType: string; table: string; schema: string; new: any; old: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
type Listener = { filter: { event: string; schema?: string; table?: string; filter?: string }; cb: (p: ChangePayload) => void };

class RealtimeChannel {
  listeners: Listener[] = [];
  name: string;
  constructor(name: string) {
    this.name = name;
  }
  on(_type: 'postgres_changes', filter: Listener['filter'], cb: Listener['cb']) {
    this.listeners.push({ filter, cb });
    return this;
  }
  subscribe() {
    channels.add(this);
    restartStream();
    return this;
  }
}

const channels = new Set<RealtimeChannel>();
let stream: EventSource | null = null;
let streamToken: string | null = null;

/** (Re)opens the live connection. Without `force`, a connection that is already open for the same sign-in is kept,
 *  so adding a listener (typing, read receipts, ...) does not cut the connection and miss events in the gap. */
function restartStream(force = false) {
  const token = getToken();
  if (!force && stream && stream.readyState !== EventSource.CLOSED && token && token === streamToken && channels.size > 0) return;
  stream?.close();
  stream = null;
  streamToken = null;
  if (!token || channels.size === 0 || typeof EventSource === 'undefined') return;
  streamToken = token;
  const es = new EventSource(`/api/realtime?token=${encodeURIComponent(token)}`);
  es.onmessage = (e) => {
    const evt = JSON.parse(e.data);
    const payload: ChangePayload = { eventType: evt.eventType, table: evt.table, schema: 'public', new: evt.new ?? {}, old: evt.old ?? {} };
    const row = evt.eventType === 'DELETE' ? payload.old : payload.new;
    channels.forEach((ch) =>
      ch.listeners.forEach(({ filter, cb }) => {
        if (filter.event !== '*' && filter.event !== evt.eventType) return;
        if (filter.table && filter.table !== evt.table) return;
        if (filter.filter) {
          const m = /^(\w+)=eq\.(.*)$/.exec(filter.filter);
          if (m && String(row[m[1]]) !== m[2]) return;
        }
        cb(payload);
      })
    );
  };
  // EventSource retries by itself, but gives up for good if the server answers with an error (restart, expired link). Reopen it then.
  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED && stream === es) setTimeout(() => { if (stream === es) restartStream(true); }, 3000);
  };
  stream = es;
}

export const supabase = {
  from: (table: string) => new QueryBuilder(table),
  auth,
  channel: (name: string) => new RealtimeChannel(name),
  removeChannel(ch: RealtimeChannel) {
    channels.delete(ch);
    if (channels.size === 0) restartStream();
    return Promise.resolve('ok');
  },
};

export type Role = 'student' | 'admin' | 'super_admin';
export type CollegeRole = 'member' | 'committee_head' | 'secretary' | 'vice_president' | 'president';
export type RoomType = 'global' | 'college' | 'private';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';

export interface College {
  id: string;
  name: string;
  domain: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  /** 'Tier 1' | 'Tier 2' | 'Elite' */
  tier: string | null;
  description: string | null;
  logo_url: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  /** The single website owner (also a super admin). Sees every room. */
  is_owner?: boolean;
  college_id: string | null;
  is_verified: boolean;
  avatar_url: string | null;
  bio: string | null;
  college_role: CollegeRole;
  committee_name: string | null;
  /** false until the new-user guide has been finished or skipped */
  onboarding_done: boolean;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  created_at: string;
  college?: College | null;
}

export interface ChatRoom {
  id: string;
  name: string;
  description: string | null;
  room_type: RoomType;
  /** 6-digit code people use to join the room */
  room_code: string;
  college_id: string | null;
  created_by: string;
  created_at: string;
  /** 0 = off; set with /slowmode */
  slowmode_seconds?: number;
  /** set with /lock and /unlock */
  is_locked?: boolean;
  college?: College | null;
}

export interface RoomMember {
  id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
  profile?: Profile;
}

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'poll';

export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  msg_type: MessageType;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_mime: string | null;
  attachment_size: number | null;
  reply_to_id?: string | null;
  /** JSON list of {id, name}: people @-mentioned, decided by the server */
  mentions?: string | null;
  created_at: string;
  /** set by /pin */
  pinned_at?: string | null;
  /** posted with /announce */
  is_announcement?: boolean;
  sender?: Profile;
}

/** Realtime notice that someone started or stopped typing in a room. Never stored (see server/presence.js). */
export interface TypingEvent {
  room_id: string;
  user_id: string;
  name: string;
  typing: boolean;
}

/** How far one person has read in a room: they have seen every message up to and including `last_read_at`. */
export interface ReadMarker {
  user_id: string;
  name: string;
  last_read_at: string;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface Poll {
  id: string;
  message_id: string;
  question: string;
  multiple: boolean;
  is_closed: boolean;
  created_by: string;
  total_voters: number;
  options: PollOption[];
  my_votes: string[];
}

// ---------------- chat commands (/help /ban /mute /kick ...) ----------------

/** One command as the server describes it for the person's rank in a room. */
export interface RoomCommand {
  name: string;
  usage: string;
  summary: string;
  example: string | null;
  who: string;
  /** false = shown in the help panel, but locked for this person in this room */
  allowed: boolean;
}

export interface PinnedMessage {
  id: string;
  text: string;
  msg_type: MessageType;
  sender_name: string;
  pinned_by_name: string | null;
  pinned_at: string;
}

/** Realtime notice that /slowmode, /lock, /unlock, /pin, /unpin or /clear changed a room. */
export interface RoomSettingsEvent {
  room_id: string;
  change: 'slowmode' | 'lock' | 'unlock' | 'pin' | 'unpin' | 'clear';
  slowmode_seconds: number;
  is_locked: boolean;
  actor_id: string;
  actor_name: string;
  /** a ready-made line for the chat, e.g. "Sam locked the room." */
  text: string;
}

export interface RoomCommandInfo {
  room: { id: string; name: string; room_type: RoomType; slowmode_seconds: number; is_locked: boolean };
  /** the message pinned with /pin, if any */
  pinned: PinnedMessage | null;
  /** 0 = no moderation power; see server/commands.js for the scale */
  power: number;
  /** e.g. "Secretary", "Room owner", "Website admin", "Member" */
  title: string;
  commands: RoomCommand[];
  /** set while the person is muted in this room */
  mute: { expires_at: string | null; reason: string | null } | null;
}

/** One chat command as the Admin Panel's Chat commands tab shows it. */
export interface CommandPermission {
  name: string;
  usage: string;
  summary: string;
  /** the rank the command needs unless the super admin changes it (see server/commands.js) */
  default_min: number;
  /** the rank it needs right now */
  min: number;
  /** the lowest rank that may be chosen (commands that act on people cannot be given to everyone) */
  floor: number;
  /** true = always available to everyone, cannot be changed (/help) */
  fixed: boolean;
  who: string;
}

export interface PermissionLevel {
  value: number;
  label: string;
}

/** One row of the moderation log (POST /api/moderation/log): a ban, mute, kick or warning. */
export interface ModLogEntry {
  id: string;
  action: 'ban' | 'mute' | 'kick' | 'warn';
  /** where it stands now: in force, ended by itself, lifted by someone, or (warnings) counting / already used up by an auto-mute */
  state: 'active' | 'permanent' | 'expired' | 'lifted' | 'counted' | 'used';
  created_at: string;
  expires_at: string | null;
  lifted_at: string | null;
  lifted_by: string | null;
  room_id: string;
  room_name: string;
  room_type: RoomType;
  college_name: string | null;
  target_id: string;
  target_name: string;
  issuer_name: string;
  reason: string | null;
}

export interface SanctionListItem {
  user_id: string;
  name: string;
  kind: 'ban' | 'mute' | 'kick';
  expires_at: string | null;
  reason: string | null;
  by: string;
}

/** What POST /api/chat/command answers with. */
export interface CommandResult {
  panel?: 'help';
  kind?: 'info' | 'success' | 'list';
  text?: string;
  items?: SanctionListItem[];
}

/** Realtime notice that someone was banned, muted, kicked, warned or let back in. */
export interface SanctionEvent {
  id: string;
  room_id: string;
  room_name: string;
  user_id: string;
  action: 'ban' | 'mute' | 'kick' | 'unban' | 'unmute' | 'warn';
  /** for 'warn': how many warnings the person has now, and how many mute them */
  strikes: number | null;
  strike_limit: number | null;
  expires_at: string | null;
  duration_text: string | null;
  /** only sent to the person it is about and to moderators */
  reason: string | null;
  actor_id: string;
  actor_name: string;
  target_name: string;
}

export interface EventItem {
  id: string;
  title: string;
  description: string;
  event_date: string;
  end_date?: string | null;
  location: string | null;
  category: string;
  college_id: string | null;
  created_by: string;
  created_at: string;
  college?: College | null;
  creator?: Profile | null;
  show_on_home?: boolean;
  /** 'college' = only verified students of `college_id` (plus admins and the poster) can see it */
  visibility?: EventVisibility;
}

export type EventVisibility = 'everyone' | 'college';

/** "My college is not listed" request. Admins approve it, which adds the college. */
export interface CollegeRequest {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
  domain: string | null;
  note: string | null;
  requested_by: string;
  status: VerificationStatus;
  college_id: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  requester?: Profile | null;
}

export interface Verification {
  id: string;
  user_id: string;
  college_id: string;
  status: VerificationStatus;
  verified_by: string | null;
  created_at: string;
  resolved_at: string | null;
  user?: Profile;
  college?: College;
}

export type ProfileFieldType = 'text' | 'textarea' | 'number' | 'select' | 'phone' | 'date';

/** A profile field as the super admin defines it (table profile_fields). */
export interface ProfileFieldDef {
  id: string;
  label: string;
  field_type: ProfileFieldType;
  options: string; // choices for 'select', one per line
  required: boolean;
  visibility: 'everyone' | 'admins';
  sort_order: number;
}

/** A field together with one person's value, as returned by /api/profile/fields. */
export interface ProfileFieldValue {
  id: string;
  label: string;
  field_type: ProfileFieldType;
  options: string[];
  required: boolean;
  private: boolean; // only the person and website admins can see it
  value: string;
}

export interface HomeSettings {
  id: number;
  hero_title: string;
  hero_subtitle: string;
  show_slideshow: boolean;
  show_events: boolean;
  show_images: boolean;
  show_videos: boolean;
  events_count: number;
}

export interface HomeSlide {
  id: string;
  title: string;
  subtitle: string;
  image_url: string;
  link_page: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface MediaRow {
  id: string;
  media_type: 'image' | 'video';
  title: string;
  description: string;
  url: string;
  thumbnail_url: string;
  category: string;
  author: string;
  width: number;
  height: number;
  show_on_home: boolean;
  sort_order: number;
  created_at: string;
}

// ---------------- reports (see server/reports.js) ----------------

export type ReportReason = 'spam' | 'harassment' | 'hate' | 'inappropriate' | 'other';

export interface ReportEntry {
  id: string;
  reporter_name: string;
  reason: ReportReason;
  reason_label: string;
  details: string | null;
  created_at: string;
}

/** Whether a button may be used by this moderator, and if not, why (shown as a tooltip). */
export interface ReportAbility {
  allowed: boolean;
  why: string | null;
}

/** One reported message with every report on it. */
export interface ReportItem {
  key: string;
  /** every report on this message; resolving one resolves them all */
  report_ids: string[];
  /** null once the message has been deleted */
  message_id: string | null;
  room_id: string;
  room_name: string;
  room_type: RoomType;
  college_name: string | null;
  target_id: string;
  target_name: string;
  content: string;
  msg_type: MessageType;
  attachment_name: string | null;
  attachment_url: string | null;
  message_sent_at: string | null;
  status: 'open' | 'actioned' | 'dismissed';
  action: 'delete' | 'mute' | 'ban' | 'dismiss' | null;
  message_deleted: boolean;
  resolved_at: string | null;
  resolved_by_name: string | null;
  resolution_note: string | null;
  latest_at: string;
  reports: ReportEntry[];
  /** only on open items */
  can: { delete: ReportAbility; mute: ReportAbility; ban: ReportAbility; target_standing: 'banned' | 'muted' | null } | null;
}

export interface ReportSummary {
  can_review: boolean;
  open: number;
}
