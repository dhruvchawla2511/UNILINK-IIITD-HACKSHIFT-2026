import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, apiPost, type Verification, type Profile, type College, type CollegeRequest } from '@/lib/supabase';
import {
  Shield, CheckCircle2, XCircle, Clock, Loader2, Users,
  Building2, MessageSquare, Search, BadgeCheck, X, LayoutDashboard, ListPlus, Pencil, Trash2, Plus, FileSpreadsheet, MailQuestion, SlidersHorizontal, ScrollText, Activity, Award
} from 'lucide-react';
import Dashboard from '@/components/admin/Dashboard';
import HomeManager from '@/components/admin/HomeManager';
import ProfileFieldsManager from '@/components/admin/ProfileFieldsManager';
import CommandPermissions from '@/components/admin/CommandPermissions';
import ModerationLog from '@/components/admin/ModerationLog';
import UserBadges from '@/components/UserBadges';
import BadgesManager from '@/components/admin/BadgesManager';
import RankEditor from '@/components/RankEditor';
import CollegeFormModal from '@/components/CollegeFormModal';
import CollegeLogo from '@/components/CollegeLogo';
import CollegeRequestsPanel from '@/components/admin/CollegeRequestsPanel';
import CollegeImportModal from '@/components/admin/CollegeImportModal';
import TierBadge, { placeLine } from '@/components/TierBadge';
import { rankLabel } from '@/lib/collegeRoles';

type Tab = 'dashboard' | 'verifications' | 'students' | 'colleges' | 'requests' | 'rooms' | 'home' | 'fields' | 'commands' | 'modlog' | 'badges';

