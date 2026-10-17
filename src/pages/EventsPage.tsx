import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type EventItem, type EventVisibility, type College, type Profile } from '@/lib/supabase';
import { isGlobalAdmin, officerLevel, COLLEGE_RANK } from '@/lib/collegeRoles';
import {
  CalendarDays, MapPin, Plus, X, Loader2, Clock, User,
  Building2, Search, Trash2, Tag, Lock
} from 'lucide-react';

const CATEGORIES = ['general', 'tech', 'cultural', 'sports', 'career', 'workshop', 'social'];

export default function EventsPage() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');

  const loadEvents = useCallback(async () => {
    const { data } = await supabase
      .from('events')
      .select('*, college:colleges(*), creator:profiles!created_by(*)')
      .order('event_date', { ascending: true });
    if (data) setEvents(data as EventItem[]);

    const { data: collegeData } = await supabase.from('colleges').select('*').order('name');
    if (collegeData) setColleges(collegeData as College[]);

    setLoading(false);
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const deleteEvent = async (id: string) => {
    await supabase.from('events').delete().eq('id', id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const filtered = events.filter((e) => {
    const matchesSearch = e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase());
    const matchesCat = filterCat === 'all' || e.category === filterCat;
    return matchesSearch && matchesCat;
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(`${dateStr}T12:00:00`);
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatEventRange = (start: string, end?: string | null) => {
    const finish = end || start;
    return finish && finish !== start ? `${formatDate(start)} – ${formatDate(finish)}` : formatDate(start);
  };

  // Date-only strings are parsed as local noon (a bare 'YYYY-MM-DD' is read as UTC midnight, which is the previous day west of UTC).
  const isUpcoming = (dateStr: string) => new Date(`${dateStr}T12:00:00`) >= new Date(new Date().toDateString());

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        <section className="events-hero mb-7 flex flex-wrap items-end justify-between gap-5 rounded-[28px] p-6 sm:p-8">
          <div className="max-w-2xl">
            <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.16em] text-white"><CalendarDays className="h-3.5 w-3.5"/> Campus calendar</span>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">Make your next <span className="events-hero-accent">memory here.</span></h1>
            <p className="mt-3 text-sm leading-6 text-indigo-100/85 sm:text-base">Discover workshops, cultural nights, career opportunities and meetups happening across campuses.</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="events-hero-button"><Plus className="w-4 h-4" /> Post an event</button>
        </section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-heading text-lg font-semibold text-slate-900 dark:text-slate-100">Explore events</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{filtered.length} {filtered.length === 1 ? 'event' : 'events'} to explore</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events..."
              className="w-full pl-10 pr-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
            <button
              onClick={() => setFilterCat('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                filterCat === 'all' ? 'bg-brand-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap capitalize transition-colors ${
                  filterCat === cat ? 'bg-brand-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Events grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No events found. Be the first to post!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((event) => {
              const upcoming = isUpcoming(event.end_date || event.event_date);
              const isOwn = event.created_by === profile?.id;
              return (
                <div
                  key={event.id}
                  className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:shadow-lg hover:border-brand-200 dark:hover:border-brand-500/40 transition-all animate-fade-in"
                >
                  {/* Date strip */}
                  <div className={`h-1 ${upcoming ? 'bg-gradient-to-r from-brand-500 to-accent-500' : 'bg-slate-200 dark:bg-slate-700'}`} />

                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        upcoming ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}>
                        {upcoming ? 'Upcoming' : 'Past'}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Tag className="w-3 h-3" /> {event.category}
                      </span>
                    </div>
                    {event.visibility === 'college' && (
                      <span
                        title="Only verified students of this college (and admins) can see this event"
                        className="inline-flex items-center gap-1 mb-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      >
                        <Lock className="w-3 h-3" /> {event.college?.name ? `${event.college.name} only` : 'College only'}
                      </span>
                    )}

                    <h3 className="font-heading font-semibold text-slate-900 dark:text-slate-100 text-sm mb-2 leading-tight">{event.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">{event.description}</p>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {formatEventRange(event.event_date, event.end_date)}
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {event.location}
                        </div>
                      )}
                      {event.college && (
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {event.college.name}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {event.creator?.full_name ?? 'Unknown'}
                      </div>
                    </div>

                    {isOwn && (
                      <button
                        onClick={() => deleteEvent(event.id)}
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs text-red-500 hover:text-red-600 mt-3 transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && profile && (
        <CreateEventModal
          profile={profile}
          userId={profile.id}
          collegeId={profile.college_id}
          colleges={colleges}
          onClose={() => setShowCreate(false)}
          onCreated={() => { loadEvents(); setShowCreate(false); }}
        />
      )}
    </div>
  );
}

function CreateEventModal({
  profile,
  userId,
  collegeId,
  colleges,
  onClose,
  onCreated,
}: {
  profile: Profile;
  userId: string;
  collegeId: string | null;
  colleges: College[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('general');
  const [college, setCollege] = useState(collegeId ?? '');
  const [visibility, setVisibility] = useState<EventVisibility>('everyone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only college officers (committee head and above) can limit an event to their own college; website admins can do it for any college.
  // The server checks this too (server/policies.js).
  const isAdmin = isGlobalAdmin(profile);
  const canLimit = isAdmin || officerLevel(profile) >= COLLEGE_RANK.committee_head;
  const collegeOnly = canLimit && visibility === 'college';
  const ownCollege = colleges.find((c) => c.id === profile.college_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (collegeOnly && !college) return setError('Choose the college this event is for');
    if (!eventDate) return setError('Choose a start date');
    if (endDate && endDate < eventDate) return setError('The end date must be on or after the start date');
    setLoading(true);
    setError(null);
    const { error } = await supabase.from('events').insert({
      title,
      description,
      event_date: eventDate,
      end_date: endDate || eventDate,
      location: location || null,
      category,
      college_id: college || null,
      visibility: collegeOnly ? 'college' : 'everyone',
      created_by: userId,
    });
    if (error) { setError(error.message); setLoading(false); return; }
    onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6 animate-slide-up max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-semibold text-lg text-slate-900 dark:text-slate-100">Post Event</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required type="text" placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
          <textarea required placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Start date<input required type="date" value={eventDate} onChange={(e) => { setEventDate(e.target.value); if (endDate && e.target.value > endDate) setEndDate(e.target.value); }} className="mt-1 w-full min-w-0 px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" /></label>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">End date<input required type="date" min={eventDate || undefined} value={endDate || eventDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full min-w-0 px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" /></label>
          </div>
          <input type="text" placeholder="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 capitalize">
            {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
          </select>
          <select value={college} onChange={(e) => setCollege(e.target.value)}
            disabled={collegeOnly && !isAdmin}
            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60">
            <option value="">No specific college</option>
            {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {canLimit && (
            <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Who can see this event?</p>
              <div className="grid grid-cols-2 gap-2">
                {([['everyone', 'Everyone'], ['college', 'My college only']] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setVisibility(value);
                      if (value === 'college' && !isAdmin && profile.college_id) setCollege(profile.college_id); // officers: their own college
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                      visibility === value
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900'
                    }`}
                  >
                    {isAdmin && value === 'college' ? 'Selected college only' : label}
                  </button>
                ))}
              </div>
              {collegeOnly && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Only verified students of {(isAdmin ? colleges.find((c) => c.id === college)?.name : ownCollege?.name) ?? 'the chosen college'}, admins and you will see it. It is also hidden from the Home page for everyone else.
                </p>
              )}
            </div>
          )}
          {error && <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2">{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Post Event</>}
          </button>
        </form>
      </div>
    </div>
  );
}
