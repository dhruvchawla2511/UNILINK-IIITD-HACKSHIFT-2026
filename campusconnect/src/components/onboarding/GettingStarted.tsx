import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Globe, KeyRound, MessageSquare } from 'lucide-react';
import { supabase, type ChatRoom, type Profile, type Verification } from '@/lib/supabase';
import { isGlobalAdmin } from '@/lib/collegeRoles';
import type { Step } from './OnboardingWizard';

/** What the chat page shows when no room is open: the next steps for new people, a short nudge for everyone else. */
export default function GettingStarted({
  profile,
  quickRooms,
  onOpenStep,
  onOpenRoom,
}: {
  profile: Profile;
  quickRooms: ChatRoom[];
  onOpenStep: (step: Step) => void;
  onOpenRoom: (room: ChatRoom) => void;
}) {
  const [latest, setLatest] = useState<Verification | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('verifications').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(1);
      setLatest((data?.[0] as Verification) ?? null);
    })();
  }, [profile.id, profile.college_id, profile.is_verified]);

  const hasCollege = !!profile.college_id;
  const verified = profile.is_verified && hasCollege;
  const pending = latest?.status === 'pending' && latest.college_id === profile.college_id;
  const firstName = profile.full_name.split(' ')[0] || 'there';
  const complete = verified || isGlobalAdmin(profile);

  const quick = quickRooms.length > 0 && (
    <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
      <p className="text-xs text-slate-400 mb-2">{complete ? 'Or open a global room' : 'Or just jump in'}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {quickRooms.map((r) => (
          <button
            key={r.id}
            onClick={() => onOpenRoom(r)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-500/10 text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 text-xs font-medium rounded-full transition-colors"
          >
            <Globe className="w-3.5 h-3.5" /> {r.name}
          </button>
        ))}
      </div>
    </div>
  );

  if (complete) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Pick a room from the list to start chatting.</p>
          <button
            onClick={() => onOpenStep(3)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-50 dark:bg-brand-500/10 hover:bg-brand-100 dark:hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 text-sm font-medium rounded-xl transition-colors"
          >
            <KeyRound className="w-4 h-4" /> Join with a room code
          </button>
        </div>
      </div>
    );
  }

  const steps: { n: Step; title: string; text: string; done: boolean; waiting?: boolean; action: string | null }[] = [
    {
      n: 1,
      title: 'Choose your college',
      text: hasCollege ? profile.college?.name ?? 'College chosen' : 'Pick it from the college directory',
      done: hasCollege,
      action: hasCollege ? 'Change' : 'Choose',
    },
    {
      n: 2,
      title: 'Get verified',
      text: verified
        ? 'You can see your college chats'
        : pending
          ? 'Waiting for approval from an officer of your college or an admin'
          : hasCollege
            ? 'Needed to see your college chats'
            : 'Choose your college first',
      done: verified,
      waiting: pending,
      action: verified || pending ? null : hasCollege ? 'Request' : null,
    },
    {
      n: 3,
      title: 'Join a room with a code',
      text: 'Got a 6-digit code from a friend or a club? Enter it here',
      done: false,
      action: 'Enter code',
    },
  ];

  return (
    <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
      <div className="w-full max-w-md text-center">
        <h2 className="font-heading text-xl font-semibold text-slate-900 dark:text-slate-100">Welcome, {firstName}!</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-5">A few steps to start chatting with your college.</p>
        <div className="space-y-2 text-left">
          {steps.map((s) => (
            <div key={s.n} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                  s.done ? 'bg-accent-500 text-white' : s.waiting ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {s.done ? <CheckCircle2 className="w-4 h-4" /> : s.waiting ? <Clock className="w-4 h-4" /> : s.n}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{s.title}</p>
                <p className="text-xs text-slate-400 truncate">{s.text}</p>
              </div>
              {s.action && (
                <button
                  onClick={() => onOpenStep(s.n)}
                  className="px-3 py-1.5 bg-brand-50 dark:bg-brand-500/10 hover:bg-brand-100 dark:hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 text-xs font-medium rounded-xl transition-colors shrink-0"
                >
                  {s.action}
                </button>
              )}
            </div>
          ))}
        </div>
        {quick}
      </div>
    </div>
  );
}
