import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { apiPost, supabase, type Profile, type Verification } from '@/lib/supabase';
import { canVerifyStudents } from '@/lib/collegeRoles';

/** "Verify students" panel for college officers: pending requests for their own college only. */
export default function CollegeVerifications({ viewer }: { viewer: Profile }) {
  const [requests, setRequests] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const allowed = canVerifyStudents(viewer);

  const load = useCallback(async () => {
    if (!viewer.college_id) return;
    const { data } = await supabase
      .from('verifications')
      .select('*, user:profiles!user_id(*)')
      .eq('college_id', viewer.college_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (data) setRequests((data as Verification[]).filter((v) => v.user_id !== viewer.id));
    setLoading(false);
  }, [viewer.college_id, viewer.id]);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  if (!allowed) return null;

  const resolve = async (id: string, status: 'approved' | 'rejected') => {
    setBusyId(id);
    setError(null);
    const { error } = await apiPost('/api/verifications/resolve', { id, status });
    setBusyId(null);
    if (error) setError(error.message);
    load();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <BadgeCheck className="w-4 h-4 text-brand-600 dark:text-brand-400" />
        <h3 className="font-heading font-semibold text-slate-900 dark:text-slate-100">
          Verify students{viewer.college ? ` · ${viewer.college.name}` : ''}
        </h3>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        Approve students who really belong to your college. Verified students can see your college chats. You only see requests for your own college.
      </p>
      {error && <div className="mb-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2">{error}</div>}
      {loading ? (
        <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-brand-500" /></div>
      ) : requests.length === 0 ? (
        <p className="text-sm text-slate-400">No pending requests.</p>
      ) : (
        <div className="space-y-2">
          {requests.map((v) => (
            <div key={v.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl">
              <div className="w-9 h-9 bg-gradient-to-br from-slate-300 to-slate-400 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0">
                {v.user?.full_name?.charAt(0).toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{v.user?.full_name}</p>
                <p className="text-xs text-slate-400 truncate">{v.user?.email}</p>
              </div>
              <button disabled={busyId === v.id} onClick={() => resolve(v.id, 'approved')}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-accent-50 dark:bg-accent-500/10 hover:bg-accent-100 dark:hover:bg-accent-500/20 text-accent-700 dark:text-accent-300 text-xs font-medium rounded-xl transition-colors disabled:opacity-50">
                <CheckCircle2 className="w-3.5 h-3.5" /> Approve
              </button>
              <button disabled={busyId === v.id} onClick={() => resolve(v.id, 'rejected')}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium rounded-xl transition-colors disabled:opacity-50">
                <XCircle className="w-3.5 h-3.5" /> Reject
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