export default function AdminPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [rooms, setRooms] = useState<{ id: string; name: string; room_type: string; college?: College | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [collegeForm, setCollegeForm] = useState<{ college?: College } | null>(null);
  const [collegeSearch, setCollegeSearch] = useState('');
  const [requests, setRequests] = useState<CollegeRequest[]>([]);
  const [showImport, setShowImport] = useState(false);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isSuperAdmin = profile?.role === 'super_admin';

  const loadAll = useCallback(async () => {
    const [{ data: vData }, { data: sData }, { data: cData }, { data: rData }, { data: qData }] = await Promise.all([
      supabase.from('verifications').select('*, user:profiles!user_id(*), college:colleges(*)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*, college:colleges(*)').order('created_at', { ascending: false }),
      supabase.from('colleges').select('*').order('name'),
      supabase.from('chat_rooms').select('*, college:colleges(*)').order('created_at', { ascending: false }),
      supabase.from('college_requests').select('*, requester:profiles!requested_by(*)').order('created_at', { ascending: false }),
    ]);
    if (vData) setVerifications(vData as Verification[]);
    if (sData) setStudents(sData as Profile[]);
    if (cData) setColleges(cData as College[]);
    if (qData) setRequests(qData as CollegeRequest[]);
    if (rData) setRooms(rData as { id: string; name: string; room_type: string; college?: College | null }[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) loadAll();
    else setLoading(false);
  }, [isAdmin, loadAll]);

  const resolveVerification = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await apiPost('/api/verifications/resolve', { id, status });
    if (error) window.alert(error.message);
    loadAll();
  };

  const updateStudentRole = async (id: string, role: string) => {
    await supabase.from('profiles').update({ role }).eq('id', id);
    loadAll();
  };

  const removeVerified = async (id: string) => {
    await supabase.from('profiles').update({ is_verified: false }).eq('id', id);
    loadAll();
  };

  const deleteRoom = async (id: string) => {
    await supabase.from('chat_rooms').delete().eq('id', id);
    loadAll();
  };

  const deleteCollege = async (c: College) => {
    const n = studentsOf(c.id);
    const msg =
      `Delete ${c.name}?\n\nThis also deletes its chat rooms and their messages` +
      (n ? `, and ${n} student${n === 1 ? '' : 's'} will be left without a college.` : '.');
    if (!window.confirm(msg)) return;
    const { error } = await supabase.from('colleges').delete().eq('id', c.id);
    if (error) window.alert(error.message);
    loadAll();
  };
  const studentsOf = (collegeId: string) => students.filter((s) => s.college_id === collegeId).length;

  if (!isAdmin) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        <div className="text-center">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Admin access required</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof Shield; count?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'verifications', label: 'Verifications', icon: BadgeCheck, count: verifications.filter((v) => v.status === 'pending').length },
    { id: 'students', label: 'Students', icon: Users, count: students.length },
    { id: 'colleges', label: 'Colleges', icon: Building2, count: colleges.length },
    { id: 'requests', label: 'College requests', icon: MailQuestion, count: requests.filter((r) => r.status === 'pending').length },
    { id: 'rooms', label: 'Chat Rooms', icon: MessageSquare, count: rooms.length },
    { id: 'modlog', label: 'Moderation log', icon: ScrollText },
    { id: 'badges', label: 'Badges', icon: Award },
    ...(isSuperAdmin ? [{ id: 'home' as Tab, label: 'Home Page', icon: LayoutDashboard }, { id: 'fields' as Tab, label: 'Profile Fields', icon: ListPlus }, { id: 'commands' as Tab, label: 'Chat commands', icon: SlidersHorizontal }] : []),
  ];

  const filteredStudents = students.filter((s) =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-5xl mx-auto p-6 lg:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-accent-400 to-accent-600 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-heading text-3xl font-semibold text-slate-900 dark:text-slate-100">Admin Panel</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">See what is happening, and manage verifications, students, colleges, chat rooms, and the Home page</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-6 overflow-x-auto scrollbar-thin">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-all ${
                  tab === t.id ? 'bg-white dark:bg-slate-900 text-brand-700 dark:text-brand-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                    (t.id === 'verifications' || t.id === 'requests') ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {tab === 'dashboard' && <Dashboard onOpenTab={setTab} />}
        {tab === 'badges' && <BadgesManager />}
        {tab === 'home' && isSuperAdmin && profile && <HomeManager userId={profile.id} />}
        {tab === 'fields' && isSuperAdmin && <ProfileFieldsManager />}
        {tab === 'commands' && isSuperAdmin && <CommandPermissions />}
        {tab === 'modlog' && isAdmin && <ModerationLog colleges={colleges} />}

        {tab === 'verifications' && (
          <div className="space-y-3">
            {verifications.length === 0 ? (
              <EmptyState icon={BadgeCheck} text="No verification requests" />
            ) : (
              verifications.map((v) => (
                <div key={v.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-4 animate-fade-in">
                  <div className="w-10 h-10 bg-gradient-to-br from-slate-300 to-slate-400 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0">
                    {v.user?.full_name?.charAt(0).toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{v.user?.full_name}</p>
                    <p className="text-xs text-slate-400 truncate">{v.user?.email}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> {v.college?.name ?? 'Unknown college'}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {v.status === 'pending' ? (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                          <Clock className="w-3.5 h-3.5" /> Pending
                        </span>
                        <button onClick={() => resolveVerification(v.id, 'approved')}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-accent-50 dark:bg-accent-500/10 hover:bg-accent-100 dark:hover:bg-accent-500/20 text-accent-700 dark:text-accent-300 text-xs font-medium rounded-xl transition-colors">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button onClick={() => resolveVerification(v.id, 'rejected')}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium rounded-xl transition-colors">
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    ) : (
                      <span className={`flex items-center gap-1 text-xs font-medium ${
                        v.status === 'approved' ? 'text-accent-600 dark:text-accent-400' : 'text-red-500'
                      }`}>
                        {v.status === 'approved' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        {v.status === 'approved' ? 'Approved' : 'Rejected'}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'students' && (
          <div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search students..."
                className="w-full pl-10 pr-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
            </div>
            <div className="space-y-2">
              {filteredStudents.map((s) => (
                <div key={`${s.id}-${s.college_role}-${s.committee_name}`} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 animate-fade-in">
                  <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-slate-300 to-slate-400 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0">
                    {s.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{s.full_name}</p>
                      {s.is_verified && <CheckCircle2 className="w-3.5 h-3.5 text-accent-500 shrink-0" />}
                      <UserBadges userId={s.id} max={3} compact />
                    </div>
                    <p className="text-xs text-slate-400 truncate">{s.email}</p>
                    {s.college && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {s.college.name}{rankLabel(s) ? ` · ${rankLabel(s)}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <select
                      value={s.role}
                      onChange={(e) => updateStudentRole(s.id, e.target.value)}
                      className="text-xs px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    >
                      <option value="student">Student</option>
                      <option value="admin">Admin</option>
                      {profile?.role === 'super_admin' && <option value="super_admin">Super Admin</option>}
                    </select>
                    {s.is_verified && (
                      <button onClick={() => removeVerified(s.id)} title="Revoke verification"
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors">
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  </div>
                  {s.college_id && s.is_verified && profile && (
                    <div className="mt-3 pl-14 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-400">College rank:</span>
                      <RankEditor viewer={profile} target={s} onChanged={loadAll} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'colleges' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={collegeSearch}
                  onChange={(e) => setCollegeSearch(e.target.value)}
                  placeholder="Search colleges..."
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </div>
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-xl transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" /> Import CSV
              </button>
              <button
                onClick={() => setCollegeForm({})}
                className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            {colleges.length === 0 ? (
              <EmptyState icon={Building2} text="No colleges registered yet" />
            ) : (
              colleges.filter((c) => !collegeSearch.trim() || [c.name, c.city, c.state, c.country, c.tier].some((v) => v?.toLowerCase().includes(collegeSearch.trim().toLowerCase()))).map((c) => {
                const count = studentsOf(c.id);
                return (
                  <div key={c.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-4 animate-fade-in">
                    <CollegeLogo src={c.logo_url} domain={c.domain} name={c.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                        <span>{c.name}</span> <TierBadge tier={c.tier} />
                      </p>
                      <p className="text-xs text-slate-400">{placeLine(c) || 'No location'}</p>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {count}
                    </span>
                    <button onClick={() => setCollegeForm({ college: c })} title="Edit college"
                      className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteCollege(c)} title="Delete college"
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === 'requests' && <CollegeRequestsPanel requests={requests} onChanged={loadAll} />}

        {tab === 'rooms' && (
          <div className="space-y-2">
            {rooms.length === 0 ? (
              <EmptyState icon={MessageSquare} text="No chat rooms created yet" />
            ) : (
              rooms.map((r) => (
                <div key={r.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-4 animate-fade-in">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    r.room_type === 'global' ? 'bg-brand-50 dark:bg-brand-500/10' : r.room_type === 'college' ? 'bg-accent-50 dark:bg-accent-500/10' : 'bg-slate-100 dark:bg-slate-800'
                  }`}>
                    <MessageSquare className={`w-5 h-5 ${
                      r.room_type === 'global' ? 'text-brand-600 dark:text-brand-400' : r.room_type === 'college' ? 'text-accent-600 dark:text-accent-400' : 'text-slate-400'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{r.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{r.room_type} room{r.college ? ` • ${r.college.name}` : ''}</p>
                  </div>
                  <button onClick={() => deleteRoom(r.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {showImport && <CollegeImportModal onClose={() => setShowImport(false)} onDone={loadAll} />}

      {collegeForm && (
        <CollegeFormModal
          college={collegeForm.college}
          onClose={() => setCollegeForm(null)}
          onSaved={() => { setCollegeForm(null); loadAll(); }}
        />
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof Shield; text: string }) {
  return (
    <div className="text-center py-12 text-slate-400">
      <Icon className="w-10 h-10 mx-auto mb-3 opacity-40" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
