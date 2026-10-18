import { FormEvent, useCallback, useEffect, useState } from 'react';
import { BookOpen, CalendarClock, Check, CircleX, Clock3, GraduationCap, Link2, Loader2, Plus, Trash2, Users } from 'lucide-react';
import { apiPost } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

type Tab = 'mentorship' | 'knowledge' | 'interviews';

// API payloads vary by mentorship, knowledge, and interview action.
// eslint-disable-next-line @typescript-eslint/no-explicit-any


type Row = Record<string, any>;
const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900';
const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950';
const primary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50';
const secondary = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800';
const localDate = (value: string) => { const d = new Date(value); const pad = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

export default function NetworkExtrasPage({ initialTab = 'mentorship' }: { initialTab?: Tab }) {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [offers, setOffers] = useState<Row[]>([]);
  const [myOffers, setMyOffers] = useState<Row[]>([]);
  const [bookings, setBookings] = useState<Row[]>([]);
  const [resources, setResources] = useState<Row[]>([]);
  const [meetings, setMeetings] = useState<Row[]>([]);
  const [applications, setApplications] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [offerTitle, setOfferTitle] = useState('');
  const [offerTopics, setOfferTopics] = useState('');
  const [offerDescription, setOfferDescription] = useState('');
  const [offerAvailability, setOfferAvailability] = useState('');
  const [offerDuration, setOfferDuration] = useState('30');
  const [offerMode, setOfferMode] = useState('online');

  const [requestOffer, setRequestOffer] = useState('');

  const [preferredAt, setPreferredAt] = useState('');
  const [goal, setGoal] = useState('');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceSummary, setResourceSummary] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [resourceCategory, setResourceCategory] = useState('Learning resource');
  const [resourceAudience, setResourceAudience] = useState('everyone');
  const [resourceScope, setResourceScope] = useState('global');
  const [applicationId, setApplicationId] = useState('');
  const [interviewAt, setInterviewAt] = useState('');
  const [interviewDuration, setInterviewDuration] = useState('30');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [interviewNotes, setInterviewNotes] = useState('');

  const request = useCallback(async (action: string, payload: Row = {}) => {

    // The endpoint returns different record shapes for each feature action.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any


    const result = await apiPost<any>('/api/features', { action, ...payload });
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }, []);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      if (tab === 'mentorship') {
        const [available, mine, booked] = await Promise.all([request('mentorship.offers.list'), request('mentorship.my_offers'), request('mentorship.mine')]);
        setOffers(Array.isArray(available) ? available : []); setMyOffers(Array.isArray(mine) ? mine : []); setBookings(Array.isArray(booked) ? booked : []);
      } else if (tab === 'knowledge') {
        const result = await request('knowledge.list'); setResources(Array.isArray(result) ? result : []);
      } else {
        const [scheduled, apps] = await Promise.all([request('interviews.list'), request('interviews.applications')]);
        setMeetings(Array.isArray(scheduled) ? scheduled : []); setApplications(Array.isArray(apps) ? apps : []);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load this section.'); }
    finally { setLoading(false); }
  }, [request, tab]);
  useEffect(() => { void load(); }, [load]);
  const act = async (action: string, payload: Row, success: string) => {
    setBusy(true); setError(''); setNotice('');
    try { await request(action, payload); setNotice(success); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Action failed.'); }
    finally { setBusy(false); }
  };
  const submit = (fn: () => Promise<void>) => (e: FormEvent) => { e.preventDefault(); void fn(); };
  const isRecruiter = profile?.portal_type === 'recruiter';
  const canOffer = profile?.portal_type === 'teacher' || profile?.portal_type === 'founder' || profile?.portal_type === 'recruiter' || profile?.role === 'admin' || profile?.role === 'super_admin';
  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: 'mentorship', label: 'Mentorship & booking', icon: GraduationCap },
    { id: 'knowledge', label: 'Knowledge hub', icon: BookOpen },
    { id: 'interviews', label: 'Interview workspace', icon: CalendarClock },
  ];

  return <div className="mx-auto max-w-7xl space-y-5 text-slate-900 dark:text-slate-100">
    <header className="rounded-3xl bg-gradient-to-br from-brand-700 to-indigo-800 p-6 text-white sm:p-8"><p className="text-xs font-bold uppercase tracking-[.16em] text-white/70">UniLink connections</p><h1 className="mt-2 text-3xl font-bold">Mentorship, knowledge & interviews</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-white/80">Book guidance, share learning resources, and coordinate interview schedules in one place.</p></header>
    <nav aria-label="Mentorship and career tools" className="grid grid-cols-1 gap-2 sm:grid-cols-3">{tabs.map(item => <button key={item.id} onClick={() => setTab(item.id)} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold ${tab===item.id?'border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-200':'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900'}`}><item.icon className="h-5 w-5"/>{item.label}</button>)}</nav>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{error}</div>}
    {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{notice}</div>}
    {loading && <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin"/> Loading…</div>}
    {!loading && tab === 'mentorship' && <div className="space-y-5">
      {canOffer && <form className={`${card} grid gap-3 md:grid-cols-2`} onSubmit={submit(async()=>{await act('mentorship.offer.save',{title:offerTitle,topics:offerTopics,description:offerDescription,availability:offerAvailability,duration_minutes:Number(offerDuration),mode:offerMode},'Mentorship offer published.');setOfferTitle('');setOfferTopics('');setOfferDescription('');setOfferAvailability('');})}><div className="md:col-span-2"><h2 className="text-xl font-bold">Offer mentorship</h2><p className="mt-1 text-sm text-slate-500">Publish a focused session offer for students and professionals.</p></div><input className={field} value={offerTitle} onChange={e=>setOfferTitle(e.target.value)} placeholder="Session title, e.g. Portfolio review" minLength={3} maxLength={120} required/><input className={field} value={offerTopics} onChange={e=>setOfferTopics(e.target.value)} placeholder="Topics or skills (comma-separated)" maxLength={300}/><textarea className={`${field} md:col-span-2`} rows={3} value={offerDescription} onChange={e=>setOfferDescription(e.target.value)} placeholder="What can you help with?" maxLength={1200}/><input className={field} value={offerAvailability} onChange={e=>setOfferAvailability(e.target.value)} placeholder="Availability, e.g. weekday evenings" maxLength={300}/><div className="grid grid-cols-2 gap-2"><select className={field} value={offerDuration} onChange={e=>setOfferDuration(e.target.value)}><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="90">90 minutes</option></select><select className={field} value={offerMode} onChange={e=>setOfferMode(e.target.value)}><option value="online">Online</option><option value="in_person">In person</option><option value="either">Either</option></select></div><button className={`${primary} md:col-span-2`} disabled={busy}><Plus className="h-4 w-4"/> Publish offer</button></form>}
      <section className="space-y-3"><h2 className="text-xl font-bold">Available mentors</h2><div className="grid gap-3 md:grid-cols-2">{offers.map(o=><article key={o.id} className={card}><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{o.title}</h3><p className="mt-1 text-sm text-slate-500">{o.mentor_name} · {o.duration_minutes} minutes · {String(o.mode).replace('_',' ')}</p></div><span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">Mentor</span></div>{o.topics&&<p className="mt-3 text-sm"><b>Topics:</b> {o.topics}</p>}<p className="mt-2 text-sm text-slate-500">{o.description||'No additional description.'}</p>{o.availability&&<p className="mt-2 text-xs text-slate-500">Availability: {o.availability}</p>}<form className="mt-4 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800" onSubmit={submit(async()=>{await act('mentorship.request',{offer_id:o.id,preferred_at:preferredAt,goal},'Mentorship request sent.');setPreferredAt('');setGoal('');})}><label className="block text-xs font-semibold text-slate-500">Preferred date and time<input required type="datetime-local" min={localDate(new Date().toISOString())} className={`${field} mt-1`} value={preferredAt} onChange={e=>setPreferredAt(e.target.value)}/></label><textarea className={field} rows={2} value={goal} onChange={e=>setGoal(e.target.value)} placeholder="What would you like help with?" minLength={5} maxLength={800} required/><button className={primary} disabled={busy}>Request a session</button></form></article>)}{!offers.length&&<p className={`${card} text-sm text-slate-500`}>No mentor offers yet. Check back soon or publish an offer from a professional account.</p>}</div></section>
      {canOffer && myOffers.length>0 && <section className={card}><h2 className="text-lg font-bold">Your mentorship offers</h2><div className="mt-3 space-y-2">{myOffers.map(o=><div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"><div><p className="font-semibold">{o.title}</p><p className="text-xs text-slate-500">{o.active?'Active':'Inactive'} · {o.duration_minutes} minutes</p></div>{!!o.active&&<button className={secondary} onClick={()=>void act('mentorship.offer.delete',{id:o.id},'Mentorship offer closed.')}><Trash2 className="h-4 w-4"/> Close offer</button>}</div>)}</div></section>}
      <section className={card}><h2 className="text-lg font-bold">Session requests</h2><div className="mt-3 space-y-2">{bookings.map(b=><article key={b.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{b.offer_title}</p><p className="mt-1 text-xs text-slate-500">{b.mentor_id===profile?.id?`Requested by ${b.mentee_name}`:`Mentor: ${b.mentor_name}`} · {new Date(b.preferred_at).toLocaleString()}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs capitalize dark:bg-slate-800">{b.status}</span></div><p className="my-2 text-sm">{b.goal}</p>{b.mentor_note&&<p className="text-sm text-slate-500">Mentor note: {b.mentor_note}</p>}<div className="mt-3 flex flex-wrap gap-2">{b.mentor_id===profile?.id&&b.status==='pending'&&<><button className={primary} onClick={()=>void act('mentorship.booking.review',{id:b.id,status:'accepted'},'Session accepted.')}>Accept</button><button className={secondary} onClick={()=>void act('mentorship.booking.review',{id:b.id,status:'declined'},'Session declined.')}>Decline</button></>}{b.mentor_id===profile?.id&&b.status==='accepted'&&<button className={secondary} onClick={()=>void act('mentorship.booking.review',{id:b.id,status:'completed'},'Session marked complete.')}>Mark complete</button>}{b.mentee_id===profile?.id&&b.status==='pending'&&<button className={secondary} onClick={()=>void act('mentorship.booking.review',{id:b.id,status:'cancelled'},'Request cancelled.')}>Cancel request</button>}</div></article>)}{!bookings.length&&<p className="text-sm text-slate-500">No mentorship requests yet.</p>}</div></section>
    </div>}
    {!loading && tab === 'knowledge' && <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
      <form className={`${card} h-fit space-y-3`} onSubmit={submit(async()=>{await act('knowledge.create',{title:resourceTitle,summary:resourceSummary,resource_url:resourceUrl,category:resourceCategory,audience:resourceAudience,scope:resourceScope},'Resource shared with the network.');setResourceTitle('');setResourceSummary('');setResourceUrl('');})}><h2 className="text-xl font-bold">Share a learning resource</h2><p className="text-sm text-slate-500">Publish a reading list, tutorial, research paper, course, or study guide.</p><input className={field} value={resourceTitle} onChange={e=>setResourceTitle(e.target.value)} placeholder="Resource title" minLength={3} maxLength={160} required/><select className={field} value={resourceCategory} onChange={e=>setResourceCategory(e.target.value)}><option>Learning resource</option><option>Research</option><option>Career guidance</option><option>Teaching material</option><option>Workshop</option><option>Reading list</option><option>Other</option></select><textarea className={field} rows={4} value={resourceSummary} onChange={e=>setResourceSummary(e.target.value)} placeholder="What is useful about this resource?" maxLength={1500}/><input className={field} type="url" value={resourceUrl} onChange={e=>setResourceUrl(e.target.value)} placeholder="https://resource-link.example (optional)"/><select className={field} value={resourceAudience} onChange={e=>setResourceAudience(e.target.value)}><option value="everyone">Everyone</option><option value="students">Students</option><option value="teachers">Teachers</option><option value="professionals">Professionals</option></select><select className={field} value={resourceScope} onChange={e=>setResourceScope(e.target.value)}><option value="global">Share globally</option><option value="college">My college only</option></select><button className={primary} disabled={busy}><Plus className="h-4 w-4"/> Publish resource</button></form>
      <section className="space-y-3"><div><h2 className="text-xl font-bold">Knowledge library</h2><p className="mt-1 text-sm text-slate-500">Community-contributed resources for learning and professional growth.</p></div><div className="grid gap-3 md:grid-cols-2">{resources.map(r=><article key={r.id} className={card}><div className="flex items-center gap-2 text-xs font-semibold text-brand-700 dark:text-brand-300"><BookOpen className="h-4 w-4"/>{r.category}</div><h3 className="mt-2 font-bold">{r.title}</h3><p className="mt-1 text-xs text-slate-500">Shared by {r.author_name} · {new Date(r.created_at).toLocaleDateString()}</p><p className="my-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{r.summary||'No summary provided.'}</p>{r.resource_url&&<a href={r.resource_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"><Link2 className="h-4 w-4"/> Open resource</a>}{r.author_id===profile?.id&&<button className={`${secondary} mt-3 w-full`} onClick={()=>void act('knowledge.delete',{id:r.id},'Resource removed.')}><Trash2 className="h-4 w-4"/> Remove your resource</button>}</article>)}{!resources.length&&<p className={`${card} text-sm text-slate-500`}>No resources shared yet. Publish the first helpful resource.</p>}</div></section>
    </div>}
    {!loading && tab === 'interviews' && <div className="space-y-5">
      {isRecruiter&&<form className={`${card} grid gap-3 md:grid-cols-2`} onSubmit={submit(async()=>{await act('interviews.schedule',{application_id:applicationId,scheduled_at:interviewAt,duration_minutes:Number(interviewDuration),meeting_url:meetingUrl,notes:interviewNotes},'Interview scheduled and candidate notified.');setInterviewAt('');setMeetingUrl('');setInterviewNotes('');})}><div className="md:col-span-2"><h2 className="text-xl font-bold">Schedule an interview</h2><p className="mt-1 text-sm text-slate-500">Choose an application, time, duration, and optional HTTPS meeting link.</p></div><select required className={field} value={applicationId} onChange={e=>setApplicationId(e.target.value)}><option value="">Choose candidate application</option>{applications.map(a=><option key={a.application_id} value={a.application_id}>{a.candidate_name} — {a.opportunity_title} ({a.application_status})</option>)}</select><label className="text-xs font-semibold text-slate-500">Interview date and time<input required type="datetime-local" min={localDate(new Date().toISOString())} className={`${field} mt-1`} value={interviewAt} onChange={e=>setInterviewAt(e.target.value)}/></label><select className={field} value={interviewDuration} onChange={e=>setInterviewDuration(e.target.value)}><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="90">90 minutes</option></select><input className={field} type="url" value={meetingUrl} onChange={e=>setMeetingUrl(e.target.value)} placeholder="HTTPS meeting link (optional)"/><textarea className={`${field} md:col-span-2`} rows={2} value={interviewNotes} onChange={e=>setInterviewNotes(e.target.value)} placeholder="Instructions or preparation notes" maxLength={800}/><button className={`${primary} md:col-span-2`} disabled={busy||!applicationId}><CalendarClock className="h-4 w-4"/> Schedule interview</button></form>}
      <section className={card}><h2 className="text-xl font-bold">Interview schedule</h2><div className="mt-4 space-y-3">{meetings.map(m=><article key={m.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold">{m.opportunity_title}</h3><p className="mt-1 text-sm text-slate-500">{isRecruiter?`Candidate: ${m.candidate_name}`:`Recruiter: ${m.recruiter_name}`} · {m.organization||'Organization not listed'}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs capitalize dark:bg-slate-800">{m.status}</span></div><p className="mt-3 flex items-center gap-2 text-sm"><Clock3 className="h-4 w-4 text-brand-600"/>{new Date(m.scheduled_at).toLocaleString()} · {m.duration_minutes} minutes</p>{m.notes&&<p className="mt-2 text-sm text-slate-500">{m.notes}</p>}{m.meeting_url&&<a className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300" href={m.meeting_url} target="_blank" rel="noreferrer"><Link2 className="h-4 w-4"/> Join meeting</a>}{isRecruiter&&m.status==='scheduled'&&<div className="mt-3 flex flex-wrap gap-2"><button className={secondary} onClick={()=>void act('interviews.update',{id:m.id,status:'completed',notes:m.notes},'Interview marked complete.')}><Check className="h-4 w-4"/> Mark complete</button><button className={secondary} onClick={()=>void act('interviews.update',{id:m.id,status:'cancelled',notes:m.notes},'Interview cancelled.')}><CircleX className="h-4 w-4"/> Cancel</button></div>}</article>)}{!meetings.length&&<p className="text-sm text-slate-500">No interviews scheduled yet. Once a recruiter schedules one, the details will appear here.</p>}</div></section>
    </div>}
  </div>;
}
