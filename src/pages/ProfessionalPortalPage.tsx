import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, Award, BadgeCheck, BriefcaseBusiness, CalendarDays, CheckCircle2, GraduationCap, Lightbulb, MessageSquareText, Network, Search, ShieldCheck, Sparkles, Users, UserRoundSearch, BookOpenCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiPost } from '@/lib/supabase';
import ClassroomsPage from '@/pages/ClassroomsPage';
import CollaboratePage from '@/pages/CollaboratePage';
import OpportunityWorkspace from '@/pages/OpportunityWorkspace';
import ProfessionalContentStudio from '@/pages/ProfessionalContentStudio';
import { CompanyVerificationPanel } from '@/components/CompanyVerificationPanel';
import RecruiterProfilePanel from '@/components/RecruiterProfilePanel';
import PortfolioPanel from '@/components/PortfolioPanel';
import NetworkExtrasPage from '@/pages/NetworkExtrasPage';
import CommunityPage from '@/pages/CommunityPage';

type PortalType = 'teacher' | 'recruiter' | 'founder';
type NetworkPerson = { id: string; full_name: string; skills?: string; interests?: string; industry?: string; job_title?: string; company?: string; degree?: string; network_role?: string; score?: number; match_reasons?: string[] };
type NetworkConnection = { requester_id: string; recipient_id: string; status: string };
type Section = 'overview' | 'profile' | 'network' | 'teams' | 'portfolio' | 'opportunities' | 'mentorship' | 'events' | 'advice' | 'sessions' | 'research' | 'knowledge' | 'impact' | 'classes' | 'talent' | 'startup' | 'company' | 'community' | 'interviews';

const roleCopy: Record<PortalType, { title: string; subtitle: string; icon: typeof GraduationCap; color: string; actions: string[]; advice: string[] }> = {
  teacher: { title: 'Teacher & Faculty Portal', subtitle: 'Share expertise, mentor emerging talent, and build meaningful connections across institutions.', icon: GraduationCap, color: 'from-violet-600 to-indigo-700', actions: ['Offer office hours or mentoring sessions', 'Share research, workshops, and learning resources', 'Recommend promising students for opportunities'], advice: ['Make mentoring specific: agree on one goal and one next step per meeting.', 'Share practical feedback on portfolios and projects, not only grades.', 'Post research or workshop opportunities with clear eligibility and deadlines.'] },
  recruiter: { title: 'Recruiter Portal', subtitle: 'Discover relevant talent, publish opportunities, and build a trusted early-career pipeline.', icon: BriefcaseBusiness, color: 'from-sky-600 to-blue-700', actions: ['Publish jobs and internships with clear requirements', 'Search talent by skills, interests, and institution', 'Keep candidates informed throughout the process'], advice: ['Write role descriptions around skills and outcomes, not vague “rockstar” requirements.', 'Tell candidates what the hiring process and timeline look like.', 'Use structured, job-relevant criteria and give respectful feedback when possible.'] },
  founder: { title: 'Founder Portal', subtitle: 'Meet collaborators, find early talent, share startup opportunities, and grow your venture.', icon: Lightbulb, color: 'from-amber-500 to-orange-600', actions: ['Find co-founders and project collaborators', 'Share internships, projects, and startup challenges', 'Connect with mentors, faculty, and potential partners'], advice: ['Describe the problem, target user, and current stage when introducing your startup.', 'Be transparent about compensation, equity, time commitment, and uncertainty.', 'Start collaborations with a small scoped project and written expectations.'] },
};

const sections: { id: Section; label: string; icon: typeof Network }[] = [
  { id: 'overview', label: 'Overview', icon: Sparkles }, { id: 'community', label: 'Campus community', icon: Users }, { id: 'profile', label: 'My professional profile', icon: BriefcaseBusiness }, { id: 'network', label: 'Professional network', icon: Network }, { id: 'teams', label: 'Projects & teams', icon: Users }, { id: 'portfolio', label: 'Portfolio & achievements', icon: Award }, { id: 'opportunities', label: 'Opportunities', icon: BriefcaseBusiness }, { id: 'interviews', label: 'Interview workspace', icon: CalendarDays }, { id: 'mentorship', label: 'Mentorship', icon: BookOpenCheck }, { id: 'events', label: 'Events & sessions', icon: CalendarDays }, { id: 'advice', label: 'Professional advice', icon: MessageSquareText }, { id: 'sessions', label: 'Sessions & availability', icon: CalendarDays }, { id: 'research', label: 'Research & projects', icon: Lightbulb }, { id: 'knowledge', label: 'Knowledge hub', icon: BookOpenCheck }, { id: 'impact', label: 'Impact analytics', icon: CheckCircle2 }, { id: 'classes', label: 'Classrooms', icon: BookOpenCheck }, { id: 'talent', label: 'Talent pipeline', icon: UserRoundSearch }, { id: 'startup', label: 'Startup workspace', icon: Lightbulb }, { id: 'company', label: 'Company verification', icon: ShieldCheck },
];

