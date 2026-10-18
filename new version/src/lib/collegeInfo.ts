// College lookups for the Unilink helper: match a typed college name against the colleges saved in Unilink,
// then add a short summary from Wikipedia (fetched live in the browser, so it needs an internet connection).
import { supabase, type College } from '@/lib/supabase';

// ---------- the colleges saved in Unilink ----------
let collegesPromise: Promise<College[]> | null = null;

/** All colleges in the directory, loaded once and kept for the rest of the visit. */
export function loadColleges(): Promise<College[]> {
  if (!collegesPromise) {
    collegesPromise = Promise.resolve(supabase.from('colleges').select('*').order('name'))
      .then(({ data }: { data: College[] | null }) => data ?? [])
      .catch(() => {
        collegesPromise = null; // try again next time
        return [] as College[];
      });
  }
  return collegesPromise;
}

// ---------- matching a typed name ----------
const STOP = new Set([
  'tell', 'me', 'about', 'what', 'whats', 'is', 'are', 'the', 'info', 'information', 'details', 'detail', 'know', 'knowledge',
  'of', 'on', 'in', 'a', 'an', 'please', 'show', 'give', 'college', 'colleges', 'university', 'institute', 'who', 'where', 'how',
  'its', 'it', 'and', 'for', 'to', 'at', 'wikipedia', 'wiki', 'history', 'overview', 'check', 'search', 'find', 'more', 'can', 'you', 'i', 'want',
]);
const TRIGGER = /\b(about|info|information|details?|know|tell me|overview|history|wiki(pedia)?|college|university|institute)\b/;

const norm = (s: string) =>
  s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s: string) => norm(s).split(' ').filter((t) => t && !STOP.has(t));

export type CollegeMatch = { kind: 'one'; college: College } | { kind: 'many'; colleges: College[] };

/** Does this message name a college from the directory? One match, several possible ones, or null (not a college question). */
export function matchColleges(question: string, colleges: College[]): CollegeMatch | null {
  const q = norm(question);
  if (!q || !colleges.length) return null;
  const padded = ` ${q} `;

  // 1. The whole college name appears in the message (the longest name wins, e.g. "IIT Delhi" over "IIT").
  const whole = colleges
    .filter((c) => norm(c.name).length >= 4 && padded.includes(` ${norm(c.name)} `))
    .sort((a, b) => b.name.length - a.name.length);
  if (whole.length) return { kind: 'one', college: whole[0] };

  // 2. Every meaningful word of the message is part of a college name ("iit delhi", "bits pilani", "stanford").
  const qt = tokens(question);
  if (!qt.length || (qt.length === 1 && qt[0].length < 3)) return null;
  const hits = colleges
    .map((c) => {
      const nt = tokens(c.name);
      const ok = qt.every((t) => nt.some((n) => n === t || (t.length >= 4 && n.startsWith(t))));
      return { c, ok, extra: nt.length - qt.length };
    })
    .filter((h) => h.ok)
    .sort((a, b) => a.extra - b.extra);
  if (!hits.length) return null;
  if (hits.length === 1) return { kind: 'one', college: hits[0].c };
  // A tighter name that is clearly the best fit ("stanford" -> "Stanford University" and nothing else of the same size)
  if (hits[0].extra < hits[1].extra && qt.length >= 2) return { kind: 'one', college: hits[0].c };
  // Several fit. Only ask which one when the message looks like a college question ("tell me about delhi"),
  // so words like "engineering" in an ordinary question do not trigger a list.
  if (TRIGGER.test(q) || qt.length >= 2) return { kind: 'many', colleges: hits.slice(0, 6).map((h) => h.c) };
  return null;
}

// ---------- Wikipedia ----------
export interface WikiSummary {
  title: string;
  extract: string;
  url: string;
  thumbnail?: string;
  description?: string;
}

const wikiCache = new Map<string, WikiSummary | null>();

async function getJson(url: string, ms = 7000): Promise<any> {
  const ctl = new AbortController();
  const t = window.setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } finally {
    window.clearTimeout(t);
  }
}

/** Finds the college's Wikipedia article and returns its summary, or null if there is none or Wikipedia cannot be reached. */
export async function fetchWikipedia(college: College): Promise<WikiSummary | null> {
  if (wikiCache.has(college.id)) return wikiCache.get(college.id) ?? null;
  try {
    const nameTokens = new Set(tokens(college.name));
    const query = [college.name, college.city].filter(Boolean).join(' ');
    const search = await getJson(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=4&format=json&origin=*`
    );
    const titles: string[] = (search?.query?.search ?? []).map((r: { title: string }) => r.title);
    for (const title of titles) {
      // Skip unrelated articles: the title must share a meaningful word with the college's name.
      if (!tokens(title).some((t) => nameTokens.has(t))) continue;
      const s = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
      if (!s || s.type === 'disambiguation' || !s.extract) continue;
      const out: WikiSummary = {
        title: s.title,
        extract: String(s.extract),
        url: s.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
        thumbnail: s.thumbnail?.source,
        description: s.description,
      };
      wikiCache.set(college.id, out);
      return out;
    }
    wikiCache.set(college.id, null);
    return null;
  } catch {
    return null; // offline, blocked or timed out: not cached, so a later question can try again
  }
}

// ---------- the answer ----------
const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n)).replace(/[,;:\s]+$/, '') + '...');

/** The text shown in the chat: what Unilink knows about the college, then the Wikipedia summary. */
export function collegeAnswer(college: College, wiki: WikiSummary | null, wikiFailed: boolean): string {
  const place = [college.city, college.state, college.country].filter(Boolean).join(', ');
  const lines = [college.name];
  if (place) lines.push(`Location: ${place}`);
  if (college.tier) lines.push(`Tier: ${college.tier}`);
  if (college.domain) lines.push(`Website: ${college.domain}`);
  let text = lines.join('\n');
  if (college.description) text += `\n\n${clip(college.description, 300)}`;
  if (wiki) {
    text += `\n\nFrom Wikipedia${wiki.description ? ` (${wiki.description})` : ''}:\n${clip(wiki.extract, 900)}`;
  } else {
    text += wikiFailed
      ? '\n\nI could not reach Wikipedia right now, so this is only what Unilink has saved. Check your internet connection and ask again.'
      : '\n\nI could not find a Wikipedia article for this college.';
  }
  text += '\n\nYou can ask your college\'s chat room here on Unilink for first-hand experiences too.';
  return text;
}
