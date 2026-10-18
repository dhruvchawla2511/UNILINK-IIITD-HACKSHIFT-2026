import { Image as ImageIcon, Video, User, Film } from 'lucide-react';
import type { MediaItem } from '@/data/images';

interface MediaCardProps {
  item: MediaItem;
  onClick: () => void;
}

export function MediaCard({ item, onClick }: MediaCardProps) {
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800 aspect-[4/3] shadow-sm hover:shadow-xl transition-all duration-300 text-left"
    >
      {item.thumbnailUrl ? (
        <img
          src={item.thumbnailUrl}
          alt={item.title}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900">
          <Film className="w-10 h-10 text-slate-400" />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-60 group-hover:opacity-90 transition-opacity duration-300" />

      <div className="absolute top-3 left-3 flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 backdrop-blur-sm">
          {item.type === 'image' ? (
            <ImageIcon className="w-3.5 h-3.5 text-brand-500" />
          ) : (
            <Video className="w-3.5 h-3.5 text-emerald-500" />
          )}
          {item.type}
        </span>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 text-white translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
        <span className="text-xs font-medium text-brand-200">
          {item.category}
        </span>
        <h3 className="text-base font-semibold leading-tight mt-0.5">{item.title}</h3>
        <p className="text-xs text-slate-200 mt-1 flex items-center gap-1">
          <User className="w-3 h-3" />
          {item.author}
        </p>
      </div>
    </button>
  );
}
