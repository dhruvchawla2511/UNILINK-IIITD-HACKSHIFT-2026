import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { BadgeCheck, BriefcaseBusiness, CheckCircle2, Loader2, Save } from 'lucide-react';
import { apiPost } from '@/lib/supabase';

type ProfessionalRole = 'recruiter' | 'teacher' | 'founder';
type RecruiterProfile = {
  skills: string;
  interests: string;
  available: number;
  network_role: string;
  industry: string;
  job_title: string;
  company: string;
  graduation_year: number | null;
  degree: string;
  location: string;
  mentoring_available: number;
  career_goal: string;
};

const emptyProfile: RecruiterProfile = {
  skills: '', interests: '', available: 1, network_role: 'recruiter', industry: '', job_title: '',
  company: '', graduation_year: null, degree: '', location: '', mentoring_available: 0, career_goal: 'hiring',
};
const field = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';

export default function RecruiterProfilePanel({ portalType = 'recruiter' }: { portalType?: ProfessionalRole }) {
  const isTeacher = portalType === 'teacher';
  const isFounder = portalType === 'founder';
  const roleLabel = isTeacher ? 'Teacher & Faculty' : isFounder ? 'Founder' : 'Recruiter';
  const roleValue = isTeacher ? 'faculty' : portalType;
  const [data, setData] = useState<RecruiterProfile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const result = await apiPost<Partial<RecruiterProfile>>('/api/collaboration', { action: 'collab.profile' });
    if (result.error) setError(result.error.message);
    else if (result.data) setData({ ...emptyProfile, ...result.data, network_role: roleValue });
    setLoading(false);
  }, [roleValue]);
  useEffect(() => { void load(); }, [load]);

  const update = <K extends keyof RecruiterProfile>(key: K, value: RecruiterProfile[K]) => setData((current) => ({ ...current, [key]: value }));
  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    const result = await apiPost('/api/collaboration', { action: 'collab.profile.save', ...data, available: data.available === 1, network_role: roleValue, graduation_year: '' });
    setSaving(false);
    if (result.error) setError(result.error.message);
    else setNotice(`${roleLabel} profile saved. Your professional details are up to date.`);
  };

  if (loading) return <section className="mb-6 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900"><Loader2 className="h-4 w-4 animate-spin"/>Loading {roleLabel.toLowerCase()} profile…</section>;

  return <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
    <div className="mb-5 flex items-start gap-3">
      <div className="rounded-xl bg-brand-50 p-3 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"><BriefcaseBusiness className="h-6 w-6"/></div>
      <div><h2 className="text-xl font-bold text-slate-900 dark:text-white">{roleLabel} profile</h2><p className="mt-1 text-sm leading-6 text-slate-500">{isTeacher ? "Share your teaching expertise, academic interests, research areas, and mentoring availability." : isFounder ? "Introduce yourself, your venture, your expertise, and the collaborators or mentors you are looking for." : "Add the professional details candidates need to understand who you are, what you hire for, and how you can help."}</p></div>
    </div>
    <form onSubmit={(event) => void save(event)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">Professional title<input className={field} value={data.job_title} maxLength={120} onChange={(e) => update('job_title', e.target.value)} placeholder={isTeacher ? "e.g. Associate Professor of Computer Science" : isFounder ? "e.g. Co-founder & CEO" : "e.g. Senior Technical Recruiter"}/></label>
        <label className="block text-sm font-medium">{isTeacher ? "Institution / department" : isFounder ? "Startup / organization" : "Company / organization"}<input className={field} value={data.company} maxLength={120} onChange={(e) => update('company', e.target.value)} placeholder={isTeacher ? "University and department" : isFounder ? "Startup name" : "Company name"}/></label>
        <label className="block text-sm font-medium">{isTeacher ? "Discipline / research area" : "Industry"}<input className={field} value={data.industry} maxLength={100} onChange={(e) => update('industry', e.target.value)} placeholder={isTeacher ? "e.g. AI, Biology, Economics" : isFounder ? "e.g. EdTech, ClimateTech, SaaS" : "e.g. Software, Finance, Healthcare"}/></label>
        <label className="block text-sm font-medium">Work location<input className={field} value={data.location} maxLength={120} onChange={(e) => update('location', e.target.value)} placeholder="City, country or Remote"/></label>
      </div>
      <label className="block text-sm font-medium">{isTeacher ? "Teaching, research and subject expertise" : isFounder ? "Skills and areas of expertise" : "Hiring areas and skills"}<textarea className={field} value={data.skills} maxLength={350} rows={2} onChange={(e) => update('skills', e.target.value)} placeholder={isTeacher ? "e.g. machine learning, curriculum design, research supervision" : isFounder ? "e.g. product strategy, fundraising, engineering, growth" : "e.g. frontend, data science, sales, internships; separate with commas"}/><span className="mt-1 block text-xs font-normal text-slate-500">{isTeacher ? "Help learners and collaborators understand your academic expertise." : isFounder ? "Help potential teammates and mentors understand where you can contribute." : "Use skills or roles you commonly recruit for to help people find the right contact."}</span></label>
      <label className="block text-sm font-medium">{isTeacher ? "Teaching and research interests" : isFounder ? "Startup mission and interests" : "Professional interests"}<textarea className={field} value={data.interests} maxLength={350} rows={2} onChange={(e) => update('interests', e.target.value)} placeholder={isTeacher ? "e.g. student mentorship, interdisciplinary research, workshops" : isFounder ? "e.g. problem you are solving, target users, startup stage" : "e.g. early-career talent, campus hiring, inclusive hiring"}/></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700"><input className="mt-1" type="checkbox" checked={data.available === 1} onChange={(e) => update('available', e.target.checked ? 1 : 0)}/><span><strong className="block">Visible in professional network</strong><span className="mt-1 block text-xs font-normal text-slate-500">Turn off to pause discovery and connection requests.</span></span></label>
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700"><input className="mt-1" type="checkbox" checked={data.mentoring_available === 1} onChange={(e) => update('mentoring_available', e.target.checked ? 1 : 0)}/><span><strong className="block">{isTeacher ? "Available for academic mentoring" : isFounder ? "Open to mentoring / advising" : "Open to mentoring"}</strong><span className="mt-1 block text-xs font-normal text-slate-500">{isTeacher ? "Let students know you are available for academic guidance or research supervision." : isFounder ? "Let the community know you may be available to advise or mentor." : "Let students know you may be available for career advice or interview guidance."}</span></span></label>
      </div>
      <label className="block text-sm font-medium">Primary goal<select className={field} value={data.career_goal} onChange={(e) => update('career_goal', e.target.value)}><option value="hiring">Hiring and talent discovery</option><option value="campus-hiring">Campus recruitment</option><option value="internships">Internships and graduate roles</option><option value="networking">Professional networking</option><option value="mentorship">Mentorship and career guidance</option><option value="teaching">Teaching and student development</option><option value="research">Research and academic collaboration</option><option value="startup-growth">Startup growth and partnerships</option><option value="cofounders">Finding co-founders and collaborators</option><option value="fundraising">Fundraising and investor connections</option></select></label>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200"><CheckCircle2 className="mr-1 inline h-4 w-4"/>{notice}</p>}
      <div className="flex flex-wrap items-center gap-3"><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}{saving ? 'Saving…' : `Save ${roleLabel.toLowerCase()} profile`}</button><span className="text-xs text-slate-500"><BadgeCheck className="mr-1 inline h-3.5 w-3.5"/>{isTeacher ? "Keep institutional and academic claims accurate." : isFounder ? "Company or startup verification is managed separately." : "Company verification is managed separately."}</span></div>
    </form>
  </section>;
}
