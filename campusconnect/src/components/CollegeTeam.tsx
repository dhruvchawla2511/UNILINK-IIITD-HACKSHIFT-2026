import { useCallback, useEffect, useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import { supabase, type Profile } from '@/lib/supabase';
import { COLLEGE_RANK, COLLEGE_ROLE_HELP, COLLEGE_ROLE_LABEL, assignableRoles, officerLevel, rankLabel } from '@/lib/collegeRoles';
import RankEditor from '@/components/RankEditor';

/** "College Team" panel for a president / vice president: members of their own college and their ranks. */
export default function CollegeTeam({ viewer }: { viewer: Profile }) {
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!viewer.college_id) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('college_id', viewer.college_id)
      .eq('is_verified', true)
      .order('full_name');
    if (data) {
      const list = data as Profile[];
      list.sort((a, b) => COLLEGE_RANK[b.college_role] - COLLEGE_RANK[a.college_role] || a.full_name.localeCompare(b.full_name));
      setMembers(list);
    }
    setLoading(false);
  }, [viewer.college_id]);

  useEffect(() => {
    load();
  }, [load]);

  if (officerLevel(viewer) < COLLEGE_RANK.vice_president) return null;
  const canGive = assignableRoles(viewer).filter((r) => r !== 'member');

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Users className="w-4 h-4 text-brand-600 dark:text-brand-400" />
        <h3 className="font-heading font-semibold text-slate-900 dark:text-slate-100">
          College Team{viewer.college ? ` · ${viewer.college.name}` : ''}
        </h3>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        You can give {canGive.map((r) => COLLEGE_ROLE_LABEL[r]).join(', ')} ranks to verified members of your college. This only applies inside your college.
      </p>

      {loading ? (
        <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-brand-500" /></div>
      ) : members.length === 0 ? (
        <p className="text-sm text-slate-400">No verified members yet.</p>
      ) : (
        <div className="space-y-2">
          {members.map((m) => {
            const label = rankLabel(m);
            return (
              <div key={`${m.id}-${m.college_role}-${m.committee_name}`} className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl">
                <div className="w-9 h-9 bg-gradient-to-br from-slate-300 to-slate-400 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0">
                  {m.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {m.full_name}{m.id === viewer.id ? ' (you)' : ''}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{label ?? 'Member'}</p>
                </div>
                <RankEditor viewer={viewer} target={m} onChanged={load} />
              </div>
            );
          })}
        </div>
      )}

      <details className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        <summary className="cursor-pointer select-none">What can each rank do?</summary>
        <ul className="mt-2 space-y-1">
          {(['president', 'vice_president', 'secretary', 'committee_head'] as const).map((r) => (
            <li key={r}><strong className="text-slate-700 dark:text-slate-300">{COLLEGE_ROLE_LABEL[r]}:</strong> {COLLEGE_ROLE_HELP[r]}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
