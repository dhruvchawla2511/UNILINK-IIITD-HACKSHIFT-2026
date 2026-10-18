import { useEffect, useState } from 'react';
import { fileUrl } from '@/lib/supabase';

/** Profile photo, or the person's initial when they have none (or it fails to load). Photos are visible to everyone signed in. */
export default function Avatar({ name, url, className = 'w-8 h-8 text-xs', fallbackClass = 'bg-slate-400' }: { name?: string | null; url?: string | null; className?: string; fallbackClass?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (url && !failed) {
    return <img src={url.startsWith('/api/files/') ? fileUrl(url) : url} alt="" loading="lazy" onError={() => setFailed(true)} className={`${className} rounded-full object-cover shrink-0`} />;
  }
  return <div className={`${className} ${fallbackClass} rounded-full text-white font-semibold flex items-center justify-center shrink-0`}>{name?.trim().charAt(0).toUpperCase() || '?'}</div>;
}
