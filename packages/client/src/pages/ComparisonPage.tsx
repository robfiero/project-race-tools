import { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, Cell,
  LineChart, Line,
  ComposedChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { apiUrl } from '../api.ts';
import type { ComparisonStats, CrossEventTrendRow, IntervalStats, TrendPoint } from '../types.ts';
import { useTheme } from '../ThemeContext.tsx';
import { chartPalette, genderColors } from '../chartColors.ts';
import EventFilter from '../components/EventFilter.tsx';
import SectionHeader from '../components/SectionHeader.tsx';
import IntervalComparisonPanel, {
  TrendCategorySelector,
  TrendLineChart,
  KeyChangesList,
  seriesDelta,
  fmtCountDelta,
  fmtPtsDelta,
  fmtYrsDelta,
  directionOf,
  type CategoryDef,
  type TrendSeries,
  type KeyChangeRow,
} from '../components/IntervalComparisonPanel.tsx';
import './ComparisonPage.css';

interface Props {
  sessions: Array<{ sessionId: string; label: string; raceName: string }>;
  onBack: () => void;
}

// ─── Trend card ───────────────────────────────────────────────────────────────

interface TrendCardProps {
  title: string;
  unit?: string;
  data: TrendPoint[];
  precision?: number;
}

function fmt(v: number | null, unit = '', precision = 1): string {
  if (v === null) return '—';
  const s = precision === 0 ? String(Math.round(v)) : v.toFixed(precision);
  return `${s}${unit}`;
}

const roundFmt = (v: number) => String(Math.round(v));

function TrendCard({ title, unit = '', data, precision = 1 }: TrendCardProps) {
  const { theme } = useTheme();
  if (data.length === 0) return null;

  const current = data[data.length - 1].value;
  const chartData = data.map(d => ({ label: d.label, value: d.value ?? 0 }));
  const colors = chartPalette(theme, chartData.length);

  // For 3 intervals show all labels; for 4–5 show only first and last to avoid clutter.
  // interval={0} forces Recharts to render every tick in the ticks array without auto-skipping.
  const showAll = chartData.length <= 3;
  const xTicks = showAll
    ? chartData.map(d => d.label)
    : [chartData[0].label, chartData[chartData.length - 1].label];

  return (
    <div className="trend-card card">
      <span className="trend-card-title">{title}</span>
      <div className="trend-card-value">{fmt(current, unit, precision)}</div>
      <div
        className="trend-card-chart"
        role="img"
        aria-label={`Bar chart showing ${title} trend across intervals`}
      >
        <ResponsiveContainer width="100%" height={60}>
          <BarChart data={chartData} barSize={40} margin={{ top: 2, right: 4, bottom: 0, left: 4 }}>
            <XAxis dataKey="label" ticks={xTicks} interval={0} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis hide domain={[0, 'auto']} />
            <Tooltip
              formatter={(v: number) => [fmt(v, unit, precision), title]}
              contentStyle={{ fontSize: '0.8rem' }}
            />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={colors[i]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Sub-selector types ───────────────────────────────────────────────────────

type ProfileMetric = 'gender' | 'age';

const PROFILE_METRICS: CategoryDef[] = [
  { id: 'gender', label: 'Gender' },
  { id: 'age',    label: 'Age' },
];

type DistanceMetric = 'median' | 'distribution';

const DISTANCE_METRICS: CategoryDef[] = [
  { id: 'median',       label: 'Median Travel Distance' },
  { id: 'distribution', label: 'Local vs. Destination' },
];

type EventMetric = keyof Omit<CrossEventTrendRow, 'eventName'>;

const EVENT_METRICS: Array<{ id: EventMetric; label: string; unit?: string }> = [
  { id: 'participantCount',    label: 'Participants' },
  { id: 'femalePercent',       label: 'Female %',       unit: '%' },
  { id: 'malePercent',         label: 'Male %',          unit: '%' },
  { id: 'nonBinaryPercent',    label: 'Non-Binary %',    unit: '%' },
  { id: 'avgAge',              label: 'Avg Age' },
  { id: 'medianAge',           label: 'Median Age' },
  { id: 'medianDistanceMiles', label: 'Median Miles Completed', unit: ' mi' },
];

// ─── Per-category table row definitions ──────────────────────────────────────

interface MetricRow {
  label: string;
  key: keyof ComparisonStats['trends'];
  unit?: string;
  precision?: number;
  deltaInvert?: boolean;
  neutral?: boolean;
}

const REGISTRATION_DROPS_ROWS: MetricRow[] = [
  { label: 'Total Registered',                  key: 'participantCount',          precision: 0, neutral: true },
  { label: 'Credit Card Active',                key: 'paidActive',                precision: 0 },
  { label: '100% Coupon Active',                key: 'couponActive',              precision: 0, neutral: true },
  { label: 'Gift Card Active',                  key: 'giftCardActive',            precision: 0, neutral: true },
  { label: 'Payment Pending (Next Statement)',                   key: 'paymentPending',            precision: 0, neutral: true },
  { label: 'Relay Team Member — Captain-pays model',                 key: 'relayJoins',                precision: 0, neutral: true },
  { label: 'Paid & Dropped',                    key: 'paidDropped',               precision: 0, deltaInvert: true },
  { label: 'Waitlist Not Invited',              key: 'waitlistNeverInvited',      precision: 0, neutral: true },
  { label: 'Waitlist Withdrawn/Declined Invitation',       key: 'waitlistWithdrawnDeclined', precision: 0, neutral: true },
];

const PROFILES_ROWS: MetricRow[] = [
  { label: 'Early Female %', key: 'earlyFemalePercent', unit: '%', neutral: true },
  { label: 'Late Female %',  key: 'lateFemalePercent',  unit: '%', neutral: true },
  { label: 'Early Male %',   key: 'earlyMalePercent',   unit: '%', neutral: true },
  { label: 'Late Male %',    key: 'lateMalePercent',    unit: '%', neutral: true },
  { label: 'Early Avg Age',  key: 'earlyAvgAge',                   neutral: true },
  { label: 'Late Avg Age',   key: 'lateAvgAge',                    neutral: true },
];

const GENDER_ROWS: MetricRow[] = [
  { label: 'Female %',     key: 'femalePercent',    unit: '%', neutral: true },
  { label: 'Male %',       key: 'malePercent',      unit: '%', neutral: true },
  { label: 'Non-Binary %', key: 'nonBinaryPercent', unit: '%', neutral: true },
];

const AGE_ROWS: MetricRow[] = [
  { label: 'Median Age', key: 'medianAge', precision: 0, neutral: true },
  { label: 'Mean Age',   key: 'meanAge',               neutral: true },
  { label: 'Youngest',   key: 'minAge',   precision: 0, neutral: true },
  { label: 'Oldest',     key: 'maxAge',   precision: 0, neutral: true },
];

const GEOGRAPHY_ROWS: MetricRow[] = [
  { label: 'States / Provinces',         key: 'stateCount',         precision: 0, neutral: true },
  { label: 'Countries',                  key: 'countryCount',       precision: 0, neutral: true },
  { label: 'International Participants', key: 'internationalCount', precision: 0, neutral: true },
];

const DISTANCE_TABLE_ROWS: MetricRow[] = [
  { label: 'Median Travel Distance',    key: 'medianDistanceMiles', unit: ' mi', neutral: true },
  { label: 'Local % (< 50 mi)',         key: 'localPercent',        unit: '%',   neutral: true },
  { label: 'Regional % (50–200 mi)',    key: 'regionalPercent',     unit: '%',   neutral: true },
  { label: 'Destination % (≥ 200 mi)', key: 'destinationPercent',  unit: '%',   neutral: true },
];

// ─── Key changes helpers ──────────────────────────────────────────────────────

function kc(
  label: string,
  data: TrendPoint[],
  type: 'count' | 'pts' | 'yrs' | 'mi',
  options?: { neutral?: boolean; invert?: boolean },
): KeyChangeRow {
  const delta = seriesDelta(data);
  const threshold = type === 'count' ? 0.5 : type === 'mi' ? 0.1 : 0.05;
  let formattedDelta: string;
  if (type === 'count') formattedDelta = fmtCountDelta(delta);
  else if (type === 'pts') formattedDelta = fmtPtsDelta(delta);
  else if (type === 'yrs') formattedDelta = fmtYrsDelta(delta);
  else {
    formattedDelta = delta === null || Math.abs(delta) < 0.1
      ? 'unchanged'
      : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} mi`;
  }
  return {
    label,
    formattedDelta,
    direction: directionOf(delta, threshold, options?.invert),
    neutral: options?.neutral ?? false,
  };
}

interface CategoryKeyChangesProps {
  rows: KeyChangeRow[];
  trends: ComparisonStats['trends'];
}

function CategoryKeyChanges({ rows, trends }: CategoryKeyChangesProps) {
  const pts = trends.participantCount;
  if (pts.length < 2) {
    return <p className="trend-line-empty">Need at least two intervals to show key changes.</p>;
  }
  return <KeyChangesList rows={rows} firstLabel={pts[0].label} lastLabel={pts[pts.length - 1].label} />;
}

// ─── Summary table (per-category) ────────────────────────────────────────────

function deltaClass(current: number | null, first: number | null, deltaInvert = false, neutral = false): string {
  if (current === null || first === null) return '';
  const d = current - first;
  if (neutral || Math.abs(d) < 0.05) return 'cmp-cell--neutral';
  return (deltaInvert ? d < 0 : d > 0) ? 'cmp-cell--good' : 'cmp-cell--bad';
}

interface SummaryTableProps {
  rows: MetricRow[];
  trends: ComparisonStats['trends'];
  labels: string[];
}

function SummaryTable({ rows, trends, labels }: SummaryTableProps) {
  return (
    <div className="cmp-table-scroll">
      <table className="stats-table cmp-table">
        <caption className="sr-only">Side-by-side comparison across intervals</caption>
        <thead>
          <tr>
            <th scope="col">Metric</th>
            {labels.map(lbl => <th scope="col" key={lbl}>{lbl}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const series = trends[row.key] as TrendPoint[];
            if (!series || series.length === 0) return null;
            const first = series[0].value;
            return (
              <tr key={row.key}>
                <td className="cmp-metric-label">{row.label}</td>
                {series.map((pt, i) => (
                  <td
                    key={pt.label}
                    className={i === 0 ? '' : deltaClass(pt.value, first, row.deltaInvert, row.neutral)}
                  >
                    {fmt(pt.value, row.unit ?? '', row.precision ?? 1)}
                    {i > 0 && pt.value !== null && first !== null && Math.abs(pt.value - first) >= 0.05 && (
                      <>
                        <span className="cmp-delta" aria-hidden="true">
                          {' '}{pt.value > first ? '▲' : '▼'}
                        </span>
                        <span className="sr-only">{pt.value > first ? ', increased' : ', decreased'}</span>
                      </>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Top States table ─────────────────────────────────────────────────────────

function TopStatesTable({ topStateTrends, labels }: { topStateTrends: ComparisonStats['topStateTrends']; labels: string[] }) {
  if (topStateTrends.length === 0) return <p className="trend-line-empty">No state data available.</p>;
  return (
    <div className="cmp-table-scroll">
      <table className="stats-table cmp-table">
        <caption className="sr-only">Top states by participant count across intervals</caption>
        <thead>
          <tr>
            <th scope="col">State</th>
            {labels.map(lbl => <th scope="col" key={lbl}>{lbl}</th>)}
          </tr>
        </thead>
        <tbody>
          {topStateTrends.map(row => {
            const first = row.counts[0]?.value ?? null;
            return (
              <tr key={row.state}>
                <td className="cmp-metric-label">{row.state}</td>
                {row.counts.map((pt, i) => (
                  <td key={pt.label} className={i === 0 ? '' : deltaClass(pt.value, first, false, true)}>
                    {pt.value !== null ? Math.round(pt.value).toLocaleString() : '—'}
                    {i > 0 && pt.value !== null && first !== null && Math.abs(pt.value - first) >= 0.5 && (
                      <span className="cmp-delta" aria-hidden="true">
                        {' '}{pt.value > first ? '▲' : '▼'}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Events table ─────────────────────────────────────────────────────────────

function EventsTable({ crossEventTrends, labels }: { crossEventTrends: CrossEventTrendRow[]; labels: string[] }) {
  if (crossEventTrends.length === 0) return <p className="trend-line-empty">No cross-event data available.</p>;
  return (
    <div className="cmp-table-scroll">
      <table className="stats-table cmp-table">
        <caption className="sr-only">Participant counts by event across intervals</caption>
        <thead>
          <tr>
            <th scope="col">Event</th>
            {labels.map(lbl => <th scope="col" key={lbl}>{lbl}</th>)}
          </tr>
        </thead>
        <tbody>
          {crossEventTrends.map(row => {
            const first = row.participantCount[0]?.value ?? null;
            return (
              <tr key={row.eventName}>
                <td className="cmp-metric-label">{row.eventName}</td>
                {row.participantCount.map((pt, i) => (
                  <td key={pt.label} className={i === 0 ? '' : deltaClass(pt.value, first, false, false)}>
                    {pt.value !== null ? Math.round(pt.value).toLocaleString() : '—'}
                    {i > 0 && pt.value !== null && first !== null && Math.abs(pt.value - first) >= 0.5 && (
                      <span className="cmp-delta" aria-hidden="true">
                        {' '}{pt.value > first ? '▲' : '▼'}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Registration & Drops combined chart ─────────────────────────────────────

function RegistrationDropsChart({ trends }: { trends: ComparisonStats['trends'] }) {
  const { theme } = useTheme();
  const ivLabels = trends.participantCount.map(p => p.label);
  const colors = chartPalette(theme, ivLabels.length);

  function grouped(metrics: Array<{ label: string; data: TrendPoint[] }>) {
    return metrics.map(({ label, data }) => {
      const row: Record<string, string | number> = { metric: label };
      data.forEach(pt => { row[pt.label] = pt.value ?? 0; });
      return row;
    });
  }

  const activeData = grouped([
    { label: 'Credit Card Active', data: trends.paidActive },
    { label: '100% Coupon Active', data: trends.couponActive },
    { label: 'Gift Card Active',   data: trends.giftCardActive },
    { label: 'Payment Pending (Next Statement)',    data: trends.paymentPending },
    { label: 'Relay Team Member — Captain-pays model',  data: trends.relayJoins },
  ]);

  const dropsData = grouped([
    { label: 'Paid & Dropped',           data: trends.paidDropped },
    { label: 'Waitlist Not Invited',      data: trends.waitlistNeverInvited },
    { label: 'Waitlist Withdrawn/Declined Invitation', data: trends.waitlistWithdrawnDeclined },
  ]);

  const hasDrops = dropsData.some(row => ivLabels.some(lbl => (row[lbl] as number) > 0));

  const sharedChart = (data: typeof activeData, height: number) => (
    <div className="chart-wrap chart-wrap--full">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} maxBarSize={28} barCategoryGap="15%" margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
          <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={v => Math.round(v).toLocaleString()} width={48} />
          <Tooltip formatter={(v: number, name: string) => [Math.round(v).toLocaleString(), name]} />
          <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
          {ivLabels.map((lbl, i) => (
            <Bar key={lbl} dataKey={lbl} fill={colors[i]} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <>
      <div className="chart-subsection">
        <h3 className="chart-subsection-title">Core Registration Status</h3>
        {sharedChart(activeData, 220)}
      </div>
      {hasDrops && (
        <div className="chart-subsection">
          <h3 className="chart-subsection-title">Drops & Waitlist</h3>
          {sharedChart(dropsData, 200)}
        </div>
      )}
    </>
  );
}

// ─── Registrant Profiles section ──────────────────────────────────────────────

function ProfilesSection({ trends }: { trends: ComparisonStats['trends'] }) {
  const [metric, setMetric] = useState<ProfileMetric>('gender');

  const seriesMap: Record<ProfileMetric, TrendSeries[]> = {
    gender: [
      { name: 'Early Female %', data: trends.earlyFemalePercent },
      { name: 'Late Female %',  data: trends.lateFemalePercent },
      { name: 'Early Male %',   data: trends.earlyMalePercent },
      { name: 'Late Male %',    data: trends.lateMalePercent },
    ],
    age: [
      { name: 'Early Avg Age', data: trends.earlyAvgAge },
      { name: 'Late Avg Age',  data: trends.lateAvgAge },
    ],
  };

  const formatTooltip = metric === 'age'
    ? (v: number) => `${Math.round(v)} yrs`
    : (v: number) => `${v.toFixed(1)}%`;

  return (
    <>
      <TrendCategorySelector categories={PROFILE_METRICS} active={metric} onChange={id => setMetric(id as ProfileMetric)} />
      <TrendLineChart
        series={seriesMap[metric]}
        formatY={metric === 'age' ? roundFmt : undefined}
        formatTooltipValue={formatTooltip}
        yUnit={metric === 'gender' ? '%' : ''}
      />
    </>
  );
}

// ─── Distance trend section ───────────────────────────────────────────────────

function DistanceMedianBarChart({ trends }: { trends: ComparisonStats['trends'] }) {
  const { theme } = useTheme();
  const data = trends.medianDistanceMiles.map(pt => ({ label: pt.label, value: pt.value ?? 0 }));
  const colors = chartPalette(theme, data.length);
  return (
    <div className="chart-wrap chart-wrap--full" role="img" aria-label="Bar chart: median travel distance by interval">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} maxBarSize={52} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v.toFixed(0)} mi`} width={52} />
          <Tooltip formatter={(v: number) => [`${v.toFixed(1)} mi`, 'Median Travel Distance']} />
          <Bar dataKey="value" name="Median Travel Distance" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={colors[i]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DistanceStackedBarChart({ trends }: { trends: ComparisonStats['trends'] }) {
  const { theme } = useTheme();
  const colors = chartPalette(theme, 3);
  const data = trends.localPercent.map((pt, i) => ({
    label: pt.label,
    'Local (< 50 mi)':        pt.value ?? 0,
    'Regional (50–200 mi)':   trends.regionalPercent[i]?.value ?? 0,
    'Destination (≥ 200 mi)': trends.destinationPercent[i]?.value ?? 0,
  }));
  return (
    <div className="chart-wrap chart-wrap--full" role="img" aria-label="Stacked bar chart: local, regional, and destination registrant share by interval">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} maxBarSize={52} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={v => `${v}%`} domain={[0, 100]} tick={{ fontSize: 11 }} width={40} />
          <Tooltip formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]} />
          <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
          <Bar dataKey="Local (< 50 mi)"        stackId="d" fill={colors[0]} />
          <Bar dataKey="Regional (50–200 mi)"   stackId="d" fill={colors[1]} />
          <Bar dataKey="Destination (≥ 200 mi)" stackId="d" fill={colors[2]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DistanceTrendSection({ trends }: { trends: ComparisonStats['trends'] }) {
  const [metric, setMetric] = useState<DistanceMetric>('median');
  return (
    <>
      <TrendCategorySelector categories={DISTANCE_METRICS} active={metric} onChange={id => setMetric(id as DistanceMetric)} />
      {metric === 'median'       && <DistanceMedianBarChart trends={trends} />}
      {metric === 'distribution' && <DistanceStackedBarChart trends={trends} />}
    </>
  );
}

// ─── Events section ───────────────────────────────────────────────────────────

function EventsSection({ crossEventTrends, hasDistanceTrend }: { crossEventTrends: CrossEventTrendRow[]; hasDistanceTrend: boolean }) {
  const { theme } = useTheme();
  const [metric, setMetric] = useState<EventMetric>('participantCount');
  const activeMetricDef = EVENT_METRICS.find(m => m.id === metric)!;

  const ivLabels = crossEventTrends[0]?.participantCount.map(p => p.label) ?? [];
  const colors = chartPalette(theme, ivLabels.length);

  const metricSelector = (
    <TrendCategorySelector
      categories={EVENT_METRICS.filter(m => m.id !== 'medianDistanceMiles' || hasDistanceTrend).map(m => ({ id: m.id, label: m.label }))}
      active={metric}
      onChange={id => setMetric(id as EventMetric)}
    />
  );

  const unit = activeMetricDef.unit ?? '';
  const barData = crossEventTrends.map(ev => {
    const name = ev.eventName.length > 24 ? `${ev.eventName.slice(0, 22)}…` : ev.eventName;
    const row: Record<string, string | number> = { event: name };
    (ev[metric] as TrendPoint[]).forEach(pt => { row[pt.label] = pt.value ?? 0; });
    return row;
  });

  const fmtTick = (v: number) => {
    if (unit === '%') return `${v.toFixed(1)}%`;
    if (unit === ' mi') return `${v.toFixed(0)} mi`;
    if (metric === 'avgAge' || metric === 'medianAge') return `${Math.round(v)}`;
    return Math.round(v).toLocaleString();
  };

  const fmtTooltip = (v: number) => {
    if (unit === '%') return `${v.toFixed(1)}%`;
    if (unit === ' mi') return `${v.toFixed(1)} mi`;
    if (metric === 'avgAge' || metric === 'medianAge') return `${Math.round(v)} yrs`;
    return Math.round(v).toLocaleString();
  };

  return (
    <>
      {metricSelector}
      <div className="chart-wrap chart-wrap--full" role="img" aria-label={`Grouped bar chart: ${activeMetricDef.label} by event and interval`}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={barData} maxBarSize={28} barCategoryGap="15%" margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
            <XAxis dataKey="event" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtTick} width={48} />
            <Tooltip formatter={(v: number, name: string) => [fmtTooltip(v), name]} />
            <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
            {ivLabels.map((lbl, i) => (
              <Bar key={lbl} dataKey={lbl} fill={colors[i]} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

// ─── Normalized cumulative registration chart ─────────────────────────────────

function buildNormalizedCumulative(intervals: IntervalStats[]) {
  const curves = intervals.map(iv => {
    const cum = iv.stats.registration.cumulative;
    if (cum.length < 2) return null;
    const lastMs     = new Date(cum[cum.length - 1].date).getTime();
    const finalTotal = cum[cum.length - 1].total || 1;
    const points = cum.map(pt => ({
      day: Math.round((new Date(pt.date).getTime() - lastMs) / 86400000),
      pct: Math.round(pt.total / finalTotal * 1000) / 10,
    }));
    return { label: iv.label, points };
  }).filter(Boolean) as Array<{ label: string; points: { day: number; pct: number }[] }>;

  if (curves.length === 0) return { chartData: [], minDay: 0 };

  const minDay = Math.min(...curves.flatMap(c => c.points.map(p => p.day)));
  const sampleDays: number[] = [];
  for (let d = minDay; d <= 0; d += 7) sampleDays.push(d);
  if (sampleDays[sampleDays.length - 1] !== 0) sampleDays.push(0);

  const chartData = sampleDays.map(day => {
    const row: Record<string, number | null> = { day };
    for (const { label, points } of curves) {
      if (day < points[0].day) { row[label] = null; continue; }
      const prior = [...points].filter(p => p.day <= day).pop();
      row[label] = prior?.pct ?? null;
    }
    return row;
  });

  return { chartData, minDay };
}

function NormalizedCumulativeChart({ intervals }: { intervals: IntervalStats[] }) {
  const { theme } = useTheme();
  const colors = chartPalette(theme, intervals.length);
  const { chartData, minDay } = buildNormalizedCumulative(intervals);
  if (chartData.length === 0) return null;

  const tickStep = Math.abs(minDay) > 200 ? 60 : 30;
  const ticks: number[] = [];
  for (let d = Math.ceil(minDay / tickStep) * tickStep; d <= 0; d += tickStep) ticks.push(d);
  if (ticks[ticks.length - 1] !== 0) ticks.push(0);

  return (
    <div className="chart-wrap chart-wrap--full" role="img" aria-label="Line chart: normalized cumulative registration rate by interval">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 8, right: 24, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
          <XAxis
            dataKey="day"
            type="number"
            domain={[minDay, 0]}
            ticks={ticks}
            tickFormatter={d => d === 0 ? 'Close' : `-${Math.abs(d)}d`}
            tick={{ fontSize: 11 }}
          />
          <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} width={40} />
          <Tooltip
            labelFormatter={d => d === 0 ? 'Registration close' : `${Math.abs(Number(d))} days before close`}
            formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]}
          />
          <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
          {intervals.map((iv, i) => (
            <Line
              key={iv.label}
              type="monotone"
              dataKey={iv.label}
              stroke={colors[i]}
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Day of Week chart ────────────────────────────────────────────────────────

const DOW_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DOW_SHORT  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function DayOfWeekChart({ intervals }: { intervals: IntervalStats[] }) {
  const { theme } = useTheme();
  const colors = chartPalette(theme, intervals.length);
  const chartData = DOW_ORDER.map((day, i) => {
    const row: Record<string, string | number> = { day: DOW_SHORT[i] };
    for (const iv of intervals) {
      const total = iv.stats.registration.byDayOfWeek.reduce((s, d) => s + d.count, 0);
      const entry = iv.stats.registration.byDayOfWeek.find(d => d.day === day);
      row[iv.label] = total > 0 ? Math.round((entry?.count ?? 0) / total * 1000) / 10 : 0;
    }
    return row;
  });

  return (
    <div className="chart-wrap chart-wrap--full" role="img" aria-label="Grouped bar chart: registration day of week by interval">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} maxBarSize={28} barCategoryGap="15%" margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
          <XAxis dataKey="day" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} width={40} />
          <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, '']} />
          <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
          {intervals.map((iv, i) => (
            <Bar key={iv.label} dataKey={iv.label} fill={colors[i]} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Hour of Day chart ────────────────────────────────────────────────────────

const HOUR_BLOCKS = [
  { label: '12am–4am', hours: [0, 1, 2, 3] },
  { label: '4am–8am',  hours: [4, 5, 6, 7] },
  { label: '8am–12pm', hours: [8, 9, 10, 11] },
  { label: '12pm–4pm', hours: [12, 13, 14, 15] },
  { label: '4pm–8pm',  hours: [16, 17, 18, 19] },
  { label: '8pm–12am', hours: [20, 21, 22, 23] },
];

function HourOfDayChart({ intervals }: { intervals: IntervalStats[] }) {
  const { theme } = useTheme();
  const colors = chartPalette(theme, intervals.length);
  const chartData = HOUR_BLOCKS.map(block => {
    const row: Record<string, string | number> = { label: block.label };
    for (const iv of intervals) {
      const total = iv.stats.registration.byHourOfDay.reduce((s, h) => s + h.count, 0);
      const blockCount = block.hours.reduce((s, h) => {
        return s + (iv.stats.registration.byHourOfDay.find(d => d.hour === h)?.count ?? 0);
      }, 0);
      row[iv.label] = total > 0 ? Math.round(blockCount / total * 1000) / 10 : 0;
    }
    return row;
  });

  return (
    <div className="chart-wrap chart-wrap--full" role="img" aria-label="Grouped bar chart: registration hour of day by interval">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} maxBarSize={28} barCategoryGap="15%" margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} width={40} />
          <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, '']} />
          <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
          {intervals.map((iv, i) => (
            <Bar key={iv.label} dataKey={iv.label} fill={colors[i]} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Combined age distribution ────────────────────────────────────────────────

function CombinedAgeDistributionChart({ intervals }: { intervals: IntervalStats[] }) {
  const { theme } = useTheme();
  const colors = chartPalette(theme, intervals.length);
  const labelSet = new Set<string>();
  for (const iv of intervals) {
    for (const b of iv.stats.age.buckets) labelSet.add(b.label);
  }
  const labels = [...labelSet];
  if (labels.length === 0) return null;

  const chartData = labels.map(label => {
    const row: Record<string, string | number> = { label };
    for (const iv of intervals) {
      const bucket = iv.stats.age.buckets.find(b => b.label === label);
      row[iv.label] = bucket?.count ?? 0;
    }
    return row;
  });

  return (
    <div className="chart-wrap chart-wrap--full" role="img" aria-label="Grouped bar chart: age distribution by interval">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} maxBarSize={28} barCategoryGap="15%" margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number, name: string) => [v.toLocaleString(), name]} />
          <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
          {intervals.map((iv, i) => (
            <Bar key={iv.label} dataKey={iv.label} fill={colors[i]} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Gender stacked bar ───────────────────────────────────────────────────────

function GenderStackedBarChart({ trends }: { trends: ComparisonStats['trends'] }) {
  const { theme } = useTheme();
  const gc = genderColors(theme);
  const data = trends.femalePercent.map((pt, i) => ({
    label: pt.label,
    'Female':     pt.value ?? 0,
    'Male':       trends.malePercent[i]?.value ?? 0,
    'Non-Binary': trends.nonBinaryPercent[i]?.value ?? 0,
  }));
  return (
    <div className="chart-wrap chart-wrap--full" role="img" aria-label="Stacked bar chart: gender distribution by interval">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} maxBarSize={52} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={v => `${v}%`} domain={[0, 100]} tick={{ fontSize: 11 }} width={40} />
          <Tooltip formatter={(v: number, name: string) => [`${(v as number).toFixed(1)}%`, name]} />
          <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
          <Bar dataKey="Female"     stackId="g" fill={gc.F} />
          <Bar dataKey="Male"       stackId="g" fill={gc.M} />
          <Bar dataKey="Non-Binary" stackId="g" fill={gc.NB} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Age range band chart ─────────────────────────────────────────────────────

function AgeRangeBandChart({ trends }: { trends: ComparisonStats['trends'] }) {
  const { theme } = useTheme();
  const colors = chartPalette(theme, 2);
  const data = trends.medianAge.map((pt, i) => {
    const youngest = trends.minAge[i]?.value ?? null;
    const oldest   = trends.maxAge[i]?.value ?? null;
    return {
      label:   pt.label,
      youngest,
      band:    youngest !== null && oldest !== null ? oldest - youngest : null,
      median:  pt.value,
      mean:    trends.meanAge[i]?.value ?? null,
    };
  });
  return (
    <div className="chart-wrap chart-wrap--full" role="img" aria-label="Range band chart: age spread and central tendency by interval">
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 8, right: 24, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={roundFmt} width={40} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const youngest = payload.find(p => p.dataKey === 'youngest')?.value as number | undefined;
              const band     = payload.find(p => p.dataKey === 'band')?.value as number | undefined;
              const median   = payload.find(p => p.dataKey === 'median')?.value as number | undefined;
              const mean     = payload.find(p => p.dataKey === 'mean')?.value as number | undefined;
              const oldest   = youngest != null && band != null ? youngest + band : undefined;
              return (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', fontSize: '0.8rem' }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
                  {median != null && <div style={{ color: colors[0] }}>Median: {Math.round(median)} yrs</div>}
                  {mean   != null && <div style={{ color: colors[1] }}>Mean: {Math.round(mean)} yrs</div>}
                  {youngest != null && oldest != null && (
                    <div style={{ color: '#6b7280', marginTop: 2 }}>Range: {Math.round(youngest)}–{Math.round(oldest)} yrs</div>
                  )}
                </div>
              );
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '0.8rem' }}
            payload={[
              { value: 'Median Age', type: 'line', color: colors[0], id: 'median' },
              { value: 'Mean Age',   type: 'line', color: colors[1], id: 'mean' },
              { value: 'Min–Max Age Range', type: 'square', color: colors[0], id: 'range' },
            ]}
          />
          <Area dataKey="youngest" stackId="r" fill="transparent" stroke="none" legendType="none" />
          <Area dataKey="band"     stackId="r" fill={colors[0]} fillOpacity={0.08} stroke="none" legendType="none" />
          <Line dataKey="median" stroke={colors[0]} strokeWidth={2.5} dot={{ r: 4, strokeWidth: 0, fill: colors[0] }} legendType="none" />
          <Line dataKey="mean"   stroke={colors[1]} strokeWidth={2} strokeDasharray="4 2" dot={{ r: 4, strokeWidth: 0, fill: colors[1] }} legendType="none" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Geography small multiples ────────────────────────────────────────────────

function GeographySmallMultiples({ trends, labels }: { trends: ComparisonStats['trends']; labels: string[] }) {
  const { theme } = useTheme();
  const colors = chartPalette(theme, labels.length);

  function MiniBarChart({ data, title }: { data: TrendPoint[]; title: string }) {
    const chartData = data.map(pt => ({ label: pt.label, value: pt.value ?? 0 }));
    return (
      <div className="chart-subsection">
        <h3 className="chart-subsection-title">{title}</h3>
        <div className="chart-wrap chart-wrap--full">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} maxBarSize={44} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={roundFmt} width={36} />
              <Tooltip formatter={(v: number) => [Math.round(v).toLocaleString(), title]} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => <Cell key={i} fill={colors[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return (
    <div className="three-col">
      <MiniBarChart data={trends.stateCount}         title="States / Provinces" />
      <MiniBarChart data={trends.countryCount}       title="Countries" />
      <MiniBarChart data={trends.internationalCount} title="International Participants" />
    </div>
  );
}

// ─── Top States grouped bar ───────────────────────────────────────────────────

function TopStatesBarChart({ topStateTrends, labels }: { topStateTrends: ComparisonStats['topStateTrends']; labels: string[] }) {
  const { theme } = useTheme();
  const colors = chartPalette(theme, labels.length);
  if (topStateTrends.length === 0) return <p className="trend-line-empty">No state data available.</p>;

  const data = topStateTrends.map(row => {
    const entry: Record<string, string | number> = { state: row.state };
    row.counts.forEach((pt, i) => { entry[labels[i]] = pt.value ?? 0; });
    return entry;
  });

  return (
    <div className="chart-wrap chart-wrap--full" role="img" aria-label="Grouped bar chart: participant counts by state and interval">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} maxBarSize={28} barCategoryGap="15%" margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
          <XAxis dataKey="state" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number, name: string) => [Math.round(v).toLocaleString(), name]} />
          <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
          {labels.map((lbl, i) => (
            <Bar key={lbl} dataKey={lbl} fill={colors[i]} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ComparisonPage({ sessions, onBack }: Props) {
  const pageHeadingRef = useRef<HTMLHeadingElement>(null);
  const [data, setData] = useState<ComparisonStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [allEvents, setAllEvents] = useState<string[]>([]);
  const [eventNamesNormalized, setEventNamesNormalized] = useState(false);

  useEffect(() => { pageHeadingRef.current?.focus(); }, []);

  useEffect(() => {
    setSelectedEvent(null);
    setAllEvents([]);
  }, [sessions]);

  useEffect(() => {
    async function fetchComparison() {
      setLoading(true);
      setError(null);
      try {
        const body: Record<string, unknown> = { sessions };
        if (selectedEvent) body.selectedEvent = selectedEvent;
        const res = await fetch(apiUrl('/api/compare'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? 'Failed to load comparison statistics.');
          return;
        }
        const result = json as ComparisonStats;
        setData(result);
        if (!selectedEvent) {
          const norm = (s: string) => s.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
          const rawByNorm = new Map<string, Set<string>>();
          for (const iv of result.intervals) {
            for (const e of iv.stats.summary.events) {
              const n = norm(e.name);
              if (!rawByNorm.has(n)) rawByNorm.set(n, new Set());
              rawByNorm.get(n)!.add(e.name);
            }
          }
          const merged = [...rawByNorm.values()].some(s => s.size > 1);
          setEventNamesNormalized(merged);
          // Use first-seen raw name as canonical per normalized key
          const canonical = new Map<string, string>();
          for (const [n, variants] of rawByNorm) {
            canonical.set(n, [...variants][0]);
          }
          setAllEvents([...canonical.values()].sort());
        }
      } catch {
        setError('Could not reach the server.');
      } finally {
        setLoading(false);
      }
    }
    fetchComparison();
  }, [sessions, selectedEvent]);

  const raceName = sessions[0]?.raceName ?? 'Race';
  const intervalCount = sessions.length;

  return (
    <div className="comparison-page">
      <div className="comparison-header">
        <div className="comparison-header-left">
          <button type="button" className="btn-ghost dashboard-back no-print" onClick={onBack}>
            ← New analysis
          </button>
          <h1 ref={pageHeadingRef} tabIndex={-1} className="comparison-title">
            {raceName} — {intervalCount}-Interval Comparison
          </h1>
          <div className="comparison-intervals" aria-label="Intervals being compared">
            {sessions.map(s => (
              <span key={s.sessionId} className="comparison-interval-pill">{s.label}</span>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary no-print"
          onClick={() => window.print()}
          aria-label="Save comparison as PDF"
        >
          Save as PDF
        </button>
      </div>

      {allEvents.length > 1 && (
        <EventFilter
          events={allEvents}
          selected={selectedEvent ? [selectedEvent] : []}
          onChange={evs => setSelectedEvent(evs.length > 0 ? evs[0] : null)}
        />
      )}
      {eventNamesNormalized && (
        <p className="comparison-event-notice">
          Some event names have minor formatting differences across years (e.g., hyphens vs. spaces) and have been automatically matched. For larger variations such as abbreviations or renamed events, standardize event names in your UltraSignup export before uploading.
        </p>
      )}

      {loading && (
        <div className="comparison-loading" role="status" aria-live="polite" aria-busy="true">
          Loading comparison…
        </div>
      )}
      {error && (
        <div className="comparison-error" role="alert">{error}</div>
      )}

      {data && !loading && (() => {
        const ivLabels = data.intervals.map(iv => iv.label);
        const t = data.trends;
        return (
          <>
            {/* ── Key Trends ── */}
            <section className="chart-section" aria-labelledby="trends-heading">
              <SectionHeader title="Key Trends" />
              <div className="trend-cards-grid">
                <TrendCard title="Total Participants" data={t.participantCount}   precision={0} />
                <TrendCard title="Female %"           data={t.femalePercent}      unit="%" />
                <TrendCard title="Non-Binary %"       data={t.nonBinaryPercent}   unit="%" />
                <TrendCard title="Male %"             data={t.malePercent}         unit="%" />
                <TrendCard title="Coupon Usage %"       data={t.couponUsagePercent}    unit="%" />
                <TrendCard title="Waitlist Not Invited" data={t.waitlistNeverInvited}  precision={0} />
                <TrendCard title="Paid & Dropped"       data={t.paidDropped}           precision={0} />
              </div>
            </section>

            {/* ── Registration & Drops ── */}
            <section className="chart-section" aria-labelledby="registration-drops-heading">
              <SectionHeader title="Registration & Drops" />
              <IntervalComparisonPanel
                trendsContent={<RegistrationDropsChart trends={t} />}
                keyChangesContent={
                  <CategoryKeyChanges trends={t} rows={[
                    kc('Total Registered',              t.participantCount,          'count', { neutral: true }),
                    kc('Credit Card Active',             t.paidActive,               'count'),
                    kc('100% Coupon Active',             t.couponActive,             'count', { neutral: true }),
                    kc('Gift Card Active',               t.giftCardActive,           'count', { neutral: true }),
                    kc('Payment Pending (Next Statement)',                t.paymentPending,           'count', { neutral: true }),
                    kc('Relay Team Member — Captain-pays model',              t.relayJoins,               'count', { neutral: true }),
                    kc('Paid & Dropped',                 t.paidDropped,              'count', { invert: true }),
                    kc('Waitlist Not Invited',           t.waitlistNeverInvited,     'count', { neutral: true }),
                    kc('Waitlist Withdrawn/Declined Invitation',    t.waitlistWithdrawnDeclined,'count', { neutral: true }),
                  ]} />
                }
                tableContent={<SummaryTable rows={REGISTRATION_DROPS_ROWS} trends={t} labels={ivLabels} />}
              />
            </section>

            {/* ── Events (conditional) ── */}
            {data.crossEventTrends.length > 0 && (
              <section className="chart-section" aria-labelledby="events-heading">
                <SectionHeader title="Events" />
                <IntervalComparisonPanel
                  trendsContent={<EventsSection crossEventTrends={data.crossEventTrends} hasDistanceTrend={data.hasDistanceTrend} />}
                  keyChangesContent={
                    <CategoryKeyChanges trends={t} rows={
                      data.crossEventTrends.map(ev =>
                        kc(ev.eventName, ev.participantCount, 'count', { neutral: true })
                      )
                    } />
                  }
                  tableContent={<EventsTable crossEventTrends={data.crossEventTrends} labels={ivLabels} />}
                />
              </section>
            )}

            {/* ── Registration Patterns ── */}
            <section className="chart-section" aria-labelledby="reg-patterns-heading">
              <SectionHeader title="Registration Patterns" />
              <div className="chart-subsection">
                <h3 className="chart-subsection-title">Cumulative Registration Progress</h3>
                <p className="chart-note">Each year's cumulative registrations as a % of its final total, plotted by days before registration close — shows whether the field is filling faster or slower across years</p>
                <NormalizedCumulativeChart intervals={data.intervals} />
              </div>
              <div className="chart-subsection">
                <h3 className="chart-subsection-title">Registration Day of Week</h3>
                <p className="chart-note">Share of each year's registrations by weekday — normalized so differences in field size don't skew the comparison</p>
                <DayOfWeekChart intervals={data.intervals} />
              </div>
              <div className="chart-subsection">
                <h3 className="chart-subsection-title">Registration Hour of Day</h3>
                <p className="chart-note">Share of each year's registrations by 4-hour time block — normalized for fair cross-year comparison</p>
                <HourOfDayChart intervals={data.intervals} />
              </div>
            </section>

            {/* ── Registrant Profiles ── */}
            <section className="chart-section" aria-labelledby="profiles-heading">
              <SectionHeader title="Registrant Profiles" />
              <IntervalComparisonPanel
                trendsContent={<ProfilesSection trends={t} />}
                keyChangesContent={
                  <CategoryKeyChanges trends={t} rows={[
                    kc('Early Female %', t.earlyFemalePercent, 'pts', { neutral: true }),
                    kc('Late Female %',  t.lateFemalePercent,  'pts', { neutral: true }),
                    kc('Early Male %',   t.earlyMalePercent,   'pts', { neutral: true }),
                    kc('Late Male %',    t.lateMalePercent,    'pts', { neutral: true }),
                    kc('Early Avg Age',  t.earlyAvgAge,        'yrs', { neutral: true }),
                    kc('Late Avg Age',   t.lateAvgAge,         'yrs', { neutral: true }),
                  ]} />
                }
                tableContent={<SummaryTable rows={PROFILES_ROWS} trends={t} labels={ivLabels} />}
              />
            </section>

            {/* ── Gender ── */}
            <section className="chart-section" aria-labelledby="gender-heading">
              <SectionHeader title="Gender" />
              <IntervalComparisonPanel
                trendsContent={<GenderStackedBarChart trends={t} />}
                keyChangesContent={
                  <CategoryKeyChanges trends={t} rows={[
                    kc('Female %',     t.femalePercent,    'pts', { neutral: true }),
                    kc('Male %',       t.malePercent,      'pts', { neutral: true }),
                    kc('Non-Binary %', t.nonBinaryPercent, 'pts', { neutral: true }),
                  ]} />
                }
                tableContent={<SummaryTable rows={GENDER_ROWS} trends={t} labels={ivLabels} />}
              />
            </section>

            {/* ── Age ── */}
            <section className="chart-section" aria-labelledby="age-heading">
              <SectionHeader title="Age" />
              <IntervalComparisonPanel
                trendsContent={<AgeRangeBandChart trends={t} />}
                keyChangesContent={
                  <CategoryKeyChanges trends={t} rows={[
                    kc('Median Age', t.medianAge, 'yrs', { neutral: true }),
                    kc('Mean Age',   t.meanAge,   'yrs', { neutral: true }),
                    kc('Youngest',   t.minAge,    'yrs', { neutral: true }),
                    kc('Oldest',     t.maxAge,    'yrs', { neutral: true }),
                  ]} />
                }
                tableContent={<SummaryTable rows={AGE_ROWS} trends={t} labels={ivLabels} />}
              />
            </section>

            {/* ── Age Distribution ── */}
            <section className="chart-section" aria-labelledby="age-dist-heading">
              <SectionHeader title="Age Distribution" />
              <CombinedAgeDistributionChart intervals={data.intervals} />
            </section>

            {/* ── Geography ── */}
            <section className="chart-section" aria-labelledby="geography-heading">
              <SectionHeader title="Geography" />
              <IntervalComparisonPanel
                trendsContent={<GeographySmallMultiples trends={t} labels={ivLabels} />}
                keyChangesContent={
                  <CategoryKeyChanges trends={t} rows={[
                    kc('States / Provinces',         t.stateCount,         'count', { neutral: true }),
                    kc('Countries',                  t.countryCount,       'count', { neutral: true }),
                    kc('International Participants', t.internationalCount, 'count', { neutral: true }),
                  ]} />
                }
                tableContent={<SummaryTable rows={GEOGRAPHY_ROWS} trends={t} labels={ivLabels} />}
              />
            </section>

            {/* ── Top States ── */}
            <section className="chart-section" aria-labelledby="top-states-heading">
              <SectionHeader title="Top States" />
              <IntervalComparisonPanel
                trendsContent={<TopStatesBarChart topStateTrends={data.topStateTrends} labels={ivLabels} />}
                keyChangesContent={
                  <CategoryKeyChanges trends={t} rows={
                    data.topStateTrends.map(s =>
                      kc(s.state, s.counts, 'count', { neutral: true })
                    )
                  } />
                }
                tableContent={<TopStatesTable topStateTrends={data.topStateTrends} labels={ivLabels} />}
              />
            </section>

            {/* ── Travel Distance (conditional) ── */}
            {data.hasDistanceTrend && (
              <section className="chart-section" aria-labelledby="distance-heading">
                <SectionHeader title="Travel Distance" sub="Estimated distance from each participant's home location to the race venue" />
                <IntervalComparisonPanel
                  trendsContent={<DistanceTrendSection trends={t} />}
                  keyChangesContent={
                    <CategoryKeyChanges trends={t} rows={[
                      kc('Median Travel Distance',    t.medianDistanceMiles, 'mi',  { neutral: true }),
                      kc('Local % (< 50 mi)',         t.localPercent,        'pts', { neutral: true }),
                      kc('Regional % (50–200 mi)',    t.regionalPercent,     'pts', { neutral: true }),
                      kc('Destination % (≥ 200 mi)', t.destinationPercent,  'pts', { neutral: true }),
                    ]} />
                  }
                  tableContent={<SummaryTable rows={DISTANCE_TABLE_ROWS} trends={t} labels={ivLabels} />}
                />
              </section>
            )}
          </>
        );
      })()}
    </div>
  );
}
