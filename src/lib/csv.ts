// Reads a CSV file of colleges in the browser. The server checks every row again, so this only has to be tidy.

/** Splits CSV text into rows of cells. Handles quotes ("a, b"), doubled quotes, line breaks inside quotes, a BOM, and , ; or tab separators. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const delim = [',', ';', '\t'].reduce((best, ch) => (count(ch) > count(best) ? ch : best), ',');

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

export const COLLEGE_CSV_COLUMNS = ['name', 'domain', 'city', 'state', 'country', 'tier', 'description', 'logo_url'] as const;
export type CollegeCsvRow = Record<(typeof COLLEGE_CSV_COLUMNS)[number], string>;

// Header names people are likely to use -> our column
const ALIASES: Record<string, (typeof COLLEGE_CSV_COLUMNS)[number]> = {
  name: 'name', college: 'name', collegename: 'name', institution: 'name', university: 'name',
  domain: 'domain', website: 'domain', url: 'domain', site: 'domain',
  city: 'city', town: 'city',
  state: 'state', region: 'state', province: 'state', stateregion: 'state',
  country: 'country', nation: 'country',
  tier: 'tier', category: 'tier', rank: 'tier',
  description: 'description', about: 'description', notes: 'description',
  logo: 'logo_url', logourl: 'logo_url', logolink: 'logo_url', image: 'logo_url', imageurl: 'logo_url',
};
const key = (h: string) => h.toLowerCase().replace(/[^a-z]/g, '');

export interface ParsedColleges {
  rows: CollegeCsvRow[];
  /** header names we did not recognise (their columns are ignored) */
  ignored: string[];
  /** true when no column is the college name */
  noNameColumn: boolean;
}

/** First row is the header. Columns can be in any order, and only `name` is needed. */
export function collegesFromCsv(text: string): ParsedColleges {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], ignored: [], noNameColumn: true };
  const header = table[0].map((h) => ALIASES[key(h)] ?? null);
  const ignored = table[0].filter((_, i) => !header[i]).map((h) => h.trim()).filter(Boolean);
  const noNameColumn = !header.includes('name');
  const rows = table.slice(1).map((cells) => {
    const r = Object.fromEntries(COLLEGE_CSV_COLUMNS.map((c) => [c, ''])) as CollegeCsvRow;
    header.forEach((col, i) => {
      if (col && !r[col]) r[col] = (cells[i] ?? '').trim();
    });
    return r;
  });
  return { rows, ignored, noNameColumn };
}

export const CSV_TEMPLATE =
  'name,domain,city,state,country,tier,description,logo_url\n' +
  '"Example Institute of Technology",example.edu,Pune,Maharashtra,India,Tier 1,"A short description (300 characters at most)",https://example.edu/logo.png\n' +
  'Sample University,sample.ac.uk,Leeds,,United Kingdom,Elite,,\n';
