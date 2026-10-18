import { FormEvent, useCallback, useEffect, useState } from 'react';
import { BookOpen, CalendarDays, CheckCircle2, Pencil, Loader2, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type EventItem } from '@/lib/supabase';

type PortalType = 'teacher' | 'recruiter' | 'founder';
const options: Record<PortalType, { heading: string; intro: string; categories: { value: string; label: string }[] }> = {
  teacher: { heading: 'Teaching content studio', intro: 'Publish learning resources, workshops, research openings, and announcements to the student portal.', categories: [{ value: 'learning_resource', label: 'Learning resource' }, { value: 'workshop', label: 'Workshop / webinar' }, { value: 'research', label: 'Research opportunity' }, { value: 'announcement', label: 'Announcement' }, { value: 'general', label: 'Other event' }] },
  recruiter: { heading: 'Recruiter updates & events', intro: 'Publish career talks, recruitment briefings, hiring events, and company updates for students.', categories: [{ value: 'career', label: 'Career opportunity / update' }, { value: 'workshop', label: 'Career workshop / webinar' }, { value: 'general', label: 'Recruitment event' }, { value: 'announcement', label: 'Announcement' }] },
  founder: { heading: 'Founder updates & events', intro: 'Share startup demos, hackathons, project showcases, team calls, and founder updates with students.', categories: [{ value: 'general', label: 'Startup event' }, { value: 'workshop', label: 'Workshop / webinar' }, { value: 'career', label: 'Project / team opportunity' }, { value: 'announcement', label: 'Announcement' }] },
};
const field = 'w-full rounded-xl border border-slate-200 bg-transparent px-3 py-3 text-sm outline-none focus:border-brand-500 dark:border-slate-700';
export default function ProfessionalContentStudio({ portalType }: { portalType: PortalType }) {
  const { profile } = useAuth();
  const config = options[portalType];
  const [items, setItems] = useState<EventItem[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(config.categories[0].value);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState('Online');
  const [visibility, setVisibility] = useState<'everyone' | 'college'>('everyone');
  const [editing, setEditing] = useState<EventItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    if (!profile?.id) { setLoading(false); return; }
    const { data, error } = await supabase.from('events').select('*').eq('created_by', profile.id).order('created_at', { ascending: false }).limit(50);
    if (error) setMessage(error.message);
    if (data) setItems(data as EventItem[]);
    setLoading(false);
  }, [profile?.id]);
  useEffect(() => { void load(); }, [load]);
  async function publish(e: FormEvent) {
    e.preventDefault();
    if (!profile?.id || !title.trim() || !description.trim()) return;
    setBusy(true); setMessage('');
    const payload = { title: title.trim(), description: description.trim(), event_date: date, end_date: date, location: location.trim() || 'Online', category, created_by: profile.id, college_id: visibility === 'college' ? profile.college_id ?? null : null, visibility, show_on_home: true };
    const editablePayload = { ...payload };
    delete (editablePayload as Partial<typeof payload>).created_by;
    const { error } = editing
      ? await supabase.from('events').update(editablePayload).eq('id', editing.id).eq('created_by', profile.id)
      : await supabase.from('events').insert(payload);
    setBusy(false);
    if (error) setMessage(`Could not ${editing ? 'save changes' : 'publish'}: ${error.message}`);
    else { setMessage(editing ? 'Changes saved.' : 'Published successfully. It is now available in the student portal.'); setTitle(''); setDescription(''); setLocation('Online'); setEditing(null); await load(); }
  }
  async function remove(item: EventItem) {
    if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return;
    setBusy(true); setMessage('');
    const { error } = await supabase.from('events').delete().eq('id', item.id).eq('created_by', profile?.id);
    setBusy(false);
    if (error) setMessage(`Could not delete: ${error.message}`); else { setMessage('Content deleted.'); await load(); }
  }
  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-3"><span className="rounded-xl bg-brand-50 p-3 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"><BookOpen className="h-5 w-5"/></span><div><h2 className="text-xl font-bold">{config.heading}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{config.intro}</p></div></div>
      <form onSubmit={publish} className="mt-5 grid gap-3 sm:grid-cols-2">
        <input required minLength={3} maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title" className={field}/>
        <select value={category} onChange={e=>setCategory(e.target.value)} className={field}>{config.categories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select>
        <label className="text-xs text-slate-500">Publish date<input required type="date" value={date} onChange={e=>setDate(e.target.value)} className={`${field} mt-1`}/></label>
        <label className="text-xs text-slate-500">Audience<select value={visibility} onChange={e=>setVisibility(e.target.value as 'everyone'|'college')} className={`${field} mt-1`}><option value="everyone">Everyone — public student feed</option><option value="college">Verified members of my college</option></select></label>
        <input maxLength={250} value={location} onChange={e=>setLocation(e.target.value)} placeholder="Location or resource URL" className={field}/>
        <textarea required minLength={10} maxLength={5000} rows={5} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Add details, learning outcomes, eligibility, registration instructions, or resource links..." className={`${field} sm:col-span-2`}/>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3"><button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4"/>{busy?'Saving…':editing?'Save changes':'Publish to students'}</button><span className="text-xs text-slate-500">{visibility==='college'?'College-only publishing requires eligible college permissions.':'Visible in the public student feed.'}</span>{editing&&<button type="button" onClick={()=>{setEditing(null);setTitle('');setDescription('');setLocation('Online');setVisibility('everyone');}} className="rounded-xl border px-4 py-3 text-sm">Cancel edit</button>}</div>
      </form>
      {message&&<p role="status" className="mt-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">{message}</p>}
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between gap-3"><div><h3 className="text-lg font-bold">Your published content</h3><p className="mt-1 text-sm text-slate-500">Manage the posts you created.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold dark:bg-slate-800">{items.length} posts</span></div>
      {loading?<div className="flex items-center gap-2 py-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Loading posts…</div>:items.length===0?<p className="py-6 text-sm text-slate-500">No posts yet. Publish your first update above.</p>:<div className="mt-4 space-y-3">{items.map(item=><article key={item.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-100 p-4 dark:border-slate-800"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold">{item.title}</h4><span className="rounded-full bg-brand-50 px-2 py-1 text-xs capitalize text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">{item.category.replace(/_/g,' ')}</span></div><p className="mt-1 text-xs text-slate-500"><CalendarDays className="mr-1 inline h-3.5 w-3.5"/>{item.event_date} · {item.location||'Online'}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{item.description}</p></div><div className="flex items-center gap-2"><span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5"/>Published</span><button type="button" disabled={busy} onClick={()=>{setEditing(item);setTitle(item.title);setDescription(item.description);setDate(item.event_date);setLocation(item.location||'Online');setCategory(item.category);setVisibility(item.visibility==='college'?'college':'everyone');window.scrollTo({top:0,behavior:'smooth'});}} title="Edit your post" className="rounded-lg p-2 text-slate-500 hover:bg-brand-50 hover:text-brand-600 disabled:opacity-50"><Pencil className="h-4 w-4"/></button><button type="button" disabled={busy} onClick={()=>void remove(item)} title="Delete your post" className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"><Trash2 className="h-4 w-4"/></button></div></article>)}</div>}
    </section>
  </div>;
}
