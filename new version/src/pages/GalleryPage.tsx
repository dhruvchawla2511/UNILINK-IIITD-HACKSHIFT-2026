import { useMemo, useState } from 'react';
import { Images, Film, LayoutGrid, Search } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { useMediaItems } from '@/lib/content';
import { MediaCard } from '@/components/MediaCard';
import { Lightbox } from '@/components/Lightbox';

type Tab = 'all' | 'image' | 'video';

const tabs: { key: Tab; label: string; icon: typeof Images }[] = [
  { key: 'all', label: 'All', icon: LayoutGrid },
  { key: 'image', label: 'Images', icon: Images },
  { key: 'video', label: 'Videos', icon: Film },
];

export default function GalleryPage() {
  const { items: allMedia, loading } = useMediaItems();
  const [tab, setTab] = useState<Tab>('all');
  const [category, setCategory] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const categories = useMemo(() => Array.from(new Set(allMedia.map((m) => m.category))).sort(), [allMedia]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allMedia.filter((item) => {
      if (tab !== 'all' && item.type !== tab) return false;
      if (category !== 'All' && item.category !== category) return false;
      if (q) {
        return (
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.author.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allMedia, tab, category, search]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="font-heading text-3xl sm:text-4xl font-semibold text-slate-900 dark:text-slate-100">
          Campus Gallery
        </h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400 max-w-2xl">
          Browse a curated collection of images and videos. Click any item to view it full-screen.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 gap-1 self-start">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-medium transition-all ${
                  tab === key
                    ? 'bg-white dark:bg-slate-900 dark:bg-slate-700 text-slate-900 dark:text-slate-100 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, author..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 dark:border-slate-700 bg-white dark:bg-slate-900 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {['All', ...categories].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                category === cat
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-slate-400 dark:text-slate-500 text-lg">
                No media found. Try adjusting your filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((item, i) => (
                <MediaCard key={item.id} item={item} onClick={() => setLightboxIndex(i)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          items={filtered}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}
