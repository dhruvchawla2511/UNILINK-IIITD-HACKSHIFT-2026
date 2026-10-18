import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Loader2, Plus, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Save,
  Presentation, Images, CalendarDays, SlidersHorizontal, AlertTriangle, Film, CheckCircle2,
} from 'lucide-react';
import { supabase, type HomeSettings, type HomeSlide, type MediaRow } from '@/lib/supabase';
import { defaultHomeSettings } from '@/lib/content';

type Sub = 'settings' | 'slides' | 'media' | 'events';

interface EventRow {
  id: string;
  title: string;
  event_date: string;
  end_date?: string | null;
  category: string;
  show_on_home: boolean | null;
}

const input =
  'w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30';
const primaryBtn =
  'inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors';
const card = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl';
const iconBtn =
  'p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors';

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between gap-4 py-2 cursor-pointer">
      <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
    </label>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

export default function HomeManager({ userId }: { userId: string }) {
  const [sub, setSub] = useState<Sub>('settings');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [settings, setSettings] = useState<HomeSettings>(defaultHomeSettings);
  const [slides, setSlides] = useState<HomeSlide[]>([]);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);

  const load = useCallback(async () => {
    const [s, sl, md, ev] = await Promise.all([
      supabase.from('home_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('home_slides').select('*').order('sort_order', { ascending: true }),
      supabase.from('media_items').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false }),
      supabase.from('events').select('id,title,event_date,end_date,category,show_on_home').order('event_date', { ascending: false }),
    ]);
    const firstError = s.error ?? sl.error ?? md.error ?? ev.error;
    setError(firstError ? firstError.message : null);
    if (s.data) setSettings({ ...defaultHomeSettings, ...(s.data as HomeSettings) });
    if (sl.data) setSlides(sl.data as HomeSlide[]);
    if (md.data) setMedia(md.data as MediaRow[]);
    if (ev.data) setEvents(ev.data as EventRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2500);
  };

  const run = async (op: PromiseLike<{ error: { message: string } | null }>, okMsg?: string) => {
    const { error: e } = await op;
    if (e) { setError(e.message); return false; }
    setError(null);
    if (okMsg) flash(okMsg);
    await load();
    return true;
  };

  if (loading) {
    return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>;
  }

  const subTabs: { id: Sub; label: string; icon: typeof Presentation }[] = [
    { id: 'settings', label: 'Page settings', icon: SlidersHorizontal },
    { id: 'slides', label: 'Slideshow', icon: Presentation },
    { id: 'media', label: 'Images & videos', icon: Images },
    { id: 'events', label: 'Events', icon: CalendarDays },
  ];

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Control what everyone sees on the Home page. Only the super admin can change these.
      </p>

      {error && (
        <div className="flex gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-medium">Something went wrong: {error}</p>
            <p className="mt-1 text-xs opacity-90">
              Make sure the local server is running (<code>npm run dev</code>). The database file is <code>database/campusconnect.db</code>.
            </p>
          </div>
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-accent-50 dark:bg-accent-500/10 text-sm text-accent-700 dark:text-accent-300">
          <CheckCircle2 className="w-4 h-4" /> {notice}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {subTabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setSub(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                sub === t.id ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {sub === 'settings' && <SettingsPanel settings={settings} onSave={(s) => run(supabase.from('home_settings').upsert({ ...s, id: 1, updated_at: new Date().toISOString() }), 'Home page settings saved')} />}
      {sub === 'slides' && <SlidesPanel slides={slides} userId={userId} run={run} />}
      {sub === 'media' && <MediaPanel media={media} userId={userId} run={run} />}
      {sub === 'events' && <EventsPanel events={events} run={run} />}
    </div>
  );
}

type Run = (op: PromiseLike<{ error: { message: string } | null }>, okMsg?: string) => Promise<boolean>;

function SettingsPanel({ settings, onSave }: { settings: HomeSettings; onSave: (s: HomeSettings) => Promise<boolean> | void }) {
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof HomeSettings>(k: K, v: HomeSettings[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className={`${card} p-5 space-y-4`}>
      <Field label="Page title">
        <input className={input} value={form.hero_title} onChange={(e) => set('hero_title', e.target.value)} />
      </Field>
      <Field label="Subtitle">
        <input className={input} value={form.hero_subtitle} onChange={(e) => set('hero_subtitle', e.target.value)} />
      </Field>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        <Toggle label="Show slideshow" checked={form.show_slideshow} onChange={(v) => set('show_slideshow', v)} />
        <Toggle label="Show upcoming events" checked={form.show_events} onChange={(v) => set('show_events', v)} />
        <Toggle label="Show images" checked={form.show_images} onChange={(v) => set('show_images', v)} />
        <Toggle label="Show videos" checked={form.show_videos} onChange={(v) => set('show_videos', v)} />
      </div>

      <div className="max-w-[12rem]">
        <Field label="Events to show (1 to 24)">
          <input
            type="number" min={1} max={24} className={input} value={form.events_count}
            onChange={(e) => set('events_count', Math.min(24, Math.max(1, Number(e.target.value) || 1)))}
          />
        </Field>
      </div>

      <button
        className={primaryBtn} disabled={saving}
        onClick={async () => { setSaving(true); await onSave(form); setSaving(false); }}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save settings
      </button>
    </div>
  );
}

function SlidesPanel({ slides, userId, run }: { slides: HomeSlide[]; userId: string; run: Run }) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!imageUrl.trim()) return;
    setBusy(true);
    const nextOrder = slides.length ? Math.max(...slides.map((s) => s.sort_order)) + 1 : 1;
    const ok = await run(
      supabase.from('home_slides').insert({
        title: title.trim(), subtitle: subtitle.trim(), image_url: imageUrl.trim(),
        link_page: link || null, sort_order: nextOrder, is_active: true, created_by: userId,
      }),
      'Slide added',
    );
    if (ok) { setTitle(''); setSubtitle(''); setImageUrl(''); setLink(''); }
    setBusy(false);
  };

  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    const list = [...slides];
    [list[i], list[j]] = [list[j], list[i]];
    // renumber 1..n so duplicate or gapped orders can never block a swap
    const updates = list
      .map((sl, idx) => ({ id: sl.id, order: idx + 1, changed: sl.sort_order !== idx + 1 }))
      .filter((u) => u.changed)
      .map((u) => supabase.from('home_slides').update({ sort_order: u.order }).eq('id', u.id));
    await run(
      Promise.all(updates).then((results) => ({ error: results.find((r) => r.error)?.error ?? null })),
    );
  };

  return (
    <div className="space-y-4">
      <div className={`${card} p-5 space-y-3`}>
        <h3 className="font-heading font-semibold text-slate-900 dark:text-slate-100">Add a slide</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Title"><input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Welcome to Unilink" /></Field>
          <Field label="Subtitle"><input className={input} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Short description" /></Field>
          <Field label="Image URL (required)"><input className={input} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." /></Field>
          <Field label="Button links to">
            <select className={input} value={link} onChange={(e) => setLink(e.target.value)}>
              <option value="">No button</option>
              <option value="events">Events</option>
              <option value="gallery">Gallery</option>
              <option value="colleges">Colleges</option>
              <option value="chat">Chat</option>
            </select>
          </Field>
        </div>
        <button className={primaryBtn} disabled={busy || !imageUrl.trim()} onClick={add}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add slide
        </button>
      </div>

      {slides.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">No slides yet. The slideshow stays hidden until you add one.</p>
      ) : (
        <div className="space-y-2">
          {slides.map((s, i) => (
            <div key={s.id} className={`${card} p-3 flex items-center gap-3 ${s.is_active ? '' : 'opacity-60'}`}>
              <img src={s.image_url} alt="" className="w-24 h-14 object-cover rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{s.title || '(no title)'}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{s.subtitle || 'No subtitle'}{s.link_page ? `  |  links to ${s.link_page}` : ''}</p>
              </div>
              <button className={iconBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ChevronUp className="w-4 h-4" /></button>
              <button className={iconBtn} disabled={i === slides.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ChevronDown className="w-4 h-4" /></button>
              <button className={iconBtn} onClick={() => run(supabase.from('home_slides').update({ is_active: !s.is_active }).eq('id', s.id))} aria-label={s.is_active ? 'Hide slide' : 'Show slide'}>
                {s.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <button
                className={`${iconBtn} hover:text-red-600`}
                onClick={() => window.confirm('Delete this slide?') && run(supabase.from('home_slides').delete().eq('id', s.id), 'Slide deleted')}
                aria-label="Delete slide"
              ><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MediaPanel({ media, userId, run }: { media: MediaRow[]; userId: string; run: Run }) {
  const [type, setType] = useState<'image' | 'video'>('image');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [thumb, setThumb] = useState('');
  const [category, setCategory] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');

  const add = async () => {
    if (!title.trim() || !url.trim()) return;
    setBusy(true);
    const ok = await run(
      supabase.from('media_items').insert({
        media_type: type, title: title.trim(), description: description.trim(), url: url.trim(),
        thumbnail_url: thumb.trim() || (type === 'image' ? url.trim() : ''),
        category: category.trim() || 'General', author: author.trim(),
        width: 0, height: 0, show_on_home: true, sort_order: 0, created_by: userId,
      }),
      type === 'image' ? 'Image added' : 'Video added',
    );
    if (ok) { setTitle(''); setUrl(''); setThumb(''); setCategory(''); setAuthor(''); setDescription(''); }
    setBusy(false);
  };

  const shown = media.filter((m) => filter === 'all' || m.media_type === filter);

  return (
    <div className="space-y-4">
      <div className={`${card} p-5 space-y-3`}>
        <h3 className="font-heading font-semibold text-slate-900 dark:text-slate-100">Add an image or video</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Type">
            <select className={input} value={type} onChange={(e) => setType(e.target.value as 'image' | 'video')}>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </Field>
          <Field label="Title (required)"><input className={input} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label={type === 'image' ? 'Image URL (required)' : 'Video file URL, .mp4 (required)'}>
            <input className={input} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          </Field>
          <Field label={type === 'image' ? 'Thumbnail URL (optional)' : 'Cover image URL (optional)'}>
            <input className={input} value={thumb} onChange={(e) => setThumb(e.target.value)} placeholder="https://..." />
          </Field>
          <Field label="Category"><input className={input} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Nature, Events, Sports..." /></Field>
          <Field label="Author / credit"><input className={input} value={author} onChange={(e) => setAuthor(e.target.value)} /></Field>
        </div>
        <Field label="Description">
          <textarea className={`${input} resize-none`} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <button className={primaryBtn} disabled={busy || !title.trim() || !url.trim()} onClick={add}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add {type}
        </button>
      </div>

      <div className="flex gap-2">
        {(['all', 'image', 'video'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${filter === f ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
            {f === 'all' ? 'All' : f === 'image' ? 'Images' : 'Videos'}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">Nothing here yet.</p>
      ) : (
        <div className="space-y-2">
          {shown.map((m) => (
            <div key={m.id} className={`${card} p-3 flex items-center gap-3 ${m.show_on_home ? '' : 'opacity-60'}`}>
              {m.thumbnail_url || m.media_type === 'image' ? (
                <img src={m.thumbnail_url || m.url} alt="" className="w-20 h-14 object-cover rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
              ) : (
                <div className="w-20 h-14 rounded-xl bg-slate-800 flex items-center justify-center shrink-0"><Film className="w-5 h-5 text-slate-400" /></div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{m.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{m.media_type} | {m.category}{m.author ? ` | ${m.author}` : ''}</p>
              </div>
              <button
                className={iconBtn}
                onClick={() => run(supabase.from('media_items').update({ show_on_home: !m.show_on_home }).eq('id', m.id))}
                aria-label={m.show_on_home ? 'Hide from Home page' : 'Show on Home page'}
                title={m.show_on_home ? 'Shown on Home (click to hide)' : 'Hidden from Home (click to show)'}
              >
                {m.show_on_home ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <button
                className={`${iconBtn} hover:text-red-600`}
                onClick={() => window.confirm(`Delete "${m.title}"? It will also leave the Gallery.`) && run(supabase.from('media_items').delete().eq('id', m.id), 'Deleted')}
                aria-label="Delete"
              ><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-400">The eye icon only controls the Home page. Everything stays in the Gallery until you delete it.</p>
    </div>
  );
}

function EventsPanel({ events, run }: { events: EventRow[]; run: Run }) {
  if (events.length === 0) return <p className="text-sm text-slate-400 py-6 text-center">No events have been posted yet.</p>;
  const today = new Date(new Date().toDateString());
  return (
    <div className="space-y-2">
      {events.map((e) => {
        const visible = e.show_on_home !== false;
        const upcoming = new Date(`${e.end_date || e.event_date}T12:00:00`) >= today;
        return (
          <div key={e.id} className={`${card} p-3 flex items-center gap-3 ${visible ? '' : 'opacity-60'}`}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{e.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {new Date(`${e.event_date}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}{e.end_date && e.end_date !== e.event_date ? ` – ${new Date(`${e.end_date}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}` : ''} | {e.category} | {upcoming ? 'Upcoming' : 'Past (not shown on Home)'}
              </p>
            </div>
            <button
              className={iconBtn}
              onClick={() => run(supabase.from('events').update({ show_on_home: !visible }).eq('id', e.id))}
              aria-label={visible ? 'Hide from Home page' : 'Show on Home page'}
            >
              {visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button
              className={`${iconBtn} hover:text-red-600`}
              onClick={() => window.confirm(`Delete event "${e.title}"?`) && run(supabase.from('events').delete().eq('id', e.id), 'Event deleted')}
              aria-label="Delete event"
            ><Trash2 className="w-4 h-4" /></button>
          </div>
        );
      })}
      <p className="text-xs text-slate-400">The Home page lists upcoming events only. Hiding an event here keeps it on the Events page.</p>
    </div>
  );
}