export default function ProfessionalPortalPage({ onStudentPortal, onSignOut }: { onStudentPortal: () => void; onSignOut: () => void }) {
  const { profile } = useAuth();
  const savedPortalType = profile?.portal_type;
  const portalType: PortalType = savedPortalType === 'teacher' || savedPortalType === 'recruiter' ? savedPortalType : 'founder';
  const config = roleCopy[portalType];
  const Icon = config.icon;
  const [section, setSection] = useState<Section>('overview');
  const [search, setSearch] = useState('');
  const [networkPeople, setNetworkPeople] = useState<NetworkPerson[]>([]);
  const [networkConnections, setNetworkConnections] = useState<NetworkConnection[]>([]);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [networkMessage, setNetworkMessage] = useState('');
  const [networkBusyId, setNetworkBusyId] = useState<string | null>(null);
  const [savedAdvice, setSavedAdvice] = useState<string[]>([]);
  const welcome = useMemo(() => profile?.full_name?.trim().split(/\s+/)[0] || 'there', [profile?.full_name]);

  const loadNetwork = useCallback(async () => {
    setNetworkLoading(true);
    setNetworkMessage('');
    const [peopleResult, connectionsResult] = await Promise.all([
      apiPost<NetworkPerson[]>('/api/collaboration', { action: 'collab.people' }),
      apiPost<NetworkConnection[]>('/api/collaboration', { action: 'collab.connections' }),
    ]);
    if (peopleResult.error) setNetworkMessage(peopleResult.error.message);
    else setNetworkPeople(peopleResult.data ?? []);
    if (connectionsResult.data) setNetworkConnections(connectionsResult.data);
    setNetworkLoading(false);
  }, [profile?.id]);

  useEffect(() => { if (section === 'network') void loadNetwork(); }, [section, profile?.id, loadNetwork]);

  const connectTo = async (userId: string) => {
    setNetworkBusyId(userId);
    setNetworkMessage('');
    const { error } = await apiPost('/api/collaboration', { action: 'collab.connect', user_id: userId });
    setNetworkBusyId(null);
    if (error) setNetworkMessage(error.message);
    else { setNetworkMessage('Connection request sent.'); await loadNetwork(); }
  };

  const connectionState = (userId: string) => {
    const row = networkConnections.find((c) => (c.requester_id === profile?.id && c.recipient_id === userId) || (c.recipient_id === profile?.id && c.requester_id === userId));
    if (!row) return '';
    if (row.status === 'accepted') return 'Connected';
    if (row.status === 'pending' && row.requester_id === profile?.id) return 'Request sent';
    if (row.status === 'pending') return 'Request received';
    return '';
  };

  return <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-indigo-700 text-white"><Network className="h-5 w-5"/></div><div className="min-w-0"><p className="font-heading text-lg font-bold">UniLink <span className="font-medium text-slate-400">/ Professional</span></p><p className="text-xs text-slate-500">Your professional workspace</p></div></div>
        <div className="flex shrink-0 items-center gap-2"><button onClick={onStudentPortal} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:hover:text-brand-300"><GraduationCap className="h-4 w-4"/><span className="hidden sm:inline">Go to student portal</span><span className="sm:hidden">Student side</span></button><button onClick={onSignOut} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Sign out</button></div>
      </div>
    </header>
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8 lg:py-8">
      <aside className="space-y-5"><div className={`rounded-3xl bg-gradient-to-br ${config.color} p-5 text-white shadow-lg`}><div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><Icon className="h-6 w-6"/></div><p className="text-xs font-bold uppercase tracking-[.16em] text-white/70">Professional portal</p><h2 className="mt-2 text-xl font-bold">{config.title}</h2><p className="mt-2 text-sm leading-6 text-white/80">{config.subtitle}</p></div>
        <nav aria-label="Professional portal navigation" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">{sections.filter(({ id }) => portalType === 'teacher' ? !['talent', 'startup', 'company'].includes(id) : portalType === 'recruiter' ? !['sessions', 'research', 'impact', 'classes', 'startup'].includes(id) : !['sessions', 'research', 'impact', 'classes', 'talent'].includes(id)).map(({ id, label, icon: NavIcon }) => <button key={id} onClick={() => setSection(id)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${section === id ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-900'}`}><NavIcon className="h-4 w-4 shrink-0"/>{label}</button>)}</nav>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600"/><p className="text-sm font-bold">Build trusted connections</p></div><p className="mt-2 text-xs leading-5 text-slate-500">Keep your profile current, describe your expertise clearly, and only share contact details you are comfortable making visible.</p></div>
      </aside>
      <section className="min-w-0 space-y-6">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-brand-600 dark:text-brand-300">{new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</p><h1 className="mt-2 font-heading text-3xl font-bold tracking-tight sm:text-4xl">Welcome, {welcome}.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">{config.subtitle} Your space is focused on professional connections, guidance, hiring, and collaboration.</p></div><div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"><CheckCircle2 className="h-5 w-5"/> Professional workspace</div></div></div>
        {section === 'overview' && <>{portalType === 'teacher' && <div className="mb-5"><ProfessionalContentStudio portalType={portalType} /></div>}{portalType !== 'teacher' && <div className="mb-5"><ProfessionalContentStudio portalType={portalType} /></div>}{portalType === 'teacher' && <button onClick={() => { window.location.hash = '#classrooms'; }} className="mb-4 flex w-full items-center justify-between rounded-2xl border border-violet-200 bg-violet-50 p-4 text-left dark:border-violet-500/30 dark:bg-violet-500/10"><span><span className="block font-bold">Classrooms</span><span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">Create class codes, share lesson notes, and announce updates to students.</span></span><ArrowRight className="h-5 w-5"/></button>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{(portalType === 'teacher' ? [
          { title: 'My classrooms', desc: 'Manage class codes, lesson notes, assignments, and student announcements.', icon: BookOpenCheck, target: 'classes' as Section },
          { title: 'Office hours & mentoring', desc: 'Plan student guidance, mentoring sessions, and availability.', icon: CalendarDays, target: 'sessions' as Section },
          { title: 'Research & projects', desc: 'Publish research openings and recruit project collaborators.', icon: Lightbulb, target: 'research' as Section },
          { title: 'Knowledge hub', desc: 'Share reading lists, teaching resources, workshops, and webinars.', icon: BookOpenCheck, target: 'knowledge' as Section },
          { title: 'Mentorship impact', desc: 'Review learning milestones and mentorship outcomes.', icon: CheckCircle2, target: 'impact' as Section },
          { title: 'Academic network', desc: 'Connect with faculty, students, alumni, and industry partners.', icon: Network, target: 'network' as Section },
        ] : portalType === 'recruiter' ? [
          { title: 'Talent discovery', desc: 'Find early-career candidates by skills, interests, and institution.', icon: UserRoundSearch, target: 'network' as Section },
          { title: 'Hiring opportunities', desc: 'Share jobs, internships, and graduate programmes.', icon: BriefcaseBusiness, target: 'opportunities' as Section },
          { title: 'Candidate pipeline', desc: 'Plan hiring stages, interview scorecards, and candidate updates.', icon: CheckCircle2, target: 'talent' as Section },
          { title: 'Campus hiring events', desc: 'Plan recruitment briefings, career talks, and Q&A sessions.', icon: CalendarDays, target: 'events' as Section },
          { title: 'Hiring relationships', desc: 'Build connections with faculty, alumni, and campus communities.', icon: Network, target: 'network' as Section },
          { title: 'Recruiter playbook', desc: 'Use practical guidance for fair, transparent hiring.', icon: Sparkles, target: 'advice' as Section },
        ] : [
          { title: 'Startup workspace', desc: 'Shape your venture brief, milestones, and team priorities.', icon: Lightbulb, target: 'startup' as Section },
          { title: 'Find co-founders & collaborators', desc: 'Connect with people whose skills complement your idea.', icon: Network, target: 'network' as Section },
          { title: 'Startup opportunities', desc: 'Publish internships, projects, and startup challenges.', icon: BriefcaseBusiness, target: 'opportunities' as Section },
          { title: 'Mentors & advisors', desc: 'Connect with faculty and experienced professionals.', icon: BookOpenCheck, target: 'mentorship' as Section },
          { title: 'Demo days & events', desc: 'Plan showcases, founder meetups, and project demos.', icon: CalendarDays, target: 'events' as Section },
          { title: 'Founder playbook', desc: 'Get practical guidance for building a responsible venture.', icon: Sparkles, target: 'advice' as Section },
        ]).map(({ title, desc, icon: CardIcon, target }) => <button key={title} onClick={() => setSection(target)} className="group rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"><CardIcon className="h-5 w-5"/></span><h3 className="mt-4 font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{desc}</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 dark:text-brand-300">Open section <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1"/></span></button>)}</div><div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="font-heading text-lg font-bold">Your professional priorities</h2><div className="mt-4 grid gap-3 md:grid-cols-3">{config.actions.map((action, i) => <div key={action} className="flex gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-brand-700 dark:bg-slate-700 dark:text-brand-300">{i + 1}</span><p className="text-sm leading-5 text-slate-600 dark:text-slate-300">{action}</p></div>)}</div></div></>}
        {section === 'portfolio' && <PortfolioPanel />}
        {section === 'teams' && <CollaboratePage />}
        {section === 'network' && <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">Professional network</h2><p className="mt-2 text-sm text-slate-500">Discover verified students, faculty, alumni, recruiters, and founders by skills and shared interests.</p></div><button onClick={() => void loadNetwork()} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Refresh</button></div><div className="mt-5 flex items-center gap-3 rounded-xl border border-slate-200 px-4 dark:border-slate-700"><Search className="h-4 w-4 shrink-0 text-slate-400"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter by name, skills, company, industry, or role" aria-label="Filter professional network" className="w-full bg-transparent py-3 text-sm outline-none"/></div>{networkMessage&&<p role="status" className="mt-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">{networkMessage}</p>}{networkLoading?<p className="py-8 text-center text-sm text-slate-500">Loading verified profiles…</p>:<div className="mt-4 grid gap-3 md:grid-cols-2">{networkPeople.filter(person => [person.full_name,person.skills,person.interests,person.industry,person.job_title,person.company,person.degree,person.network_role].some(value => String(value??'').toLowerCase().includes(search.toLowerCase()))).map(person => { const state=connectionState(person.id); return <article key={person.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-bold">{person.full_name} <BadgeCheck className="inline h-4 w-4 text-emerald-600" aria-label="Verified"/></h3><p className="mt-1 text-sm text-slate-500">{[person.job_title,person.company,person.industry].filter(Boolean).join(' · ') || String(person.network_role||'member').replace(/_/g,' ')}</p></div><span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">Match {person.score ?? 0}%</span></div>{person.skills&&<p className="mt-3 text-sm"><strong>Skills:</strong> {person.skills}</p>}{person.interests&&<p className="mt-1 text-sm text-slate-500"><strong>Interests:</strong> {person.interests}</p>}{Array.isArray(person.match_reasons)&&person.match_reasons.length>0&&<p className="mt-3 text-xs leading-5 text-slate-500">{(person.match_reasons ?? []).slice(0,2).join(' · ')}</p>}<div className="mt-4 flex items-center justify-between gap-3"><span className="text-xs font-semibold text-slate-500">{state||'Open to connections'}</span><button disabled={state==='Connected'||state==='Request sent'||networkBusyId===person.id} onClick={()=>void connectTo(person.id)} className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{networkBusyId===person.id?'Sending…':state==='Connected'?'Connected':state==='Request sent'?'Request sent':state==='Request received'?'Accept request':'Connect'}</button></div></article>; })}{networkPeople.filter(person => [person.full_name,person.skills,person.interests,person.industry,person.job_title,person.company,person.degree,person.network_role].some(value => String(value??'').toLowerCase().includes(search.toLowerCase()))).length===0&&<p className="col-span-full rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">{search?'No verified profiles match that search. Try a broader skill or role.':'No matching profiles yet. Complete your professional skills profile and check back soon.'}</p>}</div>}<p className="mt-4 text-xs text-slate-400">Only profiles marked available and verified by UniLink are shown. Connection requests are checked by the server.</p></div>}
        {portalType === 'recruiter' && section === 'talent' && <div className="space-y-4"><div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-100"><strong>Live hiring workspace.</strong> Publish roles, review real applications, and move candidates through reviewing, shortlisted, interview, offer, or rejected stages. Students receive application status updates.</div><OpportunityWorkspace /></div>}
        {section === 'profile' && <RecruiterProfilePanel portalType={portalType} />}
        {section === 'company' && <CompanyVerificationPanel />}
        {portalType === 'founder' && section === 'startup' && <div className="space-y-4"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100"><strong>Live startup workspace.</strong> Create startup opportunities, discover verified collaborators, manage connection requests, and work with project teams. Be clear about compensation, equity, time commitment, and ownership.</div><CollaboratePage /></div>}
        {section === 'opportunities' && <OpportunityWorkspace/>}
        {section === 'community' && <CommunityPage />}
        {section === 'mentorship' && <NetworkExtrasPage initialTab="mentorship" />}
        {section === 'interviews' && <NetworkExtrasPage initialTab="interviews" />}
        {section === 'events' && <ProfessionalContentStudio portalType={portalType} />}
        {portalType === 'teacher' && section === 'sessions' && <PortalInfo title="Sessions & availability" intro="Make it easy for students and professionals to book structured time with you." items={['Publish weekly office hours and set a clear session duration', 'Offer mentoring, research consultation, portfolio reviews, and workshops', 'Use a booking limit to avoid overbooking', 'Send reminders and include location or meeting instructions']} note="Keep booking confirmations and cancellation rules clear. Avoid putting private meeting links in public listings."/>}
        {portalType === 'teacher' && section === 'research' && <PortalInfo title="Research & project collaboration" intro="Turn your expertise into collaborative opportunities." items={['Publish research assistant roles and project briefs', 'Invite collaborators by skills, discipline, and availability', 'Define project outcomes, milestones, and team responsibilities', 'Connect with founders and recruiters for industry-sponsored challenges']} note="Each project should state prerequisites, expected commitment, supervision, ownership, and how applicants can express interest."/>}
        {section === 'knowledge' && <NetworkExtrasPage initialTab="knowledge" />}
        {portalType === 'teacher' && section === 'classes' && <ClassroomsPage/>}
        {portalType === 'teacher' && section === 'impact' && <PortalInfo title="Mentorship impact analytics" intro="Measure useful outcomes rather than vanity metrics." items={['Track mentorship requests accepted and completed', 'Review agreed goals and milestones completed', 'Count research projects and learning resources shared', 'Collect optional feedback after sessions and workshops']} note="Only show data the teacher is authorized to see. Keep private mentee notes confidential and report aggregate outcomes wherever possible."/>}
        {section === 'advice' && <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"><Sparkles className="h-5 w-5"/></div><div><h2 className="text-xl font-bold">Advice for your role</h2><p className="text-sm text-slate-500">Practical recommendations selected for {portalType}s.</p></div></div><div className="mt-5 space-y-3">{config.advice.map((advice) => <div key={advice} className="flex items-start gap-3 rounded-xl border border-slate-100 p-4 dark:border-slate-800"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"/><p className="flex-1 text-sm leading-6">{advice}</p><button onClick={() => setSavedAdvice(old => old.includes(advice) ? old.filter(x => x !== advice) : [...old, advice])} className="shrink-0 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">{savedAdvice.includes(advice) ? 'Saved' : 'Save'}</button></div>)}</div><p className="mt-4 text-xs text-slate-400">These recommendations are general guidance; adapt them to your organization and local policies.</p></div>}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-100 p-4 dark:bg-slate-900"><p className="text-sm text-slate-600 dark:text-slate-300">Need campus tools, student communities, or study features?</p><button onClick={onStudentPortal} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">Go to student portal <ArrowUpRight className="h-4 w-4"/></button></div>
      </section>
    </div>
  </main>;
}

function PortalInfo({ title, intro, items, note }: { title: string; intro: string; items: string[]; note: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><h2 className="text-xl font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{intro}</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{items.map(item => <div key={item} className="flex gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70"><BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600"/><p className="text-sm leading-6">{item}</p></div>)}</div><div className="mt-5 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm leading-6 text-brand-900 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-200"><strong>Best practice:</strong> {note}</div></div>;
}
