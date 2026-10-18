import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Award, ExternalLink, FolderGit2, Loader2, Plus, Trash2 } from 'lucide-react';
import { apiPost } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

type PortfolioProject = {
  id: string; owner_id: string; owner_name: string; title: string; description: string;
  technologies: string; repo_url: string | null; demo_url: string | null; created_at: string;
};
type Achievement = {
  id: string; owner_id: string; owner_name: string; title: string; issuer: string;
  awarded_on: string | null; description: string; credential_url: string | null; created_at: string;
};
const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-white';
const card = 'rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900';
const primary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50';
const secondary = 'inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800';

export default function PortfolioPanel() {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [technologies, setTechnologies] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [achievementTitle, setAchievementTitle] = useState('');
  const [issuer, setIssuer] = useState('');
  const [awardedOn, setAwardedOn] = useState('');
  const [achievementDescription, setAchievementDescription] = useState('');
  const [credentialUrl, setCredentialUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const call = useCallback(async <T,>(body: Record<string, unknown>) => {
    const result = await apiPost<T>('/api/collaboration', body);
    if (result.error) throw new Error(result.error.message);
    return result.data as T;
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [projectRows, achievementRows] = await Promise.all([
        call<PortfolioProject[]>({ action: 'collab.portfolio.list' }),
        call<Achievement[]>({ action: 'collab.achievements.list' }),
      ]);
      setProjects(projectRows ?? []);
      setAchievements(achievementRows ?? []);
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load portfolio'); }
    finally { setLoading(false); }
  }, [call]);
  useEffect(() => { void load(); }, [load]);

  async function addProject(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await call({ action: 'collab.portfolio.create', title: projectTitle, description: projectDescription, technologies, repo_url: repoUrl, demo_url: demoUrl });
      setProjectTitle(''); setProjectDescription(''); setTechnologies(''); setRepoUrl(''); setDemoUrl('');
      setNotice('Project added to your portfolio.'); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not add project'); }
    finally { setBusy(false); }
  }
  async function addAchievement(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await call({ action: 'collab.achievements.create', title: achievementTitle, issuer, awarded_on: awardedOn, description: achievementDescription, credential_url: credentialUrl });
      setAchievementTitle(''); setIssuer(''); setAwardedOn(''); setAchievementDescription(''); setCredentialUrl('');
      setNotice('Achievement added to your portfolio.'); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not add achievement'); }
    finally { setBusy(false); }
  }
  async function removeItem(action: 'collab.portfolio.delete' | 'collab.achievements.delete', id: string, label: string) {
    if (!window.confirm(`Remove this ${label} from your portfolio?`)) return;
    setBusy(true); setError(''); setNotice('');
    try { await call({ action, id }); setNotice(`${label[0].toUpperCase()}${label.slice(1)} removed.`); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : `Could not remove ${label}`); }
    finally { setBusy(false); }
  }

  return <div className="space-y-5">
    <header className="rounded-3xl bg-gradient-to-r from-indigo-950 via-brand-800 to-violet-700 p-6 text-white sm:p-7">
      <div className="flex items-center gap-3"><div className="rounded-2xl bg-white/15 p-3"><FolderGit2 className="h-6 w-6"/></div><div><h2 className="text-2xl font-bold">Portfolio & achievements</h2><p className="mt-1 text-sm text-white/80">Show what you have built, learned, and accomplished.</p></div></div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-white/15 px-3 py-1.5">{projects.filter(p => p.owner_id === profile?.id).length} project(s) by you</span><span className="rounded-full bg-white/15 px-3 py-1.5">{achievements.filter(a => a.owner_id === profile?.id).length} achievement(s) by you</span></div>
    </header>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{notice}</p>}
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <form onSubmit={addProject} className={`${card} space-y-3`}>
        <div className="flex items-center gap-2"><FolderGit2 className="h-5 w-5 text-brand-600"/><h3 className="text-lg font-bold">Add a project</h3></div>
        <label className="block text-xs font-medium text-slate-500">Project title<input className={`${field} mt-1`} value={projectTitle} onChange={e => setProjectTitle(e.target.value)} maxLength={120} minLength={3} required placeholder="e.g. Research project, product, or campaign"/></label>
        <label className="block text-xs font-medium text-slate-500">Description and your contribution<textarea className={`${field} mt-1`} value={projectDescription} onChange={e => setProjectDescription(e.target.value)} maxLength={1600} minLength={10} required rows={3} placeholder="Problem, outcome, and what you contributed"/></label>
        <label className="block text-xs font-medium text-slate-500">Skills, tools, or technologies<input className={`${field} mt-1`} value={technologies} onChange={e => setTechnologies(e.target.value)} maxLength={350} placeholder="Research, React, teaching, product strategy"/></label>
        <label className="block text-xs font-medium text-slate-500">Repository / project link (optional)<input className={`${field} mt-1`} type="url" value={repoUrl} onChange={e => setRepoUrl(e.target.value)} maxLength={500} placeholder="https://…"/></label>
        <label className="block text-xs font-medium text-slate-500">Demo / publication / portfolio link (optional)<input className={`${field} mt-1`} type="url" value={demoUrl} onChange={e => setDemoUrl(e.target.value)} maxLength={500} placeholder="https://…"/></label>
        <button className={primary} disabled={busy || projectTitle.trim().length < 3 || projectDescription.trim().length < 10}><Plus className="h-4 w-4"/>Publish project</button>
      </form>
      <form onSubmit={addAchievement} className={`${card} space-y-3`}>
        <div className="flex items-center gap-2"><Award className="h-5 w-5 text-amber-500"/><h3 className="text-lg font-bold">Add an achievement</h3></div>
        <label className="block text-xs font-medium text-slate-500">Achievement / certification title<input className={`${field} mt-1`} value={achievementTitle} onChange={e => setAchievementTitle(e.target.value)} maxLength={140} minLength={3} required placeholder="e.g. Hackathon finalist or AWS certification"/></label>
        <label className="block text-xs font-medium text-slate-500">Issuer / organization<input className={`${field} mt-1`} value={issuer} onChange={e => setIssuer(e.target.value)} maxLength={140} placeholder="Organization, institution, or event"/></label>
        <label className="block text-xs font-medium text-slate-500">Date awarded (optional)<input className={`${field} mt-1`} type="date" value={awardedOn} onChange={e => setAwardedOn(e.target.value)} /></label>
        <label className="block text-xs font-medium text-slate-500">Details<textarea className={`${field} mt-1`} value={achievementDescription} onChange={e => setAchievementDescription(e.target.value)} maxLength={1200} rows={3} placeholder="What did you achieve or demonstrate?"/></label>
        <label className="block text-xs font-medium text-slate-500">Credential / proof link (optional)<input className={`${field} mt-1`} type="url" value={credentialUrl} onChange={e => setCredentialUrl(e.target.value)} maxLength={500} placeholder="https://…"/></label>
        <button className={primary} disabled={busy || achievementTitle.trim().length < 3}><Plus className="h-4 w-4"/>Add achievement</button>
      </form>
    </div>
    {loading ? <div className={`${card} flex items-center gap-3`}><Loader2 className="h-5 w-5 animate-spin text-brand-600"/>Loading portfolio…</div> : <>
      <section className="space-y-3"><div><h3 className="text-xl font-bold">Project showcase</h3><p className="mt-1 text-sm text-slate-500">Projects from you and other UniLink members.</p></div>{projects.length === 0 ? <div className={`${card} py-8 text-center text-sm text-slate-500`}>No projects yet. Add the first one above.</div> : <div className="grid gap-3 md:grid-cols-2">{projects.map(project => <article key={project.id} className={card}><div className="flex items-start justify-between gap-3"><div className="rounded-xl bg-brand-50 p-2 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"><FolderGit2 className="h-5 w-5"/></div><span className="text-xs text-slate-400">{new Date(project.created_at).toLocaleDateString()}</span></div><h4 className="mt-3 text-lg font-bold">{project.title}</h4><p className="mt-1 text-xs font-semibold text-brand-600">By {project.owner_name}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{project.description}</p>{project.technologies && <div className="mt-3 flex flex-wrap gap-1.5">{project.technologies.split(/[,;]+/).map(v => v.trim()).filter(Boolean).slice(0, 8).map(v => <span key={v} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{v}</span>)}</div>}<div className="mt-4 flex flex-wrap gap-2">{project.repo_url && <a className={secondary} href={project.repo_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5"/>Repository</a>}{project.demo_url && <a className={secondary} href={project.demo_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5"/>View link</a>}{project.owner_id === profile?.id && <button type="button" disabled={busy} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50" onClick={() => void removeItem('collab.portfolio.delete', project.id, 'project')}><Trash2 className="h-3.5 w-3.5"/>Remove</button>}</div></article>)}</div>}</section>
      <section className="space-y-3"><div><h3 className="text-xl font-bold">Achievements & credentials</h3><p className="mt-1 text-sm text-slate-500">Awards, certificates, publications, competitions, and milestones.</p></div>{achievements.length === 0 ? <div className={`${card} py-8 text-center text-sm text-slate-500`}>No achievements listed yet. Add a credential or milestone above.</div> : <div className="grid gap-3 md:grid-cols-2">{achievements.map(item => <article key={item.id} className={card}><div className="flex items-start justify-between gap-3"><div className="rounded-xl bg-amber-50 p-2 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"><Award className="h-5 w-5"/></div>{item.awarded_on && <span className="text-xs text-slate-400">{item.awarded_on}</span>}</div><h4 className="mt-3 text-lg font-bold">{item.title}</h4><p className="mt-1 text-xs font-semibold text-brand-600">{item.issuer || 'Achievement'} · {item.owner_name}</p>{item.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{item.description}</p>}<div className="mt-4 flex flex-wrap gap-2">{item.credential_url && <a className={secondary} href={item.credential_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5"/>Proof / credential</a>}{item.owner_id === profile?.id && <button type="button" disabled={busy} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50" onClick={() => void removeItem('collab.achievements.delete', item.id, 'achievement')}><Trash2 className="h-3.5 w-3.5"/>Remove</button>}</div></article>)}</div>}</section>
    </>}
  </div>;
}
