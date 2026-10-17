import { useState } from 'react';
import { Building2 } from 'lucide-react';

const SIZES = {
  sm: 'w-12 h-12 rounded-xl',
  md: 'w-14 h-14 rounded-xl',
  lg: 'w-20 h-20 rounded-2xl',
};
const ICONS = { sm: 'w-6 h-6', md: 'w-7 h-7', lg: 'w-10 h-10' };

/** Picture sources to try, in order: the saved logo, then the website's own icon (looked up from its domain). */
function sourcesFor(src?: string | null, domain?: string | null) {
  const list: string[] = [];
  if (src) list.push(src);
  const d = domain?.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (d) list.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=256`);
  return list;
}

/**
 * A college's logo in a rounded tile. Uses the saved logo if there is one, otherwise the college website's icon
 * (from its domain). Falls back to the building icon when neither loads (broken link, or the device is offline).
 */
export default function CollegeLogo({ src, domain, name, size = 'md' }: { src?: string | null; domain?: string | null; name?: string; size?: keyof typeof SIZES }) {
  const sources = sourcesFor(src, domain);
  const key = sources.join('|');
  const [state, setState] = useState<{ key: string; index: number }>({ key, index: 0 });
  const index = state.key === key ? state.index : 0; // start over if the college changes
  const current = sources[index];
  const show = !!current;
  return (
    <div
      className={`${SIZES[size]} shrink-0 flex items-center justify-center overflow-hidden ${
        show ? 'bg-white border border-slate-200 dark:border-slate-700' : 'bg-gradient-to-br from-brand-100 dark:from-brand-500/20 to-brand-200 dark:to-brand-500/30'
      }`}
    >
      {show ? (
        <img
          key={current}
          src={current}
          alt={name ? `${name} logo` : ''}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setState({ key, index: index + 1 })}
          className="w-full h-full object-contain p-1.5"
        />
      ) : (
        <Building2 className={`${ICONS[size]} text-brand-600 dark:text-brand-400`} />
      )}
    </div>
  );
}
