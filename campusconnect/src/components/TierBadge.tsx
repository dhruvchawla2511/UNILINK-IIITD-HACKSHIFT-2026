const STYLES: Record<string, string> = {
  'Tier 1': 'bg-accent-50 dark:bg-accent-500/10 text-accent-700 dark:text-accent-300',
  'Tier 2': 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300',
  Elite: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300',
};

/** Small label for a college's tier (Tier 1, Tier 2 or Elite). Renders nothing when there is none. */
export default function TierBadge({ tier }: { tier: string | null | undefined }) {
  if (!tier) return null;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${STYLES[tier] ?? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
      {tier}
    </span>
  );
}

/** "Mumbai, Maharashtra, India" from whatever parts a college has. */
export const placeLine = (c: { city: string | null; state: string | null; country: string | null }) =>
  [c.city, c.state, c.country].filter(Boolean).join(', ');
