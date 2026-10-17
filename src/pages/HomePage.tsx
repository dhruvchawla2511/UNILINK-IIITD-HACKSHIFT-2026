import { useEffect, useMemo, useState } from 'react';
import { Loader2, CalendarDays, MapPin, Building2, Tag, Images, Film, ArrowRight, ArrowUpRight, Settings2, Lock, MessageSquare, MessageCircle, Compass, UserRound, Sparkles, Clock3 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type EventItem, type HomeSettings, type HomeSlide } from '@/lib/supabase';
import { defaultHomeSettings, fetchMediaRows, rowToMedia } from '@/lib/content';
import { allMedia } from '@/data';
import type { MediaItem } from '@/data/images';
import { Slideshow } from '@/components/Slideshow';
import { MediaCard } from '@/components/MediaCard';
import { Lightbox } from '@/components/Lightbox';
import type { Page } from '@/components/Layout';

const IMAGE_LIMIT = 8;
const VIDEO_LIMIT = 6;

function SectionHeader({
  icon: Icon, title, actionLabel, onAction,
}: { icon: typeof Images; title: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="font-heading text-xl font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-3">
        <span className="w-9 h-9 rounded-xl bg-brand-100 dark:bg-brand-500/15 flex items-center justify-center">
          <Icon className="w-[18px] h-[18px] text-brand-600 dark:text-brand-300" />
        </span>
        {title}
      </h2>
      <button
        onClick={onAction}
        className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 dark:text-brand-300 hover:gap-2 transition-all"
      >
        {actionLabel} <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function HomePage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<HomeSettings>(defaultHomeSettings);
  const [slides, setSlides] = useState<HomeSlide[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [lightbox, setLightbox] = useState<{ list: MediaItem[]; index: number } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [s, sl, ev, md] = await Promise.all([
        supabase.from('home_settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('home_slides').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
        supabase.from('events').select('*, college:colleges(*)').order('event_date', { ascending: true }),
        fetchMediaRows(),
      ]);
      if (!alive) return;
      if (s.data) setSettings({ ...defaultHomeSettings, ...(s.data as HomeSettings) });
      if (sl.data) setSlides(sl.data as HomeSlide[]);
      if (ev.data) setEvents(ev.data as EventItem[]);
      if (md.error) {
        setMedia(allMedia); // content tables not set up yet: show built-in samples
      } else {
        setMedia(md.rows.filter((r) => r.show_on_home).map(rowToMedia));
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const upcomingEvents = useMemo(() => {
    const today = new Date(new Date().toDateString());
    return events
      .filter((e) => e.show_on_home !== false && new Date(`${e.end_date || e.event_date}T12:00:00`) >= today)
      .slice(0, settings.events_count);
  }, [events, settings.events_count]);

  const images = useMemo(() => media.filter((m) => m.type === 'image'), [media]);
  const videos = useMemo(() => media.filter((m) => m.type === 'video'), [media]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  const formatDate = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const formatRange = (start: string, end?: string | null) =>
    end && end !== start ? `${formatDate(start)} – ${formatDate(end)}` : formatDate(start);

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-10 space-y-12">
        {/* Personalized dashboard hero */}
        <section className="dashboard-welcome relative overflow-hidden rounded-[30px] px-6 py-7 sm:px-9 sm:py-9 lg:px-11 lg:py-10">
          <div className="dashboard-welcome-glow dashboard-glow-one" />
          <div className="dashboard-welcome-glow dashboard-glow-two" />
          <div className="relative z-10 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.16em] text-violet-100 backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5" /> Your campus, one place
              </div>
              <p className="mb-2 text-sm font-medium text-violet-200">{new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''} 👋</p>
              <h1 className="max-w-2xl font-heading text-3xl font-bold leading-[1.08] tracking-tight text-white sm:text-4xl lg:text-[46px]">
                {settings.hero_title || 'Find your people. Make campus yours.'}
              </h1>
              {settings.hero_subtitle && <p className="mt-4 max-w-xl text-sm leading-6 text-violet-100/85 sm:text-base">{settings.hero_subtitle}</p>}
              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={() => onNavigate('community')} className="dashboard-primary-cta">Explore community <ArrowUpRight className="h-4 w-4" /></button>
                <button onClick={() => onNavigate('events')} className="dashboard-secondary-cta"><CalendarDays className="h-4 w-4" /> Discover events</button>
              </div>
            </div>
            <div className="relative z-10 grid grid-cols-3 gap-2 sm:gap-3 lg:min-w-[290px]">
              <div className="dashboard-mini-stat"><CalendarDays className="mb-3 h-4 w-4 text-violet-200"/><span className="text-2xl font-bold text-white">{upcomingEvents.length}</span><span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-violet-200">Upcoming</span></div>
              <div className="dashboard-mini-stat"><Images className="mb-3 h-4 w-4 text-violet-200"/><span className="text-2xl font-bold text-white">{images.length}</span><span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-violet-200">Photos</span></div>
              <div className="dashboard-mini-stat"><Film className="mb-3 h-4 w-4 text-violet-200"/><span className="text-2xl font-bold text-white">{videos.length}</span><span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-violet-200">Videos</span></div>
            </div>
          </div>
          {isSuperAdmin && <button onClick={() => onNavigate('admin')} className="absolute right-5 top-5 z-20 inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"><Settings2 className="h-3.5 w-3.5" /> Edit home</button>}
        </section>

        {/* Quick actions */}
        <section aria-label="Quick actions" className="space-y-4">
          <div className="flex items-end justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-brand-600 dark:text-brand-300">Get started</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-900 dark:text-white">Your campus shortcuts</h2></div><span className="hidden items-center gap-1.5 text-xs text-slate-400 sm:flex"><Clock3 className="h-3.5 w-3.5" /> A little closer to campus</span></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            { label: 'Join a chat', detail: 'Meet students in real time', icon: MessageSquare, page: 'chat' as Page, tint: 'shortcut-lilac', number: '01' },
            { label: 'Messages', detail: 'Pick up the conversation', icon: MessageCircle, page: 'messages' as Page, tint: 'shortcut-blue', number: '02' },
            { label: 'Explore colleges', detail: 'Find your campus circle', icon: Compass, page: 'colleges' as Page, tint: 'shortcut-mint', number: '03' },
            { label: 'Your profile', detail: 'Show people who you are', icon: UserRound, page: 'profile' as Page, tint: 'shortcut-peach', number: '04' },
            { label: 'Student planner', detail: 'Keep deadlines under control', icon: CalendarDays, page: 'planner' as Page, tint: 'shortcut-lilac', number: '05' },
            { label: 'Study tools', detail: 'Learn smarter with focused tools', icon: Sparkles, page: 'studydesk' as Page, tint: 'shortcut-blue', number: '06' },
            { label: 'Career coach', detail: 'Prepare for your next opportunity', icon: Compass, page: 'careercoach' as Page, tint: 'shortcut-mint', number: '07' },
            { label: 'Collaborate', detail: 'Find teammates for projects', icon: MessageCircle, page: 'collaborate' as Page, tint: 'shortcut-peach', number: '08' },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <button key={action.page} onClick={() => onNavigate(action.page)} className="dashboard-shortcut group">
                <div className="flex items-start justify-between"><span className={`dashboard-shortcut-icon ${action.tint}`}><Icon className="h-5 w-5" /></span><span className="dashboard-shortcut-number">{action.number}</span></div>
                <span className="mt-5 block text-[15px] font-bold text-slate-900 transition-colors group-hover:text-brand-700 dark:text-slate-100 dark:group-hover:text-brand-300">{action.label}</span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">{action.detail}</span>
                <span className="dashboard-shortcut-arrow"><ArrowUpRight className="h-4 w-4" /></span>
              </button>
            );
          })}
          </div>
        </section>

        {/* Slideshow */}
        {settings.show_slideshow && slides.length > 0 && (
          <Slideshow slides={slides} onNavigate={onNavigate} />
        )}

        {/* Events */}
        {settings.show_events && (
          <section>
            <SectionHeader icon={CalendarDays} title="Upcoming events" actionLabel="All events" onAction={() => onNavigate('events')} />
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 py-6">No upcoming events yet.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {upcomingEvents.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onNavigate('events')}
                    className="group flex gap-4 text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 hover:border-brand-300 dark:hover:border-brand-500/50 hover:shadow-lg hover:shadow-brand-600/5 transition-all"
                  >
                    <div className="shrink-0 w-16 h-16 rounded-xl bg-brand-50 dark:bg-brand-500/15 flex flex-col items-center justify-center text-brand-700 dark:text-brand-200">
                      <span className="font-heading text-2xl font-semibold leading-none">{new Date(`${e.event_date}T12:00:00`).getDate()}</span>
                      <span className="text-xs font-medium mt-1">{new Date(`${e.event_date}T12:00:00`).toLocaleDateString([], { month: 'short' })}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-heading font-semibold text-slate-900 dark:text-slate-100 leading-snug group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">{e.title}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">{e.description}</p>
                      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{formatRange(e.event_date, e.end_date)}</span>
                        <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{e.category}</span>
                        {e.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{e.location}</span>}
                        {e.college && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{e.college.name}</span>}
                        {e.visibility === 'college' && <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300"><Lock className="w-3 h-3" />College only</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Images */}
        {settings.show_images && images.length > 0 && (
          <section>
            <SectionHeader icon={Images} title="Images" actionLabel="Open gallery" onAction={() => onNavigate('gallery')} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {images.slice(0, IMAGE_LIMIT).map((item, i) => (
                <MediaCard key={item.id} item={item} onClick={() => setLightbox({ list: images.slice(0, IMAGE_LIMIT), index: i })} />
              ))}
            </div>
          </section>
        )}

        {/* Videos */}
        {settings.show_videos && videos.length > 0 && (
          <section>
            <SectionHeader icon={Film} title="Videos" actionLabel="Open gallery" onAction={() => onNavigate('gallery')} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {videos.slice(0, VIDEO_LIMIT).map((item, i) => (
                <MediaCard key={item.id} item={item} onClick={() => setLightbox({ list: videos.slice(0, VIDEO_LIMIT), index: i })} />
              ))}
            </div>
          </section>
        )}
      </div>

      {lightbox && (
        <Lightbox
          items={lightbox.list}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNavigate={(index) => setLightbox({ list: lightbox.list, index })}
        />
      )}
    </div>
  );
}
