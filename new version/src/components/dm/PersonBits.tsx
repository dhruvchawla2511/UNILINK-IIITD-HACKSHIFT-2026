import { Shield } from 'lucide-react';
import PhotoAvatar from '@/components/Avatar';
import UserBadges from '@/components/UserBadges';
import { isSiteAdmin, personLabel, type DmPerson } from '@/lib/directMessages';

export function Avatar({ person, size = 'md' }: { person: Pick<DmPerson, 'full_name' | 'avatar_url'>; size?: 'sm' | 'md' }) {
  return <PhotoAvatar name={person.full_name} url={person.avatar_url} className={size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'} fallbackClass="bg-brand-500" />;
}

/** "Admin" badge for website admins, otherwise the person's rank or "Student". Then the college. */
export function PersonLine({ person }: { person: DmPerson }) {
  return (
    <p className="text-xs text-slate-400 truncate flex items-center gap-1">
      {isSiteAdmin(person) && <Shield className="w-3 h-3 text-accent-500 shrink-0" />}
      <span className="truncate">{[personLabel(person), person.college_name].filter(Boolean).join(' · ')}</span>
      <UserBadges userId={person.id} max={2} compact />
    </p>
  );
}
