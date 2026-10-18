import { Component, useCallback, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import PwaHelper from '@/components/PwaHelper';
import EmailConfirmationBanner from '@/components/EmailConfirmationBanner';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import AuthPage from '@/pages/AuthPage';
import Layout, { type Page } from '@/components/Layout';
import HomePage from '@/pages/HomePage';
import ChatPage from '@/pages/ChatPage';
import MessagesPage from '@/pages/MessagesPage';
import { DirectMessageProvider } from '@/context/DirectMessageContext';
import CollegesPage from '@/pages/CollegesPage';
import EventsPage from '@/pages/EventsPage';
import GalleryPage from '@/pages/GalleryPage';
import AdminPage from '@/pages/AdminPage';
import ProfilePage from '@/pages/ProfilePage';
import CommunityPage from '@/pages/CommunityPage';
import CampusHubPage from '@/pages/CampusHubPage';
import PlannerPage from '@/pages/PlannerPage';
import CollaboratePage from '@/pages/CollaboratePage';
import StudentGrowthPage from '@/pages/StudentGrowthPage';
import CampusPlusPage from '@/pages/CampusPlusPage';
import { AIStudyToolsPage, PersonalizedDashboardPage, CareerCoachPage, CampusNavigatorPage, TutoringPage, ProjectHubPage, CampusHelpdeskPage, AdminAnalyticsPage } from '@/pages/StudentToolsPages';
import { AlertTriangle, GraduationCap, Loader2, RefreshCw, Home } from 'lucide-react';
import ProfessionalPortalPage from '@/pages/ProfessionalPortalPage';
import ClassroomsPage from '@/pages/ClassroomsPage';
import NetworkExtrasPage from '@/pages/NetworkExtrasPage';


const validPages: Page[] = ['home', 'chat', 'messages', 'colleges', 'events', 'gallery', 'admin', 'profile', 'community', 'hub', 'planner', 'collaborate', 'growth', 'campusplus', 'studydesk', 'personalized', 'careercoach', 'navigator', 'tutoring', 'projecthub', 'helpdesk', 'analytics', 'professional', 'classrooms', 'networkextras'];

function pageFromHash(): Page {
  const value = window.location.hash.replace(/^#\/?/, '').split('/')[0];
  return validPages.includes(value as Page) ? value as Page : 'home';
}

class PageErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[UniLink] Page rendering failed:', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <section className="mx-auto my-8 max-w-xl rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm dark:border-amber-900/60 dark:bg-slate-900 sm:p-8" role="alert">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"><AlertTriangle className="h-6 w-6" /></div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">This page ran into a problem</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Your account and other pages are still available. Try loading this page again, or return to Home.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button onClick={() => this.setState({ hasError: false })} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"><RefreshCw className="h-4 w-4" /> Try again</button>
            <button onClick={() => { window.location.hash = '#home'; window.location.reload(); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><Home className="h-4 w-4" /> Go to Home</button>
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [page, setPage] = useState<Page>(() => pageFromHash());
  const [roomToOpen, setRoomToOpen] = useState<string | null>(null);
  const [dmTarget, setDmTarget] = useState<string | null>(null); // someone to open a direct message with
  const [professionalMode, setProfessionalMode] = useState(false);

  const navigateToPage = useCallback((nextPage: Page) => {
    setPage(nextPage);
    const nextHash = `#${nextPage}`;
    if (window.location.hash !== nextHash) window.history.pushState({ page: nextPage }, '', nextHash);
  }, []);

  useEffect(() => {
    const syncPage = () => setPage(pageFromHash());
    window.addEventListener('popstate', syncPage);
    window.addEventListener('hashchange', syncPage);
    if (!window.location.hash) window.history.replaceState({ page: 'home' }, '', '#home');
    return () => { window.removeEventListener('popstate', syncPage); window.removeEventListener('hashchange', syncPage); };
  }, []);

  // Open every page (and the app right after sign-in) at the top. Without this the browser keeps the scroll
  // position of the previous screen, e.g. the bottom of the long sign-up form.
  const signedIn = !!user && !!profile;
  useEffect(() => {
    // Choose a sensible first portal, but respect the user's choice when switching portals
    // and keep it across refreshes for the current browser session.
    const isWebsiteAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
    if (!signedIn || isWebsiteAdmin) {
      setProfessionalMode(false);
      return;
    }
    if (!profile?.id) return;
    try {
      const savedMode = window.sessionStorage.getItem(`unilink:portal-mode:${profile.id}`);
      if (savedMode === 'student' || savedMode === 'professional') {
        setProfessionalMode(savedMode === 'professional');
      } else {
        const defaultProfessional = !!profile.portal_type && profile.portal_type !== 'student';
        setProfessionalMode(defaultProfessional);
        window.sessionStorage.setItem(`unilink:portal-mode:${profile.id}`, defaultProfessional ? 'professional' : 'student');
      }
    } catch {
      setProfessionalMode(!!profile.portal_type && profile.portal_type !== 'student');
    }
  }, [signedIn, profile?.id, profile?.portal_type, profile?.role]);

  const switchPortal = useCallback((mode: 'student' | 'professional') => {
    try { if (profile?.id) window.sessionStorage.setItem(`unilink:portal-mode:${profile.id}`, mode); } catch { /* storage may be disabled */ }
    setProfessionalMode(mode === 'professional');
    navigateToPage('home');
  }, [profile?.id, navigateToPage]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [signedIn, page]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <Loader2 className="w-5 h-5 animate-spin text-brand-500 mx-auto" />
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <AuthPage />;
  }

  if (professionalMode && profile.portal_type && profile.portal_type !== 'student' && page !== 'classrooms') {
    return <ProfessionalPortalPage onStudentPortal={() => switchPortal('student')} onSignOut={async () => { try { if (profile?.id) window.sessionStorage.removeItem(`unilink:portal-mode:${profile.id}`); } catch { /* storage may be disabled */ } await supabase.auth.signOut(); setProfessionalMode(false); }} />;
  }

  // Redirect non-admins away from admin page
  const effectivePage = (page === 'admin' || page === 'analytics') && profile.role === 'student' ? 'home' : page;

  return (
    <DirectMessageProvider onOpen={(userId) => { setDmTarget(userId); navigateToPage('messages'); }}>
    <Layout currentPage={effectivePage} onPageChange={navigateToPage}>
      {profile.portal_type && profile.portal_type !== 'student' && profile.role !== 'admin' && profile.role !== 'super_admin' && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 dark:border-brand-500/30 dark:bg-brand-500/10">
          <div><p className="text-sm font-semibold text-brand-900 dark:text-brand-200">Student portal</p><p className="text-xs text-brand-800/80 dark:text-brand-300">You can switch between your student workspace and professional workspace at any time.</p></div>
          <button type="button" onClick={() => switchPortal('professional')} className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">Switch to professional portal</button>
        </div>
      )}
      {effectivePage !== 'chat' && <EmailConfirmationBanner />}
      {/* The student portal skips the welcome/onboarding page and opens directly into the workspace. */}
      <PageErrorBoundary key={effectivePage}>
      {effectivePage === 'home' && <HomePage onNavigate={navigateToPage} />}
      {effectivePage === 'chat' && <ChatPage initialRoomId={roomToOpen} onInitialRoomHandled={() => setRoomToOpen(null)} />}
      {effectivePage === 'messages' && <MessagesPage targetUserId={dmTarget} onTargetHandled={() => setDmTarget(null)} />}
      {effectivePage === 'colleges' && <CollegesPage />}
      {effectivePage === 'events' && <EventsPage onOpenRoom={(roomId) => { setRoomToOpen(roomId); navigateToPage('chat'); }} />}
      {effectivePage === 'gallery' && <GalleryPage />}
      {effectivePage === 'admin' && <AdminPage />}
      {effectivePage === 'profile' && <ProfilePage />}
      {effectivePage === 'community' && <CommunityPage onOpenRoom={(roomId) => { setRoomToOpen(roomId); navigateToPage('chat'); }} />}
      {effectivePage === 'hub' && <CampusHubPage />}
      {effectivePage === 'planner' && <PlannerPage />}
      {effectivePage === 'collaborate' && <CollaboratePage />}
      {effectivePage === 'classrooms' && <ClassroomsPage />}
      {effectivePage === 'networkextras' && <NetworkExtrasPage />}
      {effectivePage === 'growth' && <StudentGrowthPage onNavigate={navigateToPage} />}
      {effectivePage === 'campusplus' && <CampusPlusPage onNavigate={navigateToPage} />}
      {effectivePage === 'studydesk' && <AIStudyToolsPage />}
      {effectivePage === 'personalized' && <PersonalizedDashboardPage />}
      {effectivePage === 'careercoach' && <CareerCoachPage />}
      {effectivePage === 'navigator' && <CampusNavigatorPage />}
      {effectivePage === 'tutoring' && <TutoringPage />}
      {effectivePage === 'projecthub' && <ProjectHubPage />}
      {effectivePage === 'helpdesk' && <CampusHelpdeskPage />}
      {effectivePage === 'analytics' && <AdminAnalyticsPage />}
      </PageErrorBoundary>
    </Layout>
    </DirectMessageProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
        <PwaHelper />
      </AuthProvider>
    </ThemeProvider>
  );
}
