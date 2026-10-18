import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, apiPost, uploadFile, fileUrl, type College, type ProfileFieldValue, type Verification } from '@/lib/supabase';
import {
  User as UserIcon, Mail, Building2, CheckCircle2, Clock, Camera,
  Loader2, Send, GraduationCap, Shield, EyeOff
} from 'lucide-react';
import CollegeTeam from '@/components/CollegeTeam';
import CollegeVerifications from '@/components/CollegeVerifications';
import { CollegeModerationLog } from '@/components/admin/ModerationLog';
import { ProfileFieldInput } from '@/components/ProfileFieldInput';
import ProfileCompleteness from '@/components/ProfileCompleteness';
import UserBadges from '@/components/UserBadges';
import { rankLabel } from '@/lib/collegeRoles';
import { AccountSecurity } from '@/components/AccountSecurity';
import { SOCIAL_FIELDS, SocialLinks, type SocialKey } from '@/components/SocialLinks';
import RecruiterProfilePanel from '@/components/RecruiterProfilePanel';
import ProfileSkillsPanel from '@/components/ProfileSkillsPanel';

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const [colleges, setColleges] = useState<College[]>([]);
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [selectedCollege, setSelectedCollege] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [requesting, setRequesting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [extra, setExtra] = useState<ProfileFieldValue[]>([]);
  const [extraValues, setExtraValues] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [links, setLinks] = useState<Record<SocialKey, string>>({ linkedin_url: '', github_url: '', portfolio_url: '' });
  const [messagePrivacy, setMessagePrivacy] = useState<'everyone' | 'friends'>('everyone');
  const [privacySaving, setPrivacySaving] = useState(false);
  const [privacyNote, setPrivacyNote] = useState('');

  const loadColleges = useCallback(async () => {
    const { data } = await supabase.from('colleges').select('*').order('name');
    if (data) setColleges(data as College[]);
    setLoading(false);
  }, []);

  const loadVerifications = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('verifications')
      .select('*, college:colleges(*)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });
    if (data) setVerifications(data as Verification[]);
  }, [profile]);

  const loadExtra = useCallback(async () => {
    const { data } = await apiPost<ProfileFieldValue[]>('/api/profile/fields', {});
    if (data) {
      setExtra(data);
      setExtraValues(Object.fromEntries(data.map((f) => [f.id, f.value])));
    }
  }, []);

  useEffect(() => {
    loadExtra();
  }, [loadExtra]);

  useEffect(() => {
    loadColleges();
    loadVerifications();
  }, [loadColleges, loadVerifications]);

  useEffect(() => {
    apiPost<{ privacy?: 'everyone' | 'friends' }>('/api/chat/friends/list', {}).then(({ data }) => { if (data?.privacy) setMessagePrivacy(data.privacy); });
  }, []);

  const saveMessagePrivacy = async (privacy: 'everyone' | 'friends') => {
    setPrivacySaving(true); setPrivacyNote('');
    const { error } = await apiPost('/api/chat/message-privacy', { privacy });
    setPrivacySaving(false);
    if (error) setPrivacyNote(error.message); else { setMessagePrivacy(privacy); setPrivacyNote('Message preferences saved.'); }
  };

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setBio(profile.bio ?? '');
      setSelectedCollege(profile.college_id ?? '');
      setLinks({ linkedin_url: profile.linkedin_url ?? '', github_url: profile.github_url ?? '', portfolio_url: profile.portfolio_url ?? '' });
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    const { error: profileError } = await supabase.from('profiles').update({
      full_name: fullName,
      bio: bio || null,
      college_id: selectedCollege || null,
      ...links,
    }).eq('id', profile.id);
    if (profileError) {
      setSaving(false);
      setSaveError(profileError.message);
      return;
    }
    const { error } = await apiPost('/api/profile/fields/save', { values: extraValues });
    await refreshProfile();
    setSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    loadExtra();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const updateAvatar = async (file?: File) => {
    if (!file || !profile) return;
    if (!file.type.startsWith('image/')) { setSaveError('Choose an image file.'); return; }
    if (file.size > 8 * 1024 * 1024) { setSaveError('Profile images must be 8 MB or smaller.'); return; }
    setAvatarUploading(true); setSaveError(null);
    const uploaded = await uploadFile(file);
    if (uploaded.error || !uploaded.data) { setSaveError(uploaded.error?.message || 'Image upload failed.'); setAvatarUploading(false); return; }
    const savedAvatar = await apiPost('/api/features', { action: 'profile.avatar', url: uploaded.data.url });
    setAvatarUploading(false);
    if (savedAvatar.error) { setSaveError(savedAvatar.error.message); return; }
    await refreshProfile(); setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  const removeAvatar = async () => {
    if (!window.confirm('Remove your profile photo?')) return;
    setAvatarUploading(true); setSaveError(null);
    const res = await apiPost('/api/features', { action: 'profile.avatar', url: '' });
    setAvatarUploading(false);
    if (res.error) { setSaveError(res.error.message); return; }
    await refreshProfile();
  };

  const requestVerification = async () => {
    if (!profile || !selectedCollege) return;
    setRequesting(true);
    await supabase.from('verifications').insert({
      user_id: profile.id,
      college_id: selectedCollege,
    });
    await loadVerifications();
    setRequesting(false);
  };

  if (loading || !profile) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  const roleLabel = profile.is_owner ? 'Owner'
    : profile.role === 'super_admin' ? 'Super Administrator'
    : profile.role === 'admin' ? 'Administrator'
    : profile.portal_type === 'recruiter' ? 'Recruiter'
    : profile.portal_type === 'founder' ? 'Founder'
    : profile.portal_type === 'teacher' ? 'Teacher'
    : 'Student';
  const isRecruiter = profile.portal_type === 'recruiter';

  const hasPending = verifications.some((v) => v.status === 'pending');

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-2xl mx-auto p-6 lg:p-8">
        <h1 className="font-heading text-3xl font-semibold text-slate-900 dark:text-slate-100 mb-6">My Profile</h1>

        {(profile.portal_type === 'recruiter' || profile.portal_type === 'teacher' || profile.portal_type === 'founder') ? <RecruiterProfilePanel portalType={profile.portal_type} /> : <ProfileSkillsPanel portalType={profile.portal_type} />}

        {/* Profile card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative h-16 w-16 shrink-0">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-2xl font-bold text-white">
                {profile.avatar_url ? <img src={profile.avatar_url.startsWith('/api/files/') ? fileUrl(profile.avatar_url) : profile.avatar_url} alt={`${profile.full_name} profile`} className="h-full w-full object-cover" /> : profile.full_name.charAt(0).toUpperCase()}
              </div>
              <label title="Upload profile photo" className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-brand-600 text-white shadow dark:border-slate-900">
                <span className="sr-only">Upload profile photo</span><Camera className="h-3.5 w-3.5"/><input className="sr-only" type="file" accept="image/*" disabled={avatarUploading} onChange={e => void updateAvatar(e.target.files?.[0])}/>
              </label>
            </div>
            <div>
              <h2 className="font-heading font-semibold text-lg text-slate-900 dark:text-slate-100">{profile.full_name}</h2>
              <p className="text-sm text-slate-400">{profile.email}</p>
              <p className="mt-1 text-xs text-slate-400">{avatarUploading ? 'Working…' : 'Your photo is visible to everyone on Unilink. Click the camera to change it.'}{profile.avatar_url && !avatarUploading && <> <button type="button" onClick={() => void removeAvatar()} className="underline hover:text-red-500">Remove photo</button></>}</p>
              <UserBadges userId={profile.id} max={6} className="mt-1.5" />
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  profile.role !== 'student' ? 'bg-accent-100 dark:bg-accent-500/20 text-accent-700 dark:text-accent-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}>
                  {roleLabel}
                </span>
                {profile.is_verified && rankLabel(profile) && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300">
                    {rankLabel(profile)}
                  </span>
                )}
                {!isRecruiter && (profile.is_verified ? (
                  <span className="flex items-center gap-1 text-xs text-accent-600 dark:text-accent-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                    <Clock className="w-3.5 h-3.5" /> Unverified
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-5 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100">Who can message me?</h3>
            <p className="mt-1 mb-3 text-xs text-slate-500">Choose who can start a direct message with you.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={privacySaving} onClick={() => void saveMessagePrivacy('everyone')} className={`rounded-xl px-3 py-2 text-xs font-medium border ${messagePrivacy === 'everyone' ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>Everyone</button>
              <button type="button" disabled={privacySaving} onClick={() => void saveMessagePrivacy('friends')} className={`rounded-xl px-3 py-2 text-xs font-medium border ${messagePrivacy === 'friends' ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>Friends only</button>
            </div>
            {privacyNote && <p className="mt-2 text-xs text-slate-500" role="status">{privacyNote}</p>}
          </div>

          <ProfileCompleteness profile={profile} />

          <SocialLinks person={profile} className="mb-4" />

          {/* Verification status */}
          {!isRecruiter && profile.college && (
            <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span>College: <strong className="text-slate-800 dark:text-slate-200">{profile.college.name}</strong></span>
              </div>
            </div>
          )}

          {/* Verification requests */}
          {!isRecruiter && <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">College Verification</h3>
              {!profile.is_verified && !hasPending && selectedCollege && (
                <button
                  onClick={requestVerification}
                  disabled={requesting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-medium rounded-xl transition-colors"
                >
                  {requesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Request Verification
                </button>
              )}
            </div>

            {verifications.length === 0 ? (
              <p className="text-xs text-slate-400">
                Select your college below and request verification. An officer of your college or an admin will review it.
              </p>
            ) : (
              <div className="space-y-2">
                {verifications.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl">
                    <div className="w-8 h-8 bg-brand-50 dark:bg-brand-500/10 rounded-xl flex items-center justify-center shrink-0">
                      <GraduationCap className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{v.college?.name}</p>
                      <p className="text-[10px] text-slate-400">{new Date(v.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-xs font-medium flex items-center gap-1 ${
                      v.status === 'approved' ? 'text-accent-600 dark:text-accent-400'
                      : v.status === 'rejected' ? 'text-red-500'
                      : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {v.status === 'approved' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {v.status === 'rejected' && <Shield className="w-3.5 h-3.5" />}
                      {v.status === 'pending' && <Clock className="w-3.5 h-3.5" />}
                      <span className="capitalize">{v.status}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>}
        </div>

        {/* College-specific tools are not part of the recruiter profile. */}
        {!isRecruiter && <><CollegeVerifications viewer={profile} /><CollegeTeam viewer={profile} /><CollegeModerationLog viewer={profile} /></>}

        {/* Edit form */}
        <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="font-heading font-semibold text-slate-900 dark:text-slate-100">Edit Profile</h3>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Full Name</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email (read-only)</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="email" value={profile.email} disabled
                className="w-full pl-10 pr-3 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-400" />
            </div>
          </div>

          {!isRecruiter && <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">College</label>
            <select value={selectedCollege} onChange={(e) => setSelectedCollege(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30">
              <option value="">Select your college</option>
              {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Bio (optional)</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Tell others about yourself..."
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none" />
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-4 mb-1">Social links &amp; portfolio</h4>
            <p className="text-xs text-slate-400 mb-3">Shown on your profile card to everyone. Leave blank to hide.</p>
            <div className="space-y-3">
              {SOCIAL_FIELDS.map(({ key, label, icon: Icon, placeholder }) => (
                <div key={key}>
                  <label htmlFor={key} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>
                  <div className="relative">
                    <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input id={key} type="text" inputMode="url" autoComplete="url" maxLength={200} value={links[key]} placeholder={placeholder}
                      onChange={(e) => setLinks((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {extra.length > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-4 mb-3">{isRecruiter ? 'Professional & contact details' : 'Academic & contact details'}</h4>
              <div className="grid sm:grid-cols-2 gap-4">
                {extra.map((f) => (
                  <div key={f.id} className={f.field_type === 'textarea' ? 'sm:col-span-2' : ''}>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      {f.label}{f.required && <span className="text-red-500">*</span>}
                      {f.private && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-normal text-slate-400" title="Only you and website admins can see this">
                          <EyeOff className="w-3 h-3" /> private
                        </span>
                      )}
                    </label>
                    <ProfileFieldInput field={f} value={extraValues[f.id] ?? ''} onChange={(v) => setExtraValues((prev) => ({ ...prev, [f.id]: v }))} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {saveError && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2">{saveError}</div>
          )}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Save Changes
            </button>
            {saved && (
              <span className="text-sm text-accent-600 dark:text-accent-400 flex items-center gap-1 animate-fade-in">
                <CheckCircle2 className="w-4 h-4" /> Saved!
              </span>
            )}
          </div>
        </form>

        <AccountSecurity email={profile.email} onEmailChanged={refreshProfile} />
      </div>
    </div>
  );
}
