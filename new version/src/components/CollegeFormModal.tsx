import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import { apiPost, supabase, uploadCollegeLogo, type College } from '@/lib/supabase';
import CollegeLogo from '@/components/CollegeLogo';

const input =
  'w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30';

const MAX_LOGO_KB = 512;
const isUploaded = (url: string | null | undefined) => !!url && url.startsWith('/api/college-logos/');

/** Add a college, or edit one when `college` is given. Admins only (the server checks too). */
export default function CollegeFormModal({ college, onClose, onSaved }: { college?: College; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(college?.name ?? '');
  const [domain, setDomain] = useState(college?.domain ?? '');
  const [city, setCity] = useState(college?.city ?? '');
  const [state, setState] = useState(college?.state ?? '');
  const [country, setCountry] = useState(college?.country ?? '');
  const [tier, setTier] = useState(college?.tier ?? '');
  const [description, setDescription] = useState(college?.description ?? '');
  // Logo: a link typed in (or the path of an already uploaded picture), and/or a new picture chosen to upload on save.
  const [logo, setLogo] = useState(college?.logo_url ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const choose = (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(png|jpeg|gif|webp)$/.test(f.type)) return setError('Use a PNG, JPG, GIF or WebP picture');
    if (f.size > MAX_LOGO_KB * 1024) return setError(`The picture is too large (${MAX_LOGO_KB} KB at most)`);
    setError(null);
    setFile(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const values = {
      name, domain: domain || null, city: city || null, state: state || null, country: country || null, tier: tier || null, description: description || null,
      // a picture chosen for upload replaces whatever is here once it has been saved
      logo_url: file ? college?.logo_url ?? null : logo.trim() || null,
    };
    const saved = college
      ? await supabase.from('colleges').update(values).eq('id', college.id).select('id').single()
      : await supabase.from('colleges').insert(values).select('id').single();
    if (saved.error || !saved.data) {
      setError(saved.error?.message ?? 'Could not save the college');
      setLoading(false);
      return;
    }
    const id = (saved.data as { id: string }).id;

    let warning: string | null = null;
    if (file) {
      const up = await uploadCollegeLogo(id, file);
      if (up.error) warning = `The college was saved, but the logo could not be uploaded: ${up.error.message}`;
    } else if (college && isUploaded(college.logo_url) && !isUploaded(logo)) {
      await apiPost('/api/colleges/logo/remove', { college_id: id }); // the old picture is no longer used, delete its file
      if (logo.trim()) await supabase.from('colleges').update({ logo_url: logo.trim() }).eq('id', id);
    }
    if (warning) window.alert(warning);
    onSaved();
  };

  const shownLogo = preview ?? (logo || null);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6 animate-slide-up max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-semibold text-lg text-slate-900 dark:text-slate-100">{college ? 'Edit College' : 'Add College'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input required type="text" placeholder="College name" value={name} onChange={(e) => setName(e.target.value)} className={input} />
          <input type="text" placeholder="Website domain (e.g. mit.edu)" value={domain} onChange={(e) => setDomain(e.target.value)} className={input} />
          <div className="flex gap-2">
            <input type="text" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} className={`${input} flex-1 min-w-0`} />
            <input type="text" placeholder="State / region" value={state} onChange={(e) => setState(e.target.value)} className={`${input} flex-1 min-w-0`} />
          </div>
          <div className="flex gap-2">
            <input type="text" placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} className={`${input} flex-1 min-w-0`} />
            <select value={tier} onChange={(e) => setTier(e.target.value)} className={`${input} flex-1 min-w-0`}>
              <option value="">No tier</option>
              <option value="Tier 1">Tier 1</option>
              <option value="Tier 2">Tier 2</option>
              <option value="Elite">Elite (international)</option>
            </select>
          </div>
          <textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${input} resize-none`} />

          {/* Logo */}
          <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5">
            <div className="flex items-center gap-3">
              <CollegeLogo src={shownLogo} name={name} size="lg" />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => picker.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 rounded-xl transition-colors">
                  <ImagePlus className="w-3.5 h-3.5" /> {shownLogo ? 'Change picture' : 'Upload logo'}
                </button>
                {shownLogo && (
                  <button type="button" onClick={() => { setFile(null); setLogo(''); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                )}
              </div>
              <input ref={picker} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden"
                onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
            {!file && !isUploaded(logo) && (
              <input type="url" placeholder="...or paste a link to the logo (https://...)" value={logo} onChange={(e) => setLogo(e.target.value)} className={input} />
            )}
            <p className="text-[11px] text-slate-400">PNG, JPG, GIF or WebP, {MAX_LOGO_KB} KB at most. A square picture on a plain background looks best. Links only show while online.</p>
          </div>

          {error && <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2">{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : college ? <><Save className="w-4 h-4" /> Save changes</> : <><Plus className="w-4 h-4" /> Add College</>}
          </button>
        </form>
      </div>
    </div>
  );
}
