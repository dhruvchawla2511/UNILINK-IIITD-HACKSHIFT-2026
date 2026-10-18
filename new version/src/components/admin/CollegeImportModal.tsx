import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { apiPost } from '@/lib/supabase';
import { collegesFromCsv, COLLEGE_CSV_COLUMNS, CSV_TEMPLATE, type CollegeCsvRow } from '@/lib/csv';

const MAX_ROWS = 2000;
const MAX_FILE_MB = 1;

interface Check {
  added: number;
  duplicates: number;
  errors: { row: number; name: string; message: string }[];
  error_count: number;
}

/**
 * Import many colleges from a CSV file. The file is read here, checked by the server first (nothing saved),
 * and only saved when the admin presses Import. Colleges that already exist (same name) are skipped.
 */
export default function CollegeImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const picker = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<CollegeCsvRow[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [check, setCheck] = useState<Check | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Check | null>(null);

  const reset = () => { setRows([]); setIgnored([]); setCheck(null); setResult(null); setError(null); setFileName(''); };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    reset();
    if (file.size > MAX_FILE_MB * 1024 * 1024) return setError(`The file is too large (${MAX_FILE_MB} MB at most)`);
    const parsed = collegesFromCsv(await file.text());
    if (parsed.noNameColumn) return setError('The first row must be a header with a "name" column. Download the template to see the layout.');
    if (parsed.rows.length === 0) return setError('The file has a header but no colleges in it.');
    if (parsed.rows.length > MAX_ROWS) return setError(`The file has ${parsed.rows.length} rows. Import ${MAX_ROWS} or fewer at a time.`);
    setFileName(file.name);
    setRows(parsed.rows);
    setIgnored(parsed.ignored);
    setBusy(true);
    const { data, error } = await apiPost<Check>('/api/colleges/import', { rows: parsed.rows, dry_run: true });
    setBusy(false);
    if (error) return setError(error.message);
    setCheck(data);
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    const { data, error } = await apiPost<Check>('/api/colleges/import', { rows });
    setBusy(false);
    if (error) return setError(error.message);
    setResult(data);
    onDone();
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'colleges-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const preview = rows.slice(0, 6);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-heading font-semibold text-lg text-slate-900 dark:text-slate-100">Import colleges from CSV</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X className="w-5 h-5" /></button>
        </div>

        {result ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto text-accent-500 mb-3" />
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {result.added} {result.added === 1 ? 'college' : 'colleges'} added
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {result.duplicates > 0 && `${result.duplicates} skipped (already in the directory). `}
              {result.error_count > 0 && `${result.error_count} had a problem and were not added.`}
            </p>
            <button onClick={onClose} className="mt-5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors">Done</button>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              One college per row, with a header row. Only <strong>name</strong> is required. Other columns: {COLLEGE_CSV_COLUMNS.filter((c) => c !== 'name').join(', ')}.
              Tier is <em>Tier 1</em>, <em>Tier 2</em> or <em>Elite</em>. A <em>logo_url</em> must be a web link. Colleges whose name is already in the directory are skipped.
            </p>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <button onClick={() => picker.current?.click()} disabled={busy}
                className="flex items-center gap-2 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors">
                <Upload className="w-4 h-4" /> {fileName ? 'Choose another file' : 'Choose CSV file'}
              </button>
              <button onClick={downloadTemplate}
                className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-xl transition-colors">
                <Download className="w-4 h-4" /> Template
              </button>
              {fileName && <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 min-w-0"><FileSpreadsheet className="w-4 h-4 shrink-0" /><span className="truncate">{fileName}</span></span>}
              <input ref={picker} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = ''; }} />
            </div>

            {error && <div className="mb-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2">{error}</div>}
            {busy && !check && <div className="flex items-center gap-2 text-sm text-slate-500 py-4"><Loader2 className="w-4 h-4 animate-spin" /> Checking the file...</div>}

            {check && (
              <>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <Stat n={check.added} label="will be added" tone="good" />
                  <Stat n={check.duplicates} label="already exist (skipped)" tone="muted" />
                  <Stat n={check.error_count} label="have a problem" tone={check.error_count ? 'bad' : 'muted'} />
                </div>

                {ignored.length > 0 && (
                  <p className="text-xs text-slate-400 mb-3">Ignored columns: {ignored.join(', ')}</p>
                )}

                {check.errors.length > 0 && (
                  <div className="mb-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-300 mb-1"><AlertTriangle className="w-3.5 h-3.5" /> These rows will not be added</p>
                    <ul className="text-xs text-red-700 dark:text-red-300 space-y-0.5 max-h-28 overflow-y-auto scrollbar-thin">
                      {check.errors.map((e) => <li key={e.row}>Row {e.row}{e.name ? ` (${e.name})` : ''}: {e.message}</li>)}
                      {check.error_count > check.errors.length && <li>...and {check.error_count - check.errors.length} more</li>}
                    </ul>
                  </div>
                )}

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto scrollbar-thin mb-4">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400">
                      <tr>{['name', 'city', 'country', 'tier'].map((h) => <th key={h} className="text-left font-medium px-3 py-2 capitalize">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {preview.map((r, i) => (
                        <tr key={i} className="border-t border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                          <td className="px-3 py-1.5 max-w-[16rem] truncate">{r.name || <em className="text-slate-400">(empty)</em>}</td>
                          <td className="px-3 py-1.5">{r.city}</td>
                          <td className="px-3 py-1.5">{r.country}</td>
                          <td className="px-3 py-1.5">{r.tier}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rows.length > preview.length && <p className="text-[11px] text-slate-400 px-3 py-1.5 border-t border-slate-100 dark:border-slate-800">Showing the first {preview.length} of {rows.length} rows</p>}
                </div>

                <button onClick={run} disabled={busy || check.added === 0}
                  className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Upload className="w-4 h-4" /> Import {check.added} {check.added === 1 ? 'college' : 'colleges'}</>}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone: 'good' | 'muted' | 'bad' }) {
  const color = tone === 'good' ? 'text-accent-600 dark:text-accent-400' : tone === 'bad' ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400';
  return (
    <div className="bg-slate-50 dark:bg-slate-950 rounded-xl px-3 py-2 text-center">
      <p className={`text-lg font-heading font-bold ${color}`}>{n}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">{label}</p>
    </div>
  );
}
