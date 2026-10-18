import { Component, useCallback, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { supabase, type ChatRoom } from '@/lib/supabase';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
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


const validPages: Page[] = ['home', 'chat', 'messages', 'colleges', 'events', 'gallery', 'admin', 'profile', 'community', 'hub', 'planner', 'collaborate', 'growth', 'campusplus', 'studydesk', 'personalized', 'careercoach', 'navigator', 'tutoring', 'projecthub', 'helpdesk', 'analytics'];

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
  const { user, profile, loading, refreshProfile } = useAuth();
  const [page, setPage] = useState<Page>(() => pageFromHash());
  const [guideHidden, setGuideHidden] = useState(false);
  const [roomToOpen, setRoomToOpen] = useState<string | null>(null);
  const [dmTarget, setDmTarget] = useState<string | null>(null); // someone to open a direct message with

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

  // Redirect non-admins away from admin page
  const effectivePage = (page === 'admin' || page === 'analytics') && profile.role === 'student' ? 'home' : page;

  // New people get the guide once (choose college, get verified, join a room). Closing or finishing it ends it.
  const endGuide = async () => {
    setGuideHidden(true);
    await supabase.from('profiles').update({ onboarding_done: true }).eq('id', profile.id);
    refreshProfile();
  };
  const finishGuide = (room?: ChatRoom) => {
    endGuide();
    if (room) setRoomToOpen(room.id);
    navigateToPage('chat');
  };

  return (
    <DirectMessageProvider onOpen={(userId) => { setDmTarget(userId); navigateToPage('messages'); }}>
    <Layout currentPage={effectivePage} onPageChange={navigateToPage}>
      {effectivePage !== 'chat' && <EmailConfirmationBanner />}
      {!profile.onboarding_done && !guideHidden && <OnboardingWizard onClose={endGuide} onFinish={finishGuide} />}
      <PageErrorBoundary key={effectivePage}>
      {effectivePage === 'home' && <HomePage onNavigate={navigateToPage} />}
      {effectivePage === 'chat' && <ChatPage initialRoomId={roomToOpen} onInitialRoomHandled={() => setRoomToOpen(null)} />}
      {effectivePage === 'messages' && <MessagesPage targetUserId={dmTarget} onTargetHandled={() => setDmTarget(null)} />}
      {effectivePage === 'colleges' && <CollegesPage />}
      {effectivePage === 'events' && <EventsPage />}
      {effectivePage === 'gallery' && <GalleryPage />}
      {effectivePage === 'admin' && <AdminPage />}
      {effectivePage === 'profile' && <ProfilePage />}
      {effectivePage === 'community' && <CommunityPage />}
      {effectivePage === 'hub' && <CampusHubPage />}
      {effectivePage === 'planner' && <PlannerPage />}
      {effectivePage === 'collaborate' && <CollaboratePage />}
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
