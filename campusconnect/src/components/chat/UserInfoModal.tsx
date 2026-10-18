import { useEffect, useState } from 'react';
import { BadgeCheck, CalendarDays, GraduationCap, Loader2, MapPin, MessageCircle, Shield, X } from 'lucide-react';
import { supabase, apiPost, type Profile, type ProfileFieldValue } from '@/lib/supabase';
import { displayFieldValue } from '@/components/ProfileFieldInput';
import { rankLabel } from '@/lib/collegeRoles';
import Avatar from '@/components/Avatar';
import UserBadges from '@/components/UserBadges';
import BadgeAwardPanel from '@/components/BadgeAwardPanel';
import { SocialLinks } from '@/components/SocialLinks';
import { useAuth } from '@/context/AuthContext';
import { useDirectMessages } from '@/context/DirectMessageContext';

const SITE_ROLE: Record<string, string> = { admin: 'Admin', super_admin: 'Super Admin' };

/** Basic public details of a person, opened by clicking their name in chat. */
export function UserInfoModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [person, setPerson] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [extra, setExtra] = useState<ProfileFieldValue[]>([]);
  const { profile: me } = useAuth();
  const { openDirectMessage } = useDirectMessages();

  useEffect(() => {
    let live = true;
    supabase
      .from('profiles')
      .select('*, college:colleges(*)')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }: { data: Profile | null }) => {
        if (!live) return;
        setPerson(data);
        setLoading(false);
      });
    return () => { live = false; };
  }, [userId]);

  useEffect(() => {
    let live = true;
    apiPost<ProfileFieldValue[]>('/api/profile/fields', { user_id: userId }).then(({ data }) => {
      if (live && data) setExtra(data.filter((f) => f.value));
    });
    return () => { live = false; };
  }, [userId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rank = rankLabel(person);
  const siteRole = person ? (person.is_owner ? 'Owner' : SITE_ROLE[person.role]) : undefined;
  const place = [person?.college?.city, person?.college?.state].filter(Boolean).join(', ');
  const joined = person ? new Date(person.created_at).toLocaleDateString([], { month: 'long', year: 'numeric' }) : '';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="h-20 bg-gradient-to-r from-brand-600 to-accent-500 relative">
          <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 p-1.5 rounded-full bg-black/20 hover:bg-black/30 text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
        ) : !person ? (
          <p className="py-12 text-center text-sm text-slate-400">This person could not be found.</p>
        ) : (
          <div className="px-6 pb-6 -mt-10">
            <Avatar name={person.full_name} url={person.avatar_url} className="w-20 h-20 text-3xl border-4 border-white dark:border-slate-900" fallbackClass="bg-brand-500" />

            <h3 className="mt-2 font-heading font-semibold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              {person.full_name}
              {person.is_verified && <BadgeCheck className="w-5 h-5 text-brand-500" aria-label="Verified student" />}
            </h3>

            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {rank && <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-accent-100 dark:bg-accent-500/20 text-accent-700 dark:text-accent-300">{rank}</span>}
              {siteRole && (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 inline-flex items-center gap-1">
                  <Shield className="w-3 h-3" /> {siteRole}
                </span>
              )}
              {!rank && !siteRole && <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-500">Student</span>}
            </div>

            <UserBadges userId={person.id} max={6} className="mt-2" />
            {me && person.id !== me.id && <div className="mt-2"><BadgeAwardPanel userId={person.id} hideWhenNone /></div>}

            {person.bio && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words">{person.bio}</p>}

            <SocialLinks person={person} className="mt-3" />

            <dl className="mt-4 space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-start gap-2.5">
                <GraduationCap className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                <dd>
                  {person.college ? person.college.name : <span className="text-slate-400">No college set</span>}
                  {person.college && !person.is_verified && <span className="text-xs text-slate-400"> (not verified)</span>}
                </dd>
              </div>
              {place && (
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                  <dd>{place}</dd>
                </div>
              )}
              {extra.map((f) => (
                <div key={f.id} className="flex items-start gap-2.5">
                  <span className="w-4 shrink-0" />
                  <dd className="min-w-0 break-words">
                    <span className="text-slate-400">{f.label}: </span>
                    {displayFieldValue(f)}
                    {f.private && <span className="text-[10px] text-slate-400"> (private)</span>}
                  </dd>
                </div>
              ))}
              <div className="flex items-start gap-2.5">
                <CalendarDays className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                <dd>Joined {joined}</dd>
              </div>
            </dl>

            {openDirectMessage && me && person.id !== me.id && (
              <button
                onClick={() => { onClose(); openDirectMessage(person.id); }}
                className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
              >
                <MessageCircle className="w-4 h-4" /> Message
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
