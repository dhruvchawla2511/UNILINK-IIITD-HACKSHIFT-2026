import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { supabase, type ProfileFieldDef, type ProfileFieldType } from '@/lib/supabase';

const TYPE_LABEL: Record<ProfileFieldType, string> = {
  text: 'Short text',
  textarea: 'Long text',
  number: 'Number',
  select: 'Dropdown list',
  phone: 'Phone number',
  date: 'Date',
};

const input =
  'w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30';

interface Draft {
  id: string | null;
  label: string;
  field_type: ProfileFieldType;
  options: string;
  required: boolean;
  visibility: 'everyone' | 'admins';
}
const blank: Draft = { id: null, label: '', field_type: 'text', options: '', required: false, visibility: 'everyone' };

/** Super admin: add, edit, reorder and delete the extra fields people can fill in on their profile. */
export default function ProfileFieldsManager() {
  const [fields, setFields] = useState<ProfileFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('profile_fields').select('*').order('sort_order', { ascending: true });
    if (data) setFields(data as ProfileFieldDef[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError(null);
    const values = {
      label: draft.label,
      options: draft.field_type === 'select' ? draft.options : '',
      required: draft.required,
      visibility: draft.visibility,
    };
    const { error } = draft.id
      ? await supabase.from('profile_fields').update(values).eq('id', draft.id)
      : await supabase.from('profile_fields').insert({ ...values, field_type: draft.field_type });
    setSaving(false);
    if (error) return setError(error.message);
    setDraft(null);
    load();
  };

  const remove = async (f: ProfileFieldDef) => {
    if (!window.confirm(`Delete the "${f.label}" field? Everything people entered in it will be deleted too.`)) return;
    const { error } = await supabase.from('profile_fields').delete().eq('id', f.id);
    if (error) window.alert(error.message);
    load();
  };

  const move = async (i: number, dir: -1 | 1) => {
    const a = fields[i];
    const b = fields[i + dir];
    if (!a || !b) return;
    // renumber everything so equal sort values can never make the order ambiguous
    const order = fields.map((f) => f.id);
    [order[i], order[i + dir]] = [order[i + dir], order[i]];
    setFields(order.map((id) => fields.find((f) => f.id === id)!));
    await Promise.all(order.map((id, n) => supabase.from('profile_fields').update({ sort_order: n }).eq('id', id)));
    load();
  };

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          These fields appear in everyone&apos;s <strong>Profile &gt; Edit Profile</strong>. Add as many as you need (degree, branch, hostel, blood group...).
          Fields set to &quot;admins only&quot; are visible just to the person themselves and website admins.
        </p>
        <button onClick={() => { setError(null); setDraft({ ...blank }); }}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> Add field
        </button>
      </div>

      {fields.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">No extra profile fields yet.</div>
      ) : (
        <div className="space-y-2">
          {fields.map((f, i) => (
            <div key={f.id} className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3">
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25"><ChevronUp className="w-4 h-4" /></button>
                <button onClick={() => move(i, 1)} disabled={i === fields.length - 1} aria-label="Move down" className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25"><ChevronDown className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                  {f.label}{f.required && <span className="text-red-500 ml-1" title="Required">*</span>}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {TYPE_LABEL[f.field_type]}
                  {f.field_type === 'select' && ` · ${f.options.split('\n').filter(Boolean).length} choices`}
                </p>
              </div>
              <span className={`hidden sm:inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${f.visibility === 'admins' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                {f.visibility === 'admins' ? <><EyeOff className="w-3 h-3" /> Admins only</> : <><Eye className="w-3 h-3" /> Everyone</>}
              </span>
              <button onClick={() => { setError(null); setDraft({ id: f.id, label: f.label, field_type: f.field_type, options: f.options, required: !!f.required, visibility: f.visibility }); }}
                aria-label="Edit" className="p-2 text-slate-400 hover:text-brand-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => remove(f)} aria-label="Delete" className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setDraft(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6 animate-slide-up max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-semibold text-lg text-slate-900 dark:text-slate-100">{draft.id ? 'Edit field' : 'Add profile field'}</h3>
              <button onClick={() => setDraft(null)} aria-label="Close" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={save} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Field name</label>
                <input type="text" required autoFocus maxLength={40} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="e.g. Degree, Hostel, Blood group" className={input} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Type</label>
                <select value={draft.field_type} disabled={!!draft.id} onChange={(e) => setDraft({ ...draft, field_type: e.target.value as ProfileFieldType })} className={`${input} disabled:opacity-60`}>
                  {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                {draft.id && <p className="text-xs text-slate-400 mt-1">The type of an existing field can&apos;t be changed.</p>}
              </div>
              {draft.field_type === 'select' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Choices (one per line)</label>
                  <textarea rows={6} value={draft.options} onChange={(e) => setDraft({ ...draft, options: e.target.value })} placeholder={'B.Tech\nM.Tech\nMBA'} className={`${input} font-mono`} />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Who can see it</label>
                <select value={draft.visibility} onChange={(e) => setDraft({ ...draft, visibility: e.target.value as Draft['visibility'] })} className={input}>
                  <option value="everyone">Everyone (shown when someone clicks their name in chat)</option>
                  <option value="admins">Only the person and website admins (good for phone numbers)</option>
                </select>
              </div>
              <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <input type="checkbox" checked={draft.required} onChange={(e) => setDraft({ ...draft, required: e.target.checked })} className="w-4 h-4 rounded accent-brand-600" />
                Required (people must fill it in to save their profile)
              </label>
              {error && <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2">{error}</div>}
              <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> {draft.id ? 'Save changes' : 'Add field'}</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
