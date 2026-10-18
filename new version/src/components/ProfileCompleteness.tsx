import { CheckCircle2, Circle } from 'lucide-react';
import type { Profile } from '@/lib/supabase';

type Step = { key: string; label: string; hint: string; done: boolean };

/** What a complete profile has. Kept in one place so the percentage and the checklist always agree. */
export function completenessSteps(p: Profile): Step[] {
  return [
    { key: 'photo', label: 'Profile photo', hint: 'Tap the camera on your picture', done: !!p.avatar_url },
    { key: 'bio', label: 'Short bio', hint: 'Write a line or two about yourself (10+ characters)', done: (p.bio ?? '').trim().length >= 10 },
    { key: 'college', label: 'College', hint: 'Choose your college below', done: !!p.college_id },
    { key: 'verified', label: 'Verified student', hint: 'Request verification for your college', done: !!p.is_verified && !!p.college_id },
    { key: 'link', label: 'A link', hint: 'Add LinkedIn, GitHub or a portfolio', done: !!(p.linkedin_url || p.github_url || p.portfolio_url) },
  ];
}

export const completenessPercent = (p: Profile) => {
  const steps = completenessSteps(p);
  return Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
};

/** Progress bar plus checklist. Collapses to one line once the profile is complete. */
export default function ProfileCompleteness({ profile }: { profile: Profile }) {
  const steps = completenessSteps(profile);
  const pct = completenessPercent(profile);

  if (pct === 100) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="w-4 h-4" /> Your profile is complete
      </div>
    );
  }
  const next = steps.find((s) => !s.done);
  return (
    <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
      <div className="flex items-center justify-between text-sm">
        <p className="font-medium text-slate-800 dark:text-slate-200">Profile {pct}% complete</p>
        {next && <p className="text-xs text-slate-500 dark:text-slate-400">Next: {next.label}</p>}
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completeness">
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {steps.map((s) => (
          <li key={s.key} className={`flex items-start gap-2 text-xs ${s.done ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
            {s.done ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />}
            <span><span className={s.done ? 'line-through' : 'font-medium'}>{s.label}</span>{!s.done && <span className="text-slate-400"> · {s.hint}</span>}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
