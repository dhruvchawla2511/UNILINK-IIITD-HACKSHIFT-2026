import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import type { HomeSlide } from '@/lib/supabase';
import type { Page } from '@/components/Layout';

interface SlideshowProps {
  slides: HomeSlide[];
  onNavigate: (page: Page) => void;
  intervalMs?: number;
}

const validPages: Page[] = ['chat', 'colleges', 'events', 'gallery', 'profile', 'home'];

export function Slideshow({ slides, onNavigate, intervalMs = 5500 }: SlideshowProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  useEffect(() => {
    if (count < 2 || paused) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % count), intervalMs);
    return () => window.clearInterval(t);
  }, [count, paused, intervalMs]);

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  if (count === 0) return null;

  const go = (i: number) => setIndex((i + count) % count);

  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-slate-200 dark:bg-slate-800 h-56 sm:h-72 lg:h-96 shadow-sm"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      {slides.map((s, i) => {
        const target = s.link_page && validPages.includes(s.link_page as Page) ? (s.link_page as Page) : null;
        return (
          <div
            key={s.id}
            className={`absolute inset-0 transition-opacity duration-700 ${i === index ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            aria-hidden={i !== index}
          >
            <img src={s.image_url} alt={s.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 text-white">
              {s.title && <h3 className="font-heading text-xl sm:text-3xl font-bold leading-tight">{s.title}</h3>}
              {s.subtitle && <p className="mt-1 text-sm sm:text-base text-slate-200 max-w-2xl">{s.subtitle}</p>}
              {target && (
                <button
                  onClick={() => onNavigate(target)}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-sm text-sm font-medium transition-colors"
                >
                  Explore <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}

      {count > 1 && (
        <>
          <button
            onClick={() => go(index - 1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => go(index + 1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
            aria-label="Next slide"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-3 right-4 flex gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
