import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { supabase, type CollegeRole, type Profile } from '@/lib/supabase';
import { COLLEGE_ROLE_LABEL, assignableRoles, canChangeRankOf } from '@/lib/collegeRoles';

interface Props {
  viewer: Profile;
  target: Profile;
  onChanged: () => void;
}

/** Rank dropdown for one member. Only shows ranks the viewer is allowed to hand out. */
export default function RankEditor({ viewer, target, onChanged }: Props) {
  const [role, setRole] = useState<CollegeRole>(target.college_role);
  const [committee, setCommittee] = useState(target.committee_name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canChangeRankOf(viewer, target)) return null;

  const options = assignableRoles(viewer);
  const dirty = role !== target.college_role || (role === 'committee_head' && committee.trim() !== (target.committee_name ?? ''));
  const needsCommittee = role === 'committee_head';

  const save = async () => {
    setError(null);
    if (needsCommittee && !committee.trim()) {
      setError('Enter the committee name');
      return;
    }
    setSaving(true);
    const { data, error: err } = await supabase
      .from('profiles')
      .update({ college_role: role, committee_name: needsCommittee ? committee.trim() : null })
      .eq('id', target.id)
      .select('id');
    setSaving(false);
    if (err) return setError(err.message);
    if (!data || data.length === 0) return setError('You are not allowed to change this member\'s rank');
    onChanged();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as CollegeRole)}
          className="text-xs px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          {options.map((r) => (
            <option key={r} value={r}>{COLLEGE_ROLE_LABEL[r]}</option>
          ))}
        </select>
        {needsCommittee && (
          <input
            type="text"
            value={committee}
            maxLength={60}
            onChange={(e) => setCommittee(e.target.value)}
            placeholder="Committee name"
            className="text-xs px-2 py-1.5 w-36 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        )}
        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-medium rounded-xl transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Save
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
