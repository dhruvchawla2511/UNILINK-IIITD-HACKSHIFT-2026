import { useCallback, useEffect, useRef, useState } from 'react';
import { BadgeCheck, Flag, Loader2, MessageSquare, RefreshCw, UserPlus, type LucideIcon } from 'lucide-react';
import { apiPost } from '@/lib/supabase';

interface DashboardData {
  days: number;
  counts: {
    new_signups: number;
    total_users: number;
    pending_verifications: number;
    active_rooms: number;
    total_rooms: number;
    open_reports: number;
    new_reports: number;
    community_posts: number;
    active_marketplace_listings: number;
    upcoming_events: number;
    study_groups: number;
  };
  daily: { date: string; signups: number; messages: number; reports: number }[];
}

type Metric = 'messages' | 'signups' | 'reports';
type Period = 7 | 14 | 30;

const PERIODS: Period[] = [7, 14, 30];
const REFRESH_MS = 60_000;

const METRICS: Record<Metric, { label: string; unit: string; bar: string; hover: string; chip: string }> = {
  messages: { label: 'Messages', unit: 'message', bar: 'fill-brand-500', hover: 'fill-brand-700 dark:fill-brand-300', chip: 'bg-brand-500' },
  signups: { label: 'Signups', unit: 'signup', bar: 'fill-accent-500', hover: 'fill-accent-700 dark:fill-accent-300', chip: 'bg-accent-500' },
  reports: { label: 'Reports', unit: 'report', bar: 'fill-red-500', hover: 'fill-red-700 dark:fill-red-300', chip: 'bg-red-500' },
};

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

