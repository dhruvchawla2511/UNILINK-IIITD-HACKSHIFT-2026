import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Code2, Loader2, Save } from 'lucide-react';
import { apiPost } from '@/lib/supabase';

type SkillsProfile = {
  skills: string;
  interests: string;
  available: number | boolean;
  network_role: string;
  industry: string;
  job_title: string;
  company: string;
  graduation_year: number | null;
  degree: string;
  location: string;
  mentoring_available: number | boolean;
  career_goal: string;
};

const emptyProfile: SkillsProfile = {
  skills: '', interests: '', available: 1, network_role: 'student', industry: '', job_title: '',
  company: '', graduation_year: null, degree: '', location: '', mentoring_available: 0, career_goal: 'networking',
};
const field = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';

export default function ProfileSkillsPanel({ portalType = 'student' }: { portalType?: string }) {
  const [profile, setProfile] = useState<SkillsProfile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const roleValue = portalType === 'teacher' ? 'faculty' : ['student', 'alumni', 'faculty', 'recruiter', 'founder'].includes(portalType) ? portalType : 'student';

  const load = useCallback(async () => {
    const result = await apiPost<Partial<SkillsProfile>>('/api/collaboration', { action: 'collab.profile' });
    if (result.error) setError(result.error.message);
    else if (result.data) setProfile({ ...emptyProfile, ...result.data, network_role: roleValue });
    setLoading(false);
  }, [roleValue]);
  useEffect(() => { void load(); }, [load]);

  const skills = profile.skills.split(/[,;\n]+/).map((skill) => skill.trim()).filter(Boolean).filter((skill, index, all) => all.findIndex((other) => other.toLowerCase() === skill.toLowerCase()) === index);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true); setError(''); setNotice('');
    const result = await apiPost('/api/collaboration', {
      action: 'collab.profile.save', ...profile, skills: skills.join(', '),
      available: !!profile.available, mentoring_available: !!profile.mentoring_available,
      network_role: roleValue, graduation_year: profile.graduation_year ?? '',
    });
    setSaving(false);
    if (result.error) setError(result.error.message);
    else { setProfile((current) => ({ ...current, skills: skills.join(', ') })); setNotice('Your skills have been saved to your profile.'); }
  };

  if (loading) return <section className="mb-6 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900"><Loader2 className="h-4 w-4 animate-spin"/>Loading your skills…</section>;

  return <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
    <div className="mb-4 flex items-start gap-3">
      <div className="rounded-xl bg-brand-50 p-3 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"><Code2 className="h-6 w-6"/></div>
      <div><h2 className="text-xl font-bold text-slate-900 dark:text-white">My skills & expertise</h2><p className="mt-1 text-sm leading-6 text-slate-500">Add the technical, creative, academic, communication, and other skills that describe you. These help others discover you for teams and collaborations.</p></div>
    </div>
    <form onSubmit={(event) => void save(event)} className="space-y-3">
      <label className="block text-sm font-medium">Your skills<textarea className={field} value={profile.skills} maxLength={350} rows={3} onChange={(event) => setProfile((current) => ({ ...current, skills: event.target.value }))} placeholder="e.g. Python, React, research, public speaking, UI/UX design"/><span className="mt-1 block text-xs font-normal text-slate-500">Separate skills with commas or put each on a new line. Up to 350 characters.</span></label>
      {skills.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Skills preview">{skills.map((skill) => <span key={skill.toLowerCase()} className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">{skill}</span>)}</div>}
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200"><CheckCircle2 className="mr-1 inline h-4 w-4"/>{notice}</p>}
      <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}{saving ? 'Saving…' : 'Save skills'}</button>
    </form>
  </section>;
}
