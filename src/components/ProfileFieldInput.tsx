import type { ProfileFieldValue } from '@/lib/supabase';

const base =
  'w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30';

/** One input for a super-admin-defined profile field, shaped by the field's type. */
export function ProfileFieldInput({ field, value, onChange }: { field: ProfileFieldValue; value: string; onChange: (v: string) => void }) {
  switch (field.field_type) {
    case 'select': {
      // keep a value that is no longer in the list visible instead of silently dropping it
      const extra = value && !field.options.includes(value) ? [value] : [];
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">Select...</option>
          {[...field.options, ...extra].map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    case 'textarea':
      return <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} maxLength={500} className={`${base} resize-none`} />;
    case 'number':
      return <input type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className={base} />;
    case 'phone':
      return <input type="tel" value={value} onChange={(e) => onChange(e.target.value)} maxLength={20} placeholder="+91 98765 43210" className={base} />;
    case 'date':
      return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={base} />;
    default:
      return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} maxLength={100} className={base} />;
  }
}

/** Value as shown to people (dates in the reader's own format). */
export function displayFieldValue(f: Pick<ProfileFieldValue, 'field_type' | 'value'>): string {
  if (f.field_type === 'date' && f.value) {
    const d = new Date(f.value + 'T00:00:00');
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return f.value;
}
