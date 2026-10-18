import { useEffect, useState } from 'react';
import {
  ArrowUpRight, Award, Bot, BriefcaseBusiness, CalendarDays, Compass,
  FolderGit2, GraduationCap, MessageSquare, ShieldCheck, Sparkles,
  Users, BookOpen, ListTodo, FileText, Settings2, BellRing, Building2, Activity,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import ResumeBuilder from '@/components/ResumeBuilder';
import CertificateCenter from '@/components/CertificateCenter';
import PortfolioPanel from '@/components/PortfolioPanel';
import OpportunityWorkspace from '@/pages/OpportunityWorkspace';
import type { Page } from '@/components/Layout';

type Props = { onNavigate: (page: Page) => void };
const card = 'rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900';
const primary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50';
const secondary = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800';

const features: { number: string; title: string; description: string; icon: typeof Users; page: Page; label: string; tone: string }[] = [
  { number: '01', title: 'Smart teammate matching', description: 'Find verified students by shared skills, interests, and complementary strengths.', icon: Users, page: 'collaborate', label: 'Find teammates', tone: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' },
  { number: '02', title: 'Project showcase & portfolio', description: 'Publish project write-ups, technologies, repositories, and live demos.', icon: FolderGit2, page: 'growth', label: 'Build portfolio', tone: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  { number: '03', title: 'Internships & opportunities', description: 'Discover internships, scholarships, hackathons, workshops, and competitions.', icon: BriefcaseBusiness, page: 'hub', label: 'Explore opportunities', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  { number: '04', title: 'Peer learning & study groups', description: 'Create study groups, find classmates, and share learning goals.', icon: BookOpen, page: 'hub', label: 'Find study groups', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  { number: '05', title: 'Inter-college events', description: 'Find campus events and RSVP to activities across the community.', icon: CalendarDays, page: 'events', label: 'Browse events', tone: 'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300' },
  { number: '06', title: 'Chat & collaboration', description: 'Coordinate in chat rooms and direct messages while working with a team.', icon: MessageSquare, page: 'chat', label: 'Open chat', tone: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300' },
  { number: '07', title: 'Smart study planner', description: 'Organize assignments, priorities, due dates, and progress in one place.', icon: ListTodo, page: 'planner', label: 'Plan my week', tone: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300' },
  { number: '08', title: 'UniLink AI assistant', description: 'Brainstorm project ideas, get study guidance, and break work into steps.', icon: Bot, page: 'home', label: 'Ask the assistant', tone: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300' },
  { number: '09', title: 'Achievements & reputation', description: 'Showcase earned badges and build a record of helpful contributions.', icon: Award, page: 'profile', label: 'View achievements', tone: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300' },
  { number: '10', title: 'Trust, safety & verification', description: 'Review your verification, blocking, and community reporting options.', icon: ShieldCheck, page: 'hub', label: 'Safety tools', tone: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300' },
];

export default function StudentGrowthPage({ onNavigate }: Props) {
  const { profile } = useAuth();
  const [tab, setTab] = useState<'explore' | 'portfolio' | 'opportunities' | 'resume' | 'certificates' | 'settings'>('explore');
  const [largeText, setLargeText] = useState(() => { try { return localStorage.getItem('unilink-large-text') === '1'; } catch { return false; } });
  const [reduceMotion, setReduceMotion] = useState(() => { try { return localStorage.getItem('unilink-reduce-motion') === '1'; } catch { return false; } });
  useEffect(() => { document.documentElement.classList.toggle('a11y-large-text', largeText); try { localStorage.setItem('unilink-large-text', largeText ? '1' : '0'); } catch { /* ignore */ } }, [largeText]);
  useEffect(() => { document.documentElement.classList.toggle('a11y-reduce-motion', reduceMotion); try { localStorage.setItem('unilink-reduce-motion', reduceMotion ? '1' : '0'); } catch { /* ignore */ } }, [reduceMotion]);

  return <div className="h-full overflow-y-auto scrollbar-thin bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-9">
      <header className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-indigo-950 via-brand-800 to-violet-700 p-6 text-white sm:p-9">
        <div className="relative z-10 max-w-3xl">
          <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[.14em]"><Compass className="h-4 w-4"/> Student growth</span>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">Turn connections into opportunities.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-100 sm:text-base">Find collaborators, share what you build, learn with peers, and discover opportunities across UniLink.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-indigo-950" onClick={() => onNavigate('collaborate')}>Find teammates <ArrowUpRight className="ml-1 inline h-4 w-4"/></button>
            <button className="rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white" onClick={() => setTab('portfolio')}>Showcase a project</button>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-12 -top-20 h-72 w-72 rounded-full border-[36px] border-white/10"/>
        <div className="pointer-events-none absolute -bottom-32 right-32 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-2xl"/>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Student growth sections">
        <button role="tab" aria-selected={tab === 'explore'} onClick={() => setTab('explore')} className={tab === 'explore' ? primary : secondary}><Sparkles className="h-4 w-4"/> Explore all features</button>
        <button role="tab" aria-selected={tab === 'portfolio'} onClick={() => setTab('portfolio')} className={tab === 'portfolio' ? primary : secondary}><FolderGit2 className="h-4 w-4"/> Project showcase & achievements</button>
        <button role="tab" aria-selected={tab === 'opportunities'} onClick={() => setTab('opportunities')} className={tab === 'opportunities' ? primary : secondary}><BriefcaseBusiness className="h-4 w-4"/> Jobs & internships</button>
        <button role="tab" aria-selected={tab === 'resume'} onClick={() => setTab('resume')} className={tab === 'resume' ? primary : secondary}><FileText className="h-4 w-4"/> Resume builder</button>
        <button role="tab" aria-selected={tab === 'certificates'} onClick={() => setTab('certificates')} className={tab === 'certificates' ? primary : secondary}><Award className="h-4 w-4"/> Event certificates</button>
        <button role="tab" aria-selected={tab === 'settings'} onClick={() => setTab('settings')} className={tab === 'settings' ? primary : secondary}><Settings2 className="h-4 w-4"/> Accessibility</button>
      </div>


      {tab === 'explore' && <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {features.map(feature => { const Icon = feature.icon; return <article className={card} key={feature.number}>
            <div className="flex items-start justify-between gap-3"><div className={`flex h-11 w-11 items-center justify-center rounded-xl ${feature.tone}`}><Icon className="h-5 w-5"/></div><span className="text-xs font-bold tracking-widest text-slate-400">{feature.number}</span></div>
            <h2 className="mt-4 font-heading text-lg font-bold">{feature.title}</h2>
            <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500 dark:text-slate-400">{feature.description}</p>
            <button className={`${secondary} mt-4 w-full`} onClick={() => { if (feature.number === '02') setTab('portfolio'); else if (feature.number === '03') setTab('opportunities'); else if (feature.number === '08') window.dispatchEvent(new Event('unilink:open-assistant')); else if (['04','10'].includes(feature.number)) { try { sessionStorage.setItem('unilink:hub-tab', feature.number === '04' ? 'study' : 'safety'); } catch { /* storage unavailable */ } onNavigate('hub'); } else if (feature.number === '09') { onNavigate('profile'); } else onNavigate(feature.page); }}>{feature.label}<ArrowUpRight className="h-4 w-4"/></button>
          </article>; })}
          <article className={card}><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"><FileText className="h-5 w-5"/></div><h2 className="mt-4 font-heading text-lg font-bold">Resume builder</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500 dark:text-slate-400">Create a clean, editable resume from your education, skills, projects, and experience.</p><button className={`${secondary} mt-4 w-full`} onClick={() => setTab('resume')}>Build my resume <ArrowUpRight className="h-4 w-4"/></button></article>
          <article className={card}><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300"><BellRing className="h-5 w-5"/></div><h2 className="mt-4 font-heading text-lg font-bold">Notifications & messages</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500 dark:text-slate-400">Check connection requests, team updates, community alerts, and direct messages.</p><button className={`${secondary} mt-4 w-full`} onClick={() => { try { sessionStorage.setItem('unilink:community-tab', 'notifications'); } catch { /* storage unavailable */ } onNavigate('community'); }}>Open notifications <ArrowUpRight className="h-4 w-4"/></button></article>
          <article className={card}><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><Building2 className="h-5 w-5"/></div><h2 className="mt-4 font-heading text-lg font-bold">Clubs & communities</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500 dark:text-slate-400">Create or join student clubs, organize interests, and connect across campuses.</p><button className={`${secondary} mt-4 w-full`} onClick={() => { try { sessionStorage.setItem('unilink:community-tab', 'clubs'); } catch { /* storage unavailable */ } onNavigate('community'); }}>Explore clubs <ArrowUpRight className="h-4 w-4"/></button></article>
          {['admin','super_admin'].includes(profile?.role ?? '') && <article className={card}><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><Activity className="h-5 w-5"/></div><h2 className="mt-4 font-heading text-lg font-bold">Admin analytics</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500 dark:text-slate-400">Administrators can review usage, student growth, and moderation activity.</p><button className={`${secondary} mt-4 w-full`} onClick={() => onNavigate('admin')}>Open analytics <ArrowUpRight className="h-4 w-4"/></button></article>}
          <article className={card}><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"><Settings2 className="h-5 w-5"/></div><h2 className="mt-4 font-heading text-lg font-bold">Personalization & accessibility</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500 dark:text-slate-400">Adjust text size and reduce motion, in addition to light and dark themes.</p><button className={`${secondary} mt-4 w-full`} onClick={() => setTab('settings')}>Customize experience <ArrowUpRight className="h-4 w-4"/></button></article>
          <article className={card}><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"><FolderGit2 className="h-5 w-5"/></div><h2 className="mt-4 font-heading text-lg font-bold">Shared project files</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500 dark:text-slate-400">Upload briefs, slides, and resources to a team workspace with member-only access.</p><button className={`${secondary} mt-4 w-full`} onClick={() => { try { sessionStorage.setItem('unilink:collab-tab', 'workspace'); } catch { /* storage unavailable */ } onNavigate('collaborate'); }}>Open team workspace <ArrowUpRight className="h-4 w-4"/></button></article>
          <article className={card}><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><Award className="h-5 w-5"/></div><h2 className="mt-4 font-heading text-lg font-bold">Event attendance & certificates</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500 dark:text-slate-400">Organizers can confirm RSVP attendance and students can print certificates.</p><button className={`${secondary} mt-4 w-full`} onClick={() => setTab('certificates')}>Manage certificates <ArrowUpRight className="h-4 w-4"/></button></article>
          <article className={card}><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"><ShieldCheck className="h-5 w-5"/></div><h2 className="mt-4 font-heading text-lg font-bold">Account security</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500 dark:text-slate-400">Review account settings and manage your sign-in email and password.</p><button className={`${secondary} mt-4 w-full`} onClick={() => onNavigate('profile')}>Open account settings <ArrowUpRight className="h-4 w-4"/></button></article>
        </div>
        <p className="text-center text-xs leading-5 text-slate-400"><GraduationCap className="mr-1 inline h-4 w-4"/> Some tools require college verification. The AI assistant is available from the helper button in the app.</p>
      </>}

      {tab === 'portfolio' && <PortfolioPanel />}
      {tab === 'opportunities' && <OpportunityWorkspace />}
      {tab === 'resume' && <ResumeBuilder />}
      {tab === 'certificates' && <CertificateCenter />}
      {tab === 'settings' && <section className={`${card} max-w-3xl space-y-5`}><div><h2 className="font-heading text-xl font-bold">Accessibility preferences</h2><p className="mt-1 text-sm text-slate-500">These preferences are saved in this browser on this device.</p></div><label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"><input type="checkbox" className="mt-1 h-4 w-4" checked={largeText} onChange={e=>setLargeText(e.target.checked)}/><span><strong className="block text-sm">Larger text</strong><span className="mt-1 block text-xs text-slate-500">Increase the base text size to improve readability.</span></span></label><label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"><input type="checkbox" className="mt-1 h-4 w-4" checked={reduceMotion} onChange={e=>setReduceMotion(e.target.checked)}/><span><strong className="block text-sm">Reduce animations</strong><span className="mt-1 block text-xs text-slate-500">Disable most decorative transitions and animations.</span></span></label><p className="text-xs text-slate-400">You can also switch between light and dark mode from the sidebar.</p></section>}
    </div>
  </div>;
}
