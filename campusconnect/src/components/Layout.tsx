import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import {
  MessageSquare, Building2, CalendarDays, Users, GraduationCap,
  Shield, LogOut, Menu, X, CheckCircle2, AlertCircle, User as UserIcon,
  Images, Sun, Moon, Home, MessageCircle, Search, CornerDownLeft, Command, ChevronRight, ChevronDown, Sparkles, Compass, BookOpen, BriefcaseBusiness, MapPinned, Trophy, LifeBuoy, BarChart3, WandSparkles,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { Role } from '@/lib/supabase';
import Avatar from '@/components/Avatar';
import { rankLabel } from '@/lib/collegeRoles';
import { useDirectMessages } from '@/context/DirectMessageContext';
import { dmApi, type DmPerson } from '@/lib/directMessages';
import Chatbot from '@/components/Chatbot';

export type Page = 'home' | 'chat' | 'messages' | 'colleges' | 'events' | 'gallery' | 'admin' | 'profile' | 'community' | 'hub' | 'planner' | 'collaborate' | 'growth' | 'campusplus' | 'studydesk' | 'personalized' | 'careercoach' | 'navigator' | 'tutoring' | 'projecthub' | 'helpdesk' | 'analytics';

interface NavItem {
  id: Page;
  label: string;
  icon: typeof MessageSquare;
  roles?: Role[];
}

const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'community', label: 'Community', icon: Users },
  { id: 'hub', label: 'Campus Hub', icon: Sparkles },
  { id: 'chat', label: 'Chat rooms', icon: MessageSquare },
  { id: 'messages', label: 'Messages', icon: MessageCircle },
  { id: 'colleges', label: 'Colleges', icon: Building2 },
  { id: 'events', label: 'Events', icon: CalendarDays },
  { id: 'planner', label: 'Student planner', icon: CalendarDays },
  { id: 'collaborate', label: 'Collaborate', icon: Users },
  { id: 'growth', label: 'Growth & portfolio', icon: Compass },
  { id: 'campusplus', label: 'Campus Plus', icon: GraduationCap },
  { id: 'personalized', label: 'My Dashboard', icon: Sparkles },
  { id: 'studydesk', label: 'AI Study Tools', icon: BookOpen },
  { id: 'careercoach', label: 'Career Coach', icon: BriefcaseBusiness },
  { id: 'navigator', label: 'Campus Navigator', icon: MapPinned },
  { id: 'tutoring', label: 'Peer Tutoring', icon: Users },
  { id: 'projecthub', label: 'Project & Hackathon Hub', icon: Trophy },
  { id: 'helpdesk', label: 'Campus Helpdesk', icon: LifeBuoy },
  { id: 'analytics', label: 'Admin Analytics', icon: BarChart3, roles: ['admin', 'super_admin'] },
  { id: 'gallery', label: 'Gallery', icon: Images },
  { id: 'profile', label: 'My profile', icon: UserIcon },
  { id: 'admin', label: 'Admin panel', icon: Shield, roles: ['admin', 'super_admin'] },
];

interface LayoutProps {
  children: ReactNode;
  currentPage: Page;
  onPageChange: (page: Page) => void;
}

