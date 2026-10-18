import { useState } from 'react';
import { Download, FileText, Printer, Palette, LayoutTemplate } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { printWithPageStyle } from '@/lib/printPage';

const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-white';
const label = 'block text-xs font-semibold text-slate-500 dark:text-slate-400';

const templates = [
  { id: 'classic', name: 'Classic', desc: 'Traditional and ATS-friendly', accent: '#1e293b', style: 'classic' },
  { id: 'modern', name: 'Modern', desc: 'Clean with a bold accent', accent: '#4f46e5', style: 'modern' },
  { id: 'minimal', name: 'Minimal', desc: 'Simple, spacious and elegant', accent: '#475569', style: 'minimal' },
  { id: 'student', name: 'Student', desc: 'Education and projects first', accent: '#047857', style: 'student' },
  { id: 'creative', name: 'Creative', desc: 'Expressive headings and color', accent: '#c2410c', style: 'creative' },
  { id: 'professional', name: 'Professional', desc: 'Polished for internships and jobs', accent: '#1d4ed8', style: 'professional' },
] as const;

export default function ResumeBuilder() {
  const { profile, user } = useAuth();
  const [template, setTemplate] = useState<string>('modern');
  const [accent, setAccent] = useState('#4f46e5');
  const [fontStyle, setFontStyle] = useState('sans');
  const [form, setForm] = useState({
    name: profile?.full_name ?? '', email: user?.email ?? '', phone: '', location: '',
    headline: 'Student | Aspiring professional', summary: profile?.bio ?? '',
    education: '', skills: '', projects: '', experience: '', links: profile?.portfolio_url ?? '',
    certifications: '', languages: '', awards: '', interests: '', coursework: '',
  });
  const update = (key: keyof typeof form, value: string) => setForm(old => ({ ...old, [key]: value }));
  const active = templates.find(t => t.id === template) ?? templates[1];
  const studentFirst = template === 'student';
  const creative = template === 'creative';
  const minimal = template === 'minimal';
  const sections: [string, string][] = [
    ['PROFILE', form.summary],
    ['EDUCATION', form.education],
    ...(studentFirst ? [['RELEVANT COURSEWORK', form.coursework] as [string, string]] : []),
    ['SKILLS', form.skills],
    ['PROJECTS & ACHIEVEMENTS', form.projects],
    ['EXPERIENCE & LEADERSHIP', form.experience],
    ['CERTIFICATIONS', form.certifications],
    ['AWARDS & HONORS', form.awards],
    ['LANGUAGES', form.languages],
    ['INTERESTS', form.interests],
  ];

  return <div className="grid items-start gap-5 xl:grid-cols-[minmax(290px,390px)_minmax(0,1fr)]">
    <section className="resume-print-hide rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"><FileText className="h-5 w-5"/></div><div><h2 className="font-heading text-lg font-bold">Resume builder</h2><p className="text-xs text-slate-500">Choose a design, fill in your details, and preview.</p></div></div>

      <div className="mb-5">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><LayoutTemplate className="h-4 w-4"/> Choose a template</h3>
        <div className="grid grid-cols-2 gap-2">
          {templates.map(t => <button type="button" key={t.id} onClick={() => { setTemplate(t.id); setAccent(t.accent); }} className={`rounded-xl border p-3 text-left transition ${template === t.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20 dark:bg-brand-500/10' : 'border-slate-200 hover:border-slate-400 dark:border-slate-700'}`}>
            <span className="mb-2 block h-1.5 rounded-full" style={{ backgroundColor: t.accent }} />
            <span className="block text-sm font-bold">{t.name}</span><span className="mt-1 block text-[11px] leading-4 text-slate-500">{t.desc}</span>
          </button>)}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <label className={label}><span className="mb-1 flex items-center gap-1"><Palette className="h-3.5 w-3.5"/> Accent color</span><input aria-label="Resume accent color" type="color" value={accent} onChange={e=>setAccent(e.target.value)} className="h-10 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700"/></label>
        <label className={label}>Font style<select className={`${field} mt-1`} value={fontStyle} onChange={e=>setFontStyle(e.target.value)}><option value="sans">Modern sans</option><option value="serif">Classic serif</option></select></label>
      </div>

      <div className="space-y-3">
        {([['name','Full name'],['email','Email'],['phone','Phone (optional)'],['location','City / location'],['headline','Professional headline'],['links','Portfolio, LinkedIn or GitHub URL']] as const).map(([key,title])=><label key={key} className={label}>{title}<input className={`${field} mt-1`} value={form[key]} onChange={e=>update(key,e.target.value)} maxLength={180}/></label>)}
        {([['summary','Profile summary'],['education','Education'],['skills','Skills (comma separated)'],['projects','Projects and achievements'],['experience','Experience / volunteering'],['coursework','Relevant coursework'],['certifications','Certifications and courses'],['awards','Awards and honors'],['languages','Languages'],['interests','Interests (optional)']] as const).map(([key,title])=><label key={key} className={label}>{title}<textarea className={`${field} mt-1`} value={form[key]} onChange={e=>update(key,e.target.value)} rows={key==='summary'?4:3} maxLength={key==='summary'?1200:2000} placeholder={key==='education'?'Degree, institution, dates, expected graduation…':key==='projects'?'Project — what you built, tools used, measurable impact…':key==='experience'?'Role, organization, dates, accomplishments…':key==='certifications'?'Certification — issuing organization, year…':key==='coursework'?'Relevant subjects, labs or academic focus…':''}/></label>)}
      </div>
      <button onClick={()=>printWithPageStyle('size: A4; margin: 0;')} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700"><Printer className="h-4 w-4"/> Print / Save as PDF</button>
      <p className="mt-2 text-xs leading-5 text-slate-400">Use your browser’s print dialog and choose “Save as PDF”. Your draft stays in this page and is not submitted to a server.</p>
    </section>

    <section className="resume-print-area min-h-[720px] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm dark:border-slate-800" style={{ fontFamily: fontStyle === 'serif' ? 'Georgia, serif' : 'Arial, sans-serif' }}>
      <div className={`p-7 sm:p-10 ${creative ? 'text-white' : ''}`} style={creative ? { backgroundColor: accent } : {}}>
        <div className={`pb-5 ${minimal ? 'border-b border-slate-200' : 'border-b-2'}`} style={{ borderColor: creative ? 'rgba(255,255,255,.5)' : accent }}>
          <div className={template === 'modern' ? 'sm:flex sm:items-end sm:justify-between sm:gap-5' : ''}>
            <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.25em]" style={{ color: creative ? '#fff' : accent }}>{active.name} Resume</p><h1 className="break-words text-3xl font-bold tracking-tight sm:text-4xl">{form.name || 'Your Name'}</h1><p className="mt-2 text-sm font-semibold" style={{ color: creative ? '#fff' : accent }}>{form.headline || 'Professional headline'}</p></div>
            {template === 'modern' && <div className="mt-4 text-xs leading-6 text-slate-500 sm:mt-0 sm:text-right">{[form.email,form.phone,form.location].filter(Boolean).map((v,i)=><p key={i} className="break-words">{v}</p>)}</div>}
          </div>
          {(template !== 'modern' || form.links) && <p className={`mt-3 break-words text-xs ${creative ? 'text-white/90' : 'text-slate-500'}`}>{[...(template === 'modern' ? [form.links] : [form.email,form.phone,form.location,form.links])].filter(Boolean).join('  •  ')}</p>}
        </div>
        <div className={template === 'modern' ? 'grid gap-x-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]' : ''}>
          {sections.filter(([,value])=>value.trim()).map(([heading,value])=><section className={`mt-6 break-inside-avoid ${template === 'modern' && (heading === 'SKILLS' || heading === 'CERTIFICATIONS' || heading === 'LANGUAGES' || heading === 'INTERESTS') ? 'sm:col-span-1' : template === 'modern' ? 'sm:col-span-2' : ''}`} key={heading}>
            <h2 className={`pb-1 text-xs font-bold tracking-[.18em] ${creative ? 'text-slate-900' : ''} ${minimal ? 'border-0' : 'border-b'}`} style={{ color: creative ? '#334155' : accent, borderColor: creative ? '#cbd5e1' : `${accent}55` }}>{heading}</h2>
            <p className={`mt-2 whitespace-pre-wrap break-words text-sm leading-6 ${creative ? 'text-slate-700' : 'text-slate-700'}`}>{heading==='SKILLS'?value.split(/[,;]+/).map(s=>s.trim()).filter(Boolean).join('  •  '):value}</p>
          </section>)}
        </div>
        {!sections.some(([,value])=>value.trim())&&<p className="mt-8 text-sm text-slate-400">Your resume preview will update as you fill in the fields.</p>}
        <p className="resume-print-hide mt-12 flex items-center gap-2 text-xs text-slate-400"><Download className="h-3.5 w-3.5"/> Tip: use action verbs and measurable results where possible.</p>
      </div>
    </section>
  </div>;
}
