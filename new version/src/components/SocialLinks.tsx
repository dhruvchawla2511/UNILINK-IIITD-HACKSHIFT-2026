import { Github, Globe, Linkedin, type LucideIcon } from 'lucide-react';
import type { Profile } from '@/lib/supabase';

export type SocialKey = 'linkedin_url' | 'github_url' | 'portfolio_url';

export const SOCIAL_FIELDS: { key: SocialKey; label: string; icon: LucideIcon; placeholder: string }[] = [
  { key: 'linkedin_url', label: 'LinkedIn', icon: Linkedin, placeholder: 'linkedin.com/in/your-name' },
  { key: 'github_url', label: 'GitHub', icon: Github, placeholder: 'github.com/your-username' },
  { key: 'portfolio_url', label: 'Portfolio / website', icon: Globe, placeholder: 'https://your-site.com' },
];

/** Only ever render http(s) links, even though the server already enforces this. */
const safe = (v: string | null | undefined) => (v && /^https?:\/\//i.test(v) ? v : null);

export function hasSocialLinks(p: Partial<Pick<Profile, SocialKey>> | null | undefined) {
  return !!p && SOCIAL_FIELDS.some((f) => safe(p[f.key]));
}

/** Row of icon links (LinkedIn, GitHub, portfolio) for whichever ones the person has set. */
export function SocialLinks({ person, className = '' }: { person: Partial<Pick<Profile, SocialKey>>; className?: string }) {
  const links = SOCIAL_FIELDS.map((f) => ({ ...f, href: safe(person[f.key]) })).filter((l) => l.href);
  if (links.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {links.map(({ key, label, icon: Icon, href }) => (
        <a
          key={key}
          href={href!}
          target="_blank"
          rel="noopener noreferrer nofollow"
          title={label}
          aria-label={label}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-brand-500/10 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
        >
          <Icon className="w-3.5 h-3.5" /> {label.split(' ')[0]}
        </a>
      ))}
    </div>
  );
}