export default function Layout({ children, currentPage, onPageChange }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [peopleResults, setPeopleResults] = useState<DmPerson[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(['personalized', 'studydesk', 'careercoach', 'navigator', 'tutoring', 'projecthub', 'helpdesk', 'analytics'].includes(currentPage));
  const { unread, openDirectMessage } = useDirectMessages();

  const visibleNavItems = navItems.filter(
    (item) => !item.roles || (profile && item.roles.includes(profile.role))
  );

  const query = searchQuery.trim().toLowerCase();
  const matchingNavItems = visibleNavItems.filter((item) => !query || item.label.toLowerCase().includes(query));

  // Search people through the authenticated server endpoint. Results deliberately exclude email addresses.
  useEffect(() => {
    let active = true;
    if (!searchOpen || query.length < 2) {
      setPeopleResults([]);
      setPeopleLoading(false);
      return () => { active = false; };
    }
    setPeopleLoading(true);
    const handle = window.setTimeout(async () => {
      const { data, error } = await dmApi.people(query);
      if (!active) return;
      setPeopleResults(error ? [] : (data?.people ?? []).slice(0, 6));
      setPeopleLoading(false);
    }, 250);
    return () => { active = false; window.clearTimeout(handle); };
  }, [searchOpen, query]);

  useEffect(() => {
    const root = document.documentElement;
    try {
      root.classList.toggle('a11y-large-text', window.localStorage.getItem('unilink-large-text') === '1');
      root.classList.toggle('a11y-reduce-motion', window.localStorage.getItem('unilink-reduce-motion') === '1');
    } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((open) => !open);
        setSearchQuery('');
      } else if (event.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const goToPage = (page: Page) => {
    onPageChange(page);
    setSidebarOpen(false);
    setSearchOpen(false);
    setSearchQuery('');
  };

  // Chat rooms and direct messages behave like a chat app: the page itself never scrolls,
  // only the message list does. The header, conversation bar and send box stay in place.
  const isChatLike = currentPage === 'chat' || currentPage === 'messages';

  const roleLabel = profile?.is_owner ? 'Owner'
    : profile?.role === 'super_admin' ? 'Super Admin'
    : profile?.role === 'admin' ? 'Admin'
    : profile?.is_verified && rankLabel(profile) ? rankLabel(profile)
    : profile?.is_verified ? 'Verified Student'
    : 'Student';

  const roleColor = profile?.role === 'super_admin' || profile?.role === 'admin'
    ? 'bg-accent-100 dark:bg-accent-500/20 text-accent-700 dark:text-accent-300'
    : profile?.is_verified
    ? 'bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300'
    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300';

  return (
    <div className={`app-shell flex ${isChatLike ? 'h-dvh overflow-hidden' : 'min-h-screen'}`}>
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`app-sidebar fixed lg:sticky lg:top-0 lg:h-screen lg:self-start shrink-0 inset-y-0 left-0 z-40 w-64 flex flex-col transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        {/* Logo */}
        <div className="h-[76px] flex items-center gap-3 px-5 border-b border-slate-200/80 dark:border-slate-800/80">
          <div className="brand-mark"><img src="/logo.png" alt="Unilink logo" className="w-9 h-9 object-contain" /></div>
          <div>
            <h1 className="font-heading font-bold text-slate-900 dark:text-slate-100 text-[15px] leading-tight tracking-tight">UniLink</h1>
            <p className="text-[10px] text-slate-400 mt-1">YOUR CAMPUS, CONNECTED</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <div className="px-3 pt-5">
          <button
            onClick={() => { setSearchOpen(true); setSearchQuery(''); }}
            className="sidebar-search w-full flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm text-slate-500 dark:text-slate-400 hover:border-brand-300 dark:hover:border-brand-500/50 transition-colors"
            aria-label="Search pages"
          >
            <Search className="w-4 h-4" />
            <span className="flex-1 text-left">Jump to…</span>
            <kbd className="rounded border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[10px] font-medium">Ctrl K</kbd>
          </button>
        </div>
        <div className="px-5 pt-6 pb-2 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Your space</div>
        <nav aria-label="Main navigation" className="flex-1 py-2 px-3 space-y-1 overflow-y-auto scrollbar-thin">
          {visibleNavItems.filter((item) => !['personalized', 'studydesk', 'careercoach', 'navigator', 'tutoring', 'projecthub', 'helpdesk', 'analytics'].includes(item.id)).map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            const section = item.id === 'colleges' ? 'Discover' : item.id === 'profile' ? 'Account' : item.id === 'admin' ? 'Manage' : null;
            return (
              <div key={item.id}>
                {section && <p className="nav-section-label">{section}</p>}
                <button onClick={() => goToPage(item.id)} aria-current={active ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? 'nav-item-active text-white shadow-lg shadow-brand-600/20' : 'nav-item text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-100'}`}>
                  <Icon className={`w-[18px] h-[18px] ${active ? 'text-white' : 'text-slate-400'}`} />
                  {item.label}
                  {item.id === 'messages' && unread > 0 && <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-brand-600 text-white text-[11px] font-semibold flex items-center justify-center" aria-label={`${unread} unread messages`}>{unread > 99 ? '99+' : unread}</span>}
                  {item.id === 'admin' && <Shield className="w-3 h-3 ml-auto text-accent-500" />}
                </button>
              </div>
            );
          })}
          <div className="pt-2">
            <button type="button" onClick={() => setToolsOpen((open) => !open)} aria-expanded={toolsOpen}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${toolsOpen || ['personalized','studydesk','careercoach','navigator','tutoring','projecthub','helpdesk','analytics'].includes(currentPage) ? 'text-brand-700 bg-brand-50/80 dark:text-brand-300 dark:bg-brand-500/10' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/80'}`}>
              <WandSparkles className="h-[18px] w-[18px] text-brand-500" /><span className="flex-1 text-left">Student tools</span>
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">{visibleNavItems.filter((item) => ['personalized','studydesk','careercoach','navigator','tutoring','projecthub','helpdesk','analytics'].includes(item.id)).length}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
            </button>
            {toolsOpen && <div className="ml-3 mt-1 space-y-1 border-l border-slate-200 pl-2 dark:border-slate-700">{visibleNavItems.filter((item) => ['personalized','studydesk','careercoach','navigator','tutoring','projecthub','helpdesk','analytics'].includes(item.id)).map((item) => {
              const Icon = item.icon; const active = currentPage === item.id;
              return <button key={item.id} onClick={() => goToPage(item.id)} aria-current={active ? 'page' : undefined}
                className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${active ? 'bg-brand-600 text-white font-semibold shadow-sm' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/80'}`}>
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} /><span className="min-w-0 flex-1 truncate">{item.label}</span>
              </button>;
            })}</div>}
          </div>
        </nav>

        {/* Profile + Sign Out */}
        <div className="border-t border-slate-200/80 dark:border-slate-800/80 p-3">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            {profile?.avatar_url ? <Avatar name={profile.full_name} url={profile.avatar_url} className="w-10 h-10 text-sm" /> : (
            <div className="user-avatar w-10 h-10 rounded-2xl flex items-center justify-center text-white text-sm font-bold shrink-0">
              {profile?.full_name?.charAt(0).toUpperCase() ?? '?'}
            </div>)}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{profile?.full_name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {profile?.is_verified && <CheckCircle2 className="w-3 h-3 text-accent-500 shrink-0" />}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${roleColor}`}>
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="sidebar-action w-full flex items-center gap-2 px-3 py-2.5 mb-1 rounded-xl text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
            {theme === 'light' ? 'Dark mode' : 'Light mode'}
          </button>
          <button
            onClick={signOut}
            className="sidebar-action w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className={`flex-1 flex flex-col min-w-0 ${isChatLike ? 'min-h-0 overflow-hidden' : ''}`}>
        {/* Responsive app header */}
        <header className="app-topbar sticky top-0 z-20 flex h-[70px] shrink-0 items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button onClick={() => setSidebarOpen(true)} className="icon-button flex lg:hidden" aria-label="Open navigation">
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden sm:block min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-brand-600 dark:text-brand-300">Campus network</p>
            <h2 className="mt-0.5 truncate font-heading text-lg font-semibold text-slate-900 dark:text-slate-100">{navItems.find((item) => item.id === currentPage)?.label ?? 'Workspace'}</h2>
          </div>
          <button onClick={() => { setSearchOpen(true); setSearchQuery(''); }} className="topbar-search ml-auto flex min-w-0 max-w-sm flex-1 items-center gap-2 rounded-xl px-2 sm:px-3 py-2.5 text-sm text-slate-500 dark:text-slate-400 sm:ml-6" aria-label="Search and navigate">
            <Search className="h-4 w-4 shrink-0"/><span className="hidden flex-1 text-left sm:inline">Search UniLink...</span><kbd className="hidden rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] sm:inline dark:border-slate-700 dark:bg-slate-800">Ctrl K</kbd>
          </button>
          <button onClick={toggleTheme} className="icon-button flex shrink-0" aria-label="Toggle theme">
            {theme === 'light' ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px] text-amber-400" />}
          </button>
          <button onClick={() => onPageChange('profile')} className="topbar-profile flex shrink-0 items-center gap-2 rounded-xl p-1.5 sm:pr-3 text-left hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Open profile">
            <span className="user-avatar flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl text-xs font-bold text-white">{profile?.full_name?.charAt(0).toUpperCase() ?? '?'}</span>
            <span className="max-w-[76px] truncate text-[10px] font-semibold text-slate-700 dark:text-slate-200 sm:max-w-[130px] sm:text-xs">{profile?.full_name}</span><ChevronRight className="hidden h-3.5 w-3.5 rotate-90 text-slate-400 sm:block"/>
          </button>
        </header>

        <main id="main-content" tabIndex={-1} className={`app-main flex-1 min-h-0 min-w-0 overflow-hidden focus:outline-none ${isChatLike ? 'chat-locked-main' : ''}`}>{children}</main>
        <nav className="mobile-bottom-nav" aria-label="Quick navigation">
          {([
            { id: 'home' as Page, label: 'Home', icon: Home },
            { id: 'community' as Page, label: 'Community', icon: Users },
            { id: 'messages' as Page, label: 'Messages', icon: MessageCircle },
            { id: 'events' as Page, label: 'Events', icon: CalendarDays },
            { id: 'profile' as Page, label: 'Profile', icon: UserIcon },
          ]).map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            return <button key={item.id} type="button" onClick={() => goToPage(item.id)} aria-current={active ? 'page' : undefined} className={`mobile-bottom-nav-item ${active ? 'is-active' : ''}`}>
              <span className="mobile-bottom-nav-icon"><Icon className="h-[19px] w-[19px]" />{item.id === 'messages' && unread > 0 && <span className="mobile-unread-dot" />}</span>
              <span>{item.label}</span>
            </button>;
          })}
        </nav>
        <Chatbot currentPage={currentPage} onNavigate={(page) => onPageChange(page)} />
      </div>

      {searchOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/50 px-4 pt-[12vh] backdrop-blur-sm"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}
        >
          <section role="dialog" aria-modal="true" aria-label="Jump to a page" className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 dark:border-slate-700 dark:bg-slate-900 animate-slide-up">
            <div className="flex items-center gap-3 border-b border-slate-200 px-4 dark:border-slate-800">
              <Search className="h-5 w-5 shrink-0 text-brand-500" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search pages…"
                className="h-14 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
                aria-label="Search available pages"
              />
              <kbd className="rounded-md border border-slate-200 px-2 py-1 text-[10px] text-slate-400 dark:border-slate-700">ESC</kbd>
            </div>
            <div className="max-h-[min(55vh,420px)] overflow-y-auto p-2">
              <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Navigate</p>
              {matchingNavItems.length ? matchingNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.id} onClick={() => goToPage(item.id)} className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-brand-50 hover:text-brand-700 dark:text-slate-200 dark:hover:bg-brand-500/10 dark:hover:text-brand-300">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-brand-600 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-slate-800 dark:group-hover:text-brand-300"><Icon className="h-4 w-4" /></span>
                    <span className="flex-1 font-medium">{item.label}</span>
                    {item.id === currentPage ? <span className="text-xs text-brand-600 dark:text-brand-300">Current</span> : <CornerDownLeft className="h-4 w-4 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100" />}
                  </button>
                );
              }) : (
                <div className="px-3 py-8 text-center">
                  <Command className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No pages found</p>
                  <p className="mt-1 text-xs text-slate-400">Try a different search term.</p>
                </div>
              )}
              {query.length >= 2 && (
                <div className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                  <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">People</p>
                  {peopleLoading ? (
                    <p className="px-3 py-4 text-sm text-slate-500" role="status">Searching students…</p>
                  ) : peopleResults.length ? peopleResults.map((person) => (
                    <button key={person.id} onClick={() => { setSearchOpen(false); setSearchQuery(''); openDirectMessage?.(person.id); }} className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-brand-50 dark:hover:bg-brand-500/10">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
                        {person.avatar_url ? <img src={person.avatar_url} alt="" className="h-full w-full object-cover" /> : person.full_name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{person.full_name}</span>
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{person.college_name || (person.is_verified ? 'Verified student' : 'Student')}</span>
                      </span>
                      <MessageCircle className="h-4 w-4 text-slate-400 group-hover:text-brand-600" />
                    </button>
                  )) : <p className="px-3 py-3 text-xs text-slate-500">{query.length >= 2 ? 'No matching people found.' : 'Type at least 2 characters.'}</p>}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-[11px] text-slate-400 dark:border-slate-800 dark:bg-slate-950/50">
              <span>Quick navigation</span><span>Press <kbd className="rounded border border-slate-200 px-1.5 py-0.5 dark:border-slate-700">Ctrl K</kbd> anytime</span>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

// Shared helper: request verification for current user
export async function requestVerification(collegeId: string, userId: string) {
  const { error } = await supabase
    .from('verifications')
    .insert({ user_id: userId, college_id: collegeId });
  return { error: error?.message ?? null };
}

// Shared badge component
export function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="inline-flex items-center gap-1 text-xs text-accent-600 dark:text-accent-400 font-medium">
      <CheckCircle2 className="w-3.5 h-3.5" /> Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
      <AlertCircle className="w-3.5 h-3.5" /> Unverified
    </span>
  );
}