/** "2026-10-13" as a calendar day in the viewer's own timezone (the server already cut the days there). */
const parseDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const longDay = (iso: string) => parseDay(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const shortDay = (iso: string) => parseDay(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** Round the top of the axis up to a tidy whole number, so gridlines land on integers. */
function niceMax(max: number): { top: number; step: number } {
  if (max <= 4) return { top: 4, step: 1 };
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
  return { top: step * 4, step };
}

function StatCard({
  icon: Icon,
  label,
  value,
  note,
  tone,
  attention,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  note: string;
  tone: string;
  attention?: boolean;
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${tone}`}>
          <Icon className="w-[18px] h-[18px]" />
        </span>
      </div>
      <p className="font-heading text-3xl font-bold text-slate-900 dark:text-slate-100 mt-3 tabular-nums">
        {value.toLocaleString()}
        {attention && value > 0 && <span className="sr-only"> need attention</span>}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{note}</p>
    </>
  );
  const cls = 'text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4';
  return onClick ? (
    <button onClick={onClick} className={`${cls} hover:border-brand-300 dark:hover:border-brand-500/50 hover:shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function BarChart({ data, metric }: { data: DashboardData['daily']; metric: Metric }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 260;
  const pad = { l: 36, r: 8, t: 10, b: 28 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const values = data.map((d) => d[metric]);
  const { top, step } = niceMax(Math.max(0, ...values));
  const slot = innerW / data.length;
  const barW = Math.max(3, Math.min(34, slot * 0.7));
  const y = (v: number) => pad.t + innerH - (v / top) * innerH;
  const labelEvery = data.length > 20 ? 4 : data.length > 10 ? 2 : 1;
  const cfg = METRICS[metric];
  const total = values.reduce((a, b) => a + b, 0);
  const shown = hover ?? data.length - 1; // the readout above the chart defaults to today

  return (
    <div>
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-2" aria-live="polite">
        <span className="font-semibold text-slate-900 dark:text-slate-100">{plural(values[shown], cfg.unit)}</span>{' '}
        {hover === null && shown === data.length - 1 ? 'today' : `on ${longDay(data[shown].date)}`}
        <span className="text-slate-400 dark:text-slate-500"> · {plural(total, cfg.unit)} in {data.length} days</span>
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Daily ${cfg.label.toLowerCase()} for the last ${data.length} days: ${values.join(', ')}`}
        onMouseLeave={() => setHover(null)}
      >
        {Array.from({ length: top / step + 1 }, (_, i) => i * step).map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="stroke-slate-200 dark:stroke-slate-800" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="fill-slate-400 dark:fill-slate-500 text-[11px]">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const v = d[metric];
          const x = pad.l + slot * i + (slot - barW) / 2;
          const h = Math.max(v > 0 ? 2 : 0, pad.t + innerH - y(v));
          const isLast = i === data.length - 1;
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)}>
              {/* a full-height invisible strip makes small bars easy to hover */}
              <rect x={pad.l + slot * i} y={pad.t} width={slot} height={innerH} fill="transparent" />
              <rect x={x} y={pad.t + innerH - h} width={barW} height={h} rx={Math.min(3, barW / 2)} className={hover === i ? cfg.hover : cfg.bar} opacity={hover === null || hover === i ? 1 : 0.55}>
                <title>{`${longDay(d.date)}: ${plural(v, cfg.unit)}`}</title>
              </rect>
              {(data.length - 1 - i) % labelEvery === 0 && (
                <text x={x + barW / 2} y={H - 8} textAnchor="middle" className={`text-[11px] ${isLast ? 'fill-slate-700 dark:fill-slate-200 font-semibold' : 'fill-slate-400 dark:fill-slate-500'}`}>
                  {shortDay(d.date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Admin landing tab: four headline numbers and a daily activity chart.
 * Everything comes from one server call (POST /api/admin/dashboard); days are cut at the viewer's local midnight.
 */
export default function Dashboard({ onOpenTab }: { onOpenTab?: (tab: 'verifications' | 'rooms') => void }) {
  const [period, setPeriod] = useState<Period>(14);
  const [metric, setMetric] = useState<Metric>('messages');
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(0);

  const load = useCallback(
    async (quiet = false) => {
      const ticket = ++latest.current;
      if (quiet) setRefreshing(true);
      const { data: d, error: e } = await apiPost<DashboardData>('/api/admin/dashboard', { days: period, tz_offset: -new Date().getTimezoneOffset() });
      if (ticket !== latest.current) return; // a newer request has started
      if (e || !d) setError(e?.message ?? 'Could not load the dashboard');
      else {
        setError(null);
        setData(d);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [period]
  );

  useEffect(() => {
    setLoading(true);
    load();
    const id = window.setInterval(() => load(true), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  if (loading && !data) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  const c = data?.counts;
  const days = data?.days ?? period;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading font-semibold text-lg text-slate-900 dark:text-slate-100">Dashboard</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">What is happening on Unilink. Updates every minute.</p>
        </div>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Time period" className="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                aria-pressed={period === p}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${period === p ? 'bg-white dark:bg-slate-900 text-brand-700 dark:text-brand-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                {p} days
              </button>
            ))}
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh"
            title="Refresh"
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="text-sm px-3 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30">
          {error}
          {data && ' Showing the last numbers that loaded.'}
        </div>
      )}

      {data && c && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              icon={UserPlus}
              label="New signups"
              value={c.new_signups}
              note={`in the last ${days} days · ${c.total_users.toLocaleString()} in total`}
              tone="bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-300"
            />
            <StatCard
              icon={BadgeCheck}
              label="Pending verifications"
              value={c.pending_verifications}
              note={c.pending_verifications ? 'waiting for approval · review' : 'nothing waiting'}
              tone="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300"
              attention
              onClick={onOpenTab ? () => onOpenTab('verifications') : undefined}
            />
            <StatCard
              icon={MessageSquare}
              label="Active rooms"
              value={c.active_rooms}
              note={`had messages in the last ${days} days · ${c.total_rooms.toLocaleString()} in total`}
              tone="bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-300"
              onClick={onOpenTab ? () => onOpenTab('rooms') : undefined}
            />
            <StatCard
              icon={Flag}
              label="Open reports"
              value={c.open_reports}
              note={`reported messages to review · ${c.new_reports.toLocaleString()} new reports in ${days} days`}
              tone="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300"
              attention
            />
          </div>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard icon={MessageSquare} label="Community posts" value={c.community_posts} note="published posts" tone="bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-300" />
            <StatCard icon={BadgeCheck} label="Marketplace listings" value={c.active_marketplace_listings} note="currently active" tone="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" />
            <StatCard icon={UserPlus} label="Upcoming events" value={c.upcoming_events} note="scheduled events" tone="bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-300" />
            <StatCard icon={MessageSquare} label="Study groups" value={c.study_groups} note="created groups" tone="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300" />
          </div>
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="font-heading font-semibold text-slate-900 dark:text-slate-100">Daily activity</h3>
              <div role="group" aria-label="Chart metric" className="flex gap-1">
                {(Object.keys(METRICS) as Metric[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMetric(m)}
                    aria-pressed={metric === m}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full border transition ${
                      metric === m
                        ? 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${METRICS[m].chip}`} />
                    {METRICS[m].label}
                  </button>
                ))}
              </div>
            </div>
            <BarChart key={`${metric}-${days}`} data={data.daily} metric={metric} />
          </section>
        </>
      )}
    </div>
  );
}
