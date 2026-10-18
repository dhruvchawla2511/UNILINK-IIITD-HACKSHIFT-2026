import { BadgeCheck, BookOpen, Crown, Flag, GraduationCap, Heart, Shield, Sparkles, Star, Users, type LucideIcon } from 'lucide-react';
import { useUserBadges, type Badge } from '@/lib/badges';

const ICONS: Record<string, LucideIcon> = {
  'badge-check': BadgeCheck, 'graduation-cap': GraduationCap, star: Star, 'book-open': BookOpen, shield: Shield,
  sparkles: Sparkles, crown: Crown, heart: Heart, flag: Flag, users: Users,
};

export const BADGE_STYLES: Record<string, string> = {
  slate: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
  blue: 'bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300',
  emerald: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  amber: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300',
  rose: 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300',
  violet: 'bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300',
  sky: 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300',
};

/** One badge pill. `compact` hides the text and shows only the icon (the name stays in the tooltip). */
export function BadgePill({ badge, compact = false }: { badge: Pick<Badge, 'label' | 'color' | 'icon' | 'description'>; compact?: boolean }) {
  const Icon = ICONS[badge.icon] ?? BadgeCheck;
  return (
    <span
      title={badge.description ? `${badge.label}: ${badge.description}` : badge.label}
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none whitespace-nowrap shrink-0 ${BADGE_STYLES[badge.color] ?? BADGE_STYLES.blue}`}
    >
      <Icon className="w-3 h-3" aria-hidden />
      {compact ? <span className="sr-only">{badge.label}</span> : badge.label}
    </span>
  );
}

/** The badges a person holds, shown next to their name. Renders nothing when they have none. */
export default function UserBadges({ userId, max = 3, compact = false, className = '' }: { userId: string | null | undefined; max?: number; compact?: boolean; className?: string }) {
  const badges = useUserBadges(userId);
  if (!badges.length) return null;
  const shown = badges.slice(0, max);
  const rest = badges.slice(max);
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 align-middle ${className}`}>
      {shown.map((b) => <BadgePill key={b.id} badge={b} compact={compact} />)}
      {rest.length > 0 && (
        <span title={rest.map((b) => b.label).join(', ')} className="rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-slate-500 dark:text-slate-400">
          +{rest.length}
        </span>
      )}
    </span>
  );
}
