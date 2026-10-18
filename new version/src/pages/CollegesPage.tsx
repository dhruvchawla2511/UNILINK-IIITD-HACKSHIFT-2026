import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type College, type Profile } from '@/lib/supabase';
import { Building2, MapPin, Users, Search, Loader2, Plus, X, Globe, MailQuestion } from 'lucide-react';
import CollegeFormModal from '@/components/CollegeFormModal';
import CollegeLogo from '@/components/CollegeLogo';
import RequestCollegeModal from '@/components/RequestCollegeModal';
import TierBadge, { placeLine } from '@/components/TierBadge';

const TIERS = ['Tier 1', 'Tier 2', 'Elite'];

export default function CollegesPage() {
  const { profile } = useAuth();
  const [colleges, setColleges] = useState<College[]>([]);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<College | null>(null);
  const [memberCount, setMemberCount] = useState<Record<string, number>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [roomCounts, setRoomCounts] = useState<Record<string, number>>({});
  const [collegeMembers, setCollegeMembers] = useState<Profile[]>([]);

  const loadColleges = useCallback(async () => {
    const { data } = await supabase.from('colleges').select('*').order('name');
    if (data) {
      setColleges(data as College[]);

      // Student and room counts: two light requests in total, counted here (not one request per college)
      const [{ data: people }, { data: rooms }] = await Promise.all([
        supabase.from('profiles').select('college_id'),
        supabase.from('chat_rooms').select('college_id'),
      ]);
      const tally = (rows: { college_id: string | null }[] | null) => {
        const out: Record<string, number> = {};
        for (const r of rows ?? []) if (r.college_id) out[r.college_id] = (out[r.college_id] ?? 0) + 1;
        return out;
      };
      setMemberCount(tally(people));
      setRoomCounts(tally(rooms));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadColleges();
  }, [loadColleges]);

  const loadCollegeDetail = useCallback(async (college: College) => {
    setSelected(college);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('college_id', college.id)
      .order('full_name');
    if (data) setCollegeMembers(data as Profile[]);
  }, []);

  // Search by name, city, state, country, tier, website or description (so "IIT" or "Karnataka" both work)
  const needle = search.trim().toLowerCase();
  const filtered = colleges.filter(
    (c) =>
      (!tierFilter || c.tier === tierFilter) &&
      (!countryFilter || c.country === countryFilter) &&
      (!needle || [c.name, c.city, c.state, c.country, c.tier, c.domain, c.description].some((v) => v?.toLowerCase().includes(needle)))
  );
  const countries = [...new Set(colleges.map((c) => c.country).filter((v): v is string => !!v))].sort();
  const tiersInUse = TIERS.filter((t) => colleges.some((c) => c.tier === t));

  const canManage = profile?.role === 'admin' || profile?.role === 'super_admin';

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-6xl mx-auto p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-heading text-3xl font-semibold text-slate-900 dark:text-slate-100">College Directory</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Discover colleges and their student communities</p>
          </div>
          {canManage ? (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" /> Add College
            </button>
          ) : (
            <button
              onClick={() => setShowRequest(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-xl transition-colors"
            >
              <MailQuestion className="w-4 h-4" /> <span className="hidden sm:inline">Can't find yours?</span> Request college
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by college, city, state or country (e.g. IIT, Pune, Japan)..."
            className="w-full pl-10 pr-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {['', ...tiersInUse].map((t) => (
            <button
              key={t || 'all'}
              onClick={() => setTierFilter(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                tierFilter === t
                  ? 'bg-brand-600 text-white'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {t || 'All colleges'}
            </button>
          ))}
          {countries.length > 1 && (
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="ml-auto px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              <option value="">All countries</option>
              {countries.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <span className="text-xs text-slate-400">{filtered.length} {filtered.length === 1 ? 'college' : 'colleges'}</span>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No colleges found</p>
            {!canManage && (
              <button onClick={() => setShowRequest(true)} className="mt-3 text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline">
                Not listed? Request {search.trim() ? `"${search.trim()}"` : 'your college'}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((college) => (
              <button
                key={college.id}
                onClick={() => loadCollegeDetail(college)}
                className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-left hover:shadow-lg hover:border-brand-200 dark:hover:border-brand-500/40 transition-all animate-fade-in"
              >
                <div className="flex items-start gap-3 mb-3">
                  <CollegeLogo src={college.logo_url} domain={college.domain} name={college.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-heading font-semibold text-slate-900 dark:text-slate-100 text-sm leading-tight group-hover:text-brand-700 transition-colors">
                      {college.name}
                    </h3>
                    {college.tier && <div className="mt-1"><TierBadge tier={college.tier} /></div>}
                    {college.domain && (
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Globe className="w-3 h-3" /> {college.domain}
                      </p>
                    )}
                  </div>
                </div>
                {college.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">{college.description}</p>
                )}
                {placeLine(college) && (
                  <p className="text-xs text-slate-400 flex items-center gap-1 mb-2">
                    <MapPin className="w-3 h-3" /> {placeLine(college)}
                  </p>
                )}
                <div className="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <Users className="w-3.5 h-3.5" /> {memberCount[college.id] ?? 0} students
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <Building2 className="w-3.5 h-3.5" /> {roomCounts[college.id] ?? 0} rooms
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelected(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between">
              <div className="flex items-start gap-4">
                <CollegeLogo src={selected.logo_url} domain={selected.domain} name={selected.name} size="lg" />
                <div>
                  <h2 className="font-heading text-xl font-semibold text-slate-900 dark:text-slate-100">{selected.name}</h2>
                  {selected.domain && <p className="text-sm text-slate-400">{selected.domain}</p>}
                  {placeLine(selected) && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                      <MapPin className="w-3.5 h-3.5" /> {placeLine(selected)}
                    </p>
                  )}
                  {selected.tier && <div className="mt-1.5"><TierBadge tier={selected.tier} /></div>}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            {selected.description && (
              <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800">
                <p className="text-sm text-slate-600 dark:text-slate-300">{selected.description}</p>
              </div>
            )}

            <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                Students ({collegeMembers.length})
              </h3>
              {collegeMembers.length === 0 ? (
                <p className="text-sm text-slate-400">No students associated yet.</p>
              ) : (
                <div className="space-y-2">
                  {collegeMembers.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl">
                      <div className="w-8 h-8 bg-gradient-to-br from-slate-300 to-slate-400 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                        {m.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{m.full_name}</p>
                        {m.email && <p className="text-xs text-slate-400 truncate">{m.email}</p>}
                      </div>
                      {m.is_verified && (
                        <span className="text-xs text-accent-600 dark:text-accent-400 font-medium">Verified</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showRequest && !canManage && <RequestCollegeModal initialName={search.trim()} onClose={() => setShowRequest(false)} />}

      {/* Create college modal */}
      {showCreate && canManage && (
        <CollegeFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => { loadColleges(); setShowCreate(false); }}
        />
      )}
    </div>
  );
}
