import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, KeyRound, Loader2, MessageSquare, Search, Send, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiPost, supabase, type ChatRoom, type College, type Verification } from '@/lib/supabase';
import TierBadge, { placeLine } from '@/components/TierBadge';
import CollegeLogo from '@/components/CollegeLogo';
import RequestCollegeModal from '@/components/RequestCollegeModal';

export type Step = 1 | 2 | 3;

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: 'College' },
  { n: 2, label: 'Verify' },
  { n: 3, label: 'Join a room' },
];
const SHOW_MAX = 40;

const primary =
  'flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors';
const quiet =
  'flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors';

/**
 * The new-user guide: 1. choose your college  2. ask to be verified  3. join a room with a code.
 * Every step can be skipped; the person can always come back from the chat page.
 */
export default function OnboardingWizard({
  initialStep = 1,
  onClose,
  onFinish,
}: {
  initialStep?: Step;
  onClose: () => void; // closed or skipped
  onFinish: (room?: ChatRoom) => void; // finished; optionally a room to open
}) {
  const { profile, refreshProfile } = useAuth();
  const [step, setStep] = useState<Step>(initialStep);
  const [colleges, setColleges] = useState<College[]>([]);
  const [loadingColleges, setLoadingColleges] = useState(true);
  const [search, setSearch] = useState('');
  const [chosen, setChosen] = useState(profile?.college_id ?? '');
  const [notListed, setNotListed] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [globalRoom, setGlobalRoom] = useState<ChatRoom | null>(null);
  const [code, setCode] = useState('');
  const [joined, setJoined] = useState<ChatRoom | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVerifications = async () => {
    if (!profile) return;
    const { data } = await supabase.from('verifications').select('*').eq('user_id', profile.id).order('created_at', { ascending: false });
    if (data) setVerifications(data as Verification[]);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('colleges').select('*').order('name');
      if (data) setColleges(data as College[]);
      setLoadingColleges(false);
    })();
    loadVerifications();
    (async () => {
      const { data } = await supabase.from('chat_rooms').select('*').eq('room_type', 'global').order('created_at', { ascending: true }).limit(1);
      if (data?.[0]) setGlobalRoom(data[0] as ChatRoom);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!profile) return null;

  const firstName = profile.full_name.split(' ')[0] || 'there';
  const collegeOf = (id: string | null | undefined) => colleges.find((c) => c.id === id) ?? null;
  const chosenCollege = collegeOf(chosen) ?? (profile.college_id === chosen ? profile.college ?? null : null);
  const verifiedHere = profile.is_verified && profile.college_id === chosen;
  const forChosen = verifications.find((v) => v.college_id === chosen) ?? null;
  const pendingElsewhere = verifications.find((v) => v.status === 'pending' && v.college_id !== chosen) ?? null;

  const needle = search.trim().toLowerCase();
  const matches = colleges.filter(
    (c) => !needle || [c.name, c.city, c.state, c.country, c.tier, c.description].some((v) => v?.toLowerCase().includes(needle))
  );

  const stepDone = (n: Step) => (n === 1 ? !!profile.college_id : n === 2 ? profile.is_verified : !!joined);

  // ---- step 1 ----
  const saveCollege = async () => {
    if (!chosen) return;
    setError(null);
    if (chosen !== profile.college_id) {
      if (profile.is_verified && !window.confirm('Changing your college removes your verified status until the new college verifies you. Continue?')) return;
      setBusy(true);
      const { error } = await supabase.from('profiles').update({ college_id: chosen }).eq('id', profile.id);
      if (error) {
        setBusy(false);
        return setError(error.message);
      }
      await refreshProfile();
      setBusy(false);
    }
    setStep(2);
  };

  // ---- step 2 ----
  const requestVerification = async () => {
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('verifications').insert({ user_id: profile.id, college_id: chosen });
    if (error) setError(error.message);
    await loadVerifications();
    setBusy(false);
  };

  // ---- step 3 ----
  const joinWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return setError('Enter the 6-digit room code');
    setBusy(true);
    setError(null);
    const { data, error } = await apiPost<ChatRoom>('/api/chat/room/join', { code });
    setBusy(false);
    if (error || !data) return setError(error?.message ?? 'Could not join that room');
    setJoined(data);
  };

  const goTo = (n: Step) => {
    setError(null);
    setStep(n);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 animate-fade-in">
      {showRequest && <RequestCollegeModal initialName={search.trim()} onClose={() => setShowRequest(false)} />}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col animate-slide-up">
        {/* Header + progress */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-heading text-xl font-semibold text-slate-900 dark:text-slate-100">
                {step === 1 ? `Welcome, ${firstName}!` : step === 2 ? 'Get verified' : 'Join a room'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {step === 1 && 'Let us connect you with your college in three quick steps.'}
                {step === 2 && 'Verified students can see their college chats.'}
                {step === 3 && 'Have a 6-digit code from a friend or your college? Use it here.'}
              </p>
            </div>
            <button onClick={onClose} title="Close" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-4">
            {STEPS.map((s, i) => (
              <div key={s.n} className="flex items-center gap-2 flex-1 last:flex-none">
                <button
                  onClick={() => goTo(s.n)}
                  className={`flex items-center gap-1.5 text-xs font-medium ${step === s.n ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] shrink-0 ${
                      stepDone(s.n) ? 'bg-accent-500 text-white' : step === s.n ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {stepDone(s.n) ? <Check className="w-3.5 h-3.5" /> : s.n}
                  </span>
                  {s.label}
                </button>
                {i < STEPS.length - 1 && <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto scrollbar-thin flex-1">
          {step === 1 && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search your college (e.g. IIT Madras, Pune, Japan)"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </div>
              {loadingColleges ? (
                <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-brand-500" /></div>
              ) : matches.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">No college matches "{search}".</p>
              ) : (
                <div className="space-y-1.5">
                  {matches.slice(0, SHOW_MAX).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setChosen(c.id)}
                      className={`w-full flex items-center gap-3 p-2.5 text-left rounded-xl border transition-colors ${
                        chosen === c.id
                          ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <CollegeLogo src={c.logo_url} domain={c.domain} name={c.name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{c.name}</p>
                        <p className="text-xs text-slate-400 truncate">{placeLine(c) || 'No location'}</p>
                      </div>
                      <TierBadge tier={c.tier} />
                      {chosen === c.id && <CheckCircle2 className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />}
                    </button>
                  ))}
                  {matches.length > SHOW_MAX && (
                    <p className="text-xs text-slate-400 text-center pt-1">Showing {SHOW_MAX} of {matches.length}. Type more of the name to narrow it down.</p>
                  )}
                </div>
              )}
              <button onClick={() => setNotListed((v) => !v)} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
                My college isn't listed
              </button>
              {notListed && (
                <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
                  Send us its name and an admin will add it. Meanwhile you can still use the global chat, and join private rooms with a code.
                  <button onClick={() => setShowRequest(true)} className="block mt-1.5 font-medium text-brand-600 dark:text-brand-400 hover:underline">Request my college</button>
                  <button onClick={() => goTo(3)} className="block mt-1.5 font-medium text-brand-600 dark:text-brand-400 hover:underline">Continue without a college</button>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {!chosenCollege ? (
                <div className="text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 rounded-xl p-4">
                  Choose your college first, then you can ask to be verified.
                  <button onClick={() => goTo(1)} className="block mt-2 font-medium text-brand-600 dark:text-brand-400 hover:underline">Choose a college</button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl">
                    <CollegeLogo src={chosenCollege.logo_url} domain={chosenCollege.domain} name={chosenCollege.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{chosenCollege.name}</p>
                      <p className="text-xs text-slate-400 truncate">{placeLine(chosenCollege) || 'Your college'}</p>
                    </div>
                    <button onClick={() => goTo(1)} className="text-xs text-brand-600 dark:text-brand-400 hover:underline shrink-0">Change</button>
                  </div>

                  {verifiedHere ? (
                    <div className="flex items-start gap-3 p-4 bg-accent-50 dark:bg-accent-500/10 border border-accent-200 dark:border-accent-500/30 rounded-xl">
                      <CheckCircle2 className="w-5 h-5 text-accent-600 dark:text-accent-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-accent-800 dark:text-accent-200">You're verified</p>
                        <p className="text-xs text-accent-700 dark:text-accent-300 mt-0.5">You can see and join the {chosenCollege.name} chats.</p>
                      </div>
                    </div>
                  ) : forChosen?.status === 'pending' ? (
                    <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl">
                      <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Request sent. Waiting for approval</p>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                          An officer of {chosenCollege.name} or an admin will review it. Your college chats open automatically once you're approved. You don't need to wait here.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1.5">
                        <p>You can already chat in the {chosenCollege.name} Lobby and in General. The verified-only college chats are private to students of that college, so to get in, ask to be verified. An officer of {chosenCollege.name}, or an admin, will confirm you study there.</p>
                      </div>
                      {forChosen?.status === 'rejected' && (
                        <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2">
                          Your last request for this college was not approved. Check that you picked the right college, then you can ask again.
                        </div>
                      )}
                      {pendingElsewhere && (
                        <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-3 py-2">
                          You already have a request waiting for {collegeOf(pendingElsewhere.college_id)?.name ?? 'another college'}. You can send a new one after it is answered.
                        </div>
                      )}
                      <button onClick={requestVerification} disabled={busy || !!pendingElsewhere} className={`${primary} w-full`}>
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Request verification
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {joined ? (
                <div className="flex items-start gap-3 p-4 bg-accent-50 dark:bg-accent-500/10 border border-accent-200 dark:border-accent-500/30 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-accent-600 dark:text-accent-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-accent-800 dark:text-accent-200">You joined {joined.name}</p>
                    <p className="text-xs text-accent-700 dark:text-accent-300 mt-0.5">Press the button below to open it.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={joinWithCode} className="space-y-3">
                  <input
                    autoFocus
                    inputMode="numeric"
                    autoComplete="off"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full px-3 py-3 text-center text-2xl font-mono font-semibold tracking-[0.4em] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                  <button type="submit" disabled={busy || code.length !== 6} className={`${primary} w-full`}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Join room
                  </button>
                  <p className="text-xs text-slate-400">Every chat room has its own code, shown at the top of the room. You can always join more rooms later with the key button in Chat.</p>
                </form>
              )}
            </div>
          )}

          {error && (
            <div className="mt-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
          {step > 1 ? (
            <button onClick={() => goTo((step - 1) as Step)} className={quiet}><ArrowLeft className="w-4 h-4" /> Back</button>
          ) : (
            <button onClick={onClose} className={quiet}>Skip for now</button>
          )}
          <div className="flex-1" />
          {step === 1 && (
            <button onClick={saveCollege} disabled={!chosen || busy} className={primary}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
            </button>
          )}
          {step === 2 && (
            <button onClick={() => goTo(3)} className={primary}>
              {verifiedHere || forChosen?.status === 'pending' ? 'Continue' : 'Skip for now'} <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {step === 3 &&
            (joined ? (
              <button onClick={() => onFinish(joined)} className={primary}><MessageSquare className="w-4 h-4" /> Open {joined.name}</button>
            ) : (
              <button onClick={() => onFinish(globalRoom ?? undefined)} className={primary}>
                <MessageSquare className="w-4 h-4" /> {globalRoom ? 'Open the global chat' : 'Go to chat'}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
