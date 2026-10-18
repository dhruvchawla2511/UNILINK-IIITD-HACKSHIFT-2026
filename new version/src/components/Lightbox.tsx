import { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Image as ImageIcon, Video, User } from 'lucide-react';
import type { MediaItem } from '@/data/images';

interface LightboxProps {
  items: MediaItem[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function Lightbox({ items, index, onClose, onNavigate }: LightboxProps) {
  const item = items[index];

  const goNext = useCallback(() => {
    onNavigate((index + 1) % items.length);
  }, [index, items.length, onNavigate]);

  const goPrev = useCallback(() => {
    onNavigate((index - 1 + items.length) % items.length);
  }, [index, items.length, onNavigate]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose, goNext, goPrev]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 sm:p-6"
      onClick={onClose}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 z-10 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        aria-label="Close"
      >
        <X className="w-6 h-6" />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); goPrev(); }}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        aria-label="Previous"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); goNext(); }}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        aria-label="Next"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      <div
        className="max-w-5xl w-full max-h-[90vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full flex-1 flex items-center justify-center min-h-0">
          {item.type === 'image' ? (
            <img
              src={item.url}
              alt={item.title}
              className="max-w-full max-h-[75vh] object-contain rounded-xl"
            />
          ) : (
            <video
              src={item.url}
              controls
              autoPlay
              className="max-w-full max-h-[75vh] rounded-xl"
            />
          )}
        </div>

        <div className="mt-4 text-center text-white px-4 w-full">
          <div className="flex items-center justify-center gap-2 mb-1">
            {item.type === 'image' ? (
              <ImageIcon className="w-4 h-4 text-brand-400" />
            ) : (
              <Video className="w-4 h-4 text-emerald-400" />
            )}
            <span className="text-xs font-medium text-slate-400">
              {item.category}
            </span>
          </div>
          <h3 className="text-lg font-semibold mb-1">{item.title}</h3>
          <p className="text-sm text-slate-300 max-w-2xl mx-auto mb-2">{item.description}</p>
          <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              {item.author}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {index + 1} of {items.length}
          </p>
        </div>
      </div>
    </div>
  );
}
