import { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { apiUrl } from '../api.ts';
import type { ComparisonStats, IntervalStats, TrendPoint } from '../types.ts';
import { useTheme } from '../ThemeContext.tsx';
import { chartPalette } from '../chartColors.ts';
import SectionHeader from '../components/SectionHeader.tsx';
import GenderSection from '../components/GenderSection.tsx';
import AgeSection from '../components/AgeSection.tsx';
import GeographicSection from '../components/GeographicSection.tsx';
import DistanceSection from '../components/DistanceSection.tsx';
import RegistrationSection from '../components/RegistrationSection.tsx';
import CrossEventSection from '../components/CrossEventSection.tsx';
import ParticipationSection from '../components/AttritionSection.tsx';
import './ComparisonPage.css';

interface Props {
  sessions: Array<{ sessionId: string; label: string; raceName: string }>;
  onBack: () => void;
}

// ─── Trend card ───────────────────────────────────────────────────────────────

interface TrendCardProps {
  title: string;
  unit?: string;        // appended to values, e.g. "%" or " mi"
  data: TrendPoint[];
  precision?: number;   // decimal places for display
  deltaInvert?: boolean; // true = lower is better (e.g. dropout %)
}

function fmt(v: number | null, unit = '', precision = 1): string {
  if (v === null) return '—';
  const s = precision === 0 ? String(Math.round(v)) : v.toFixed(precision);
  return `${s}${unit}`;
}

function TrendCard({ title, unit = '', data, precision = 1, deltaInvert = false }: TrendCardProps) {
  const { theme } = useTheme();
  if (data.length === 0) return null;

  const current = data[data.length - 1].value;
  const first = data[0].value;
  const delta = current !== null && first !== null ? current - first : null;

  let deltaClass = 'trend-card-delta--neutral';
  let deltaSign = '';
  if (delta !== null && Math.abs(delta) >= 0.05) {
    const positive = delta > 0;
    const good = deltaInvert ? !positive : positive;
    deltaClass = good ? 'trend-card-delta--good' : 'trend-card-delta--bad';
    deltaSign = positive ? '+' : '';
  }

  const chartData = data.map(d => ({ label: d.label, value: d.value ?? 0 }));
  const colors = chartPalette(theme, chartData.length);

  return (
    <div className="trend-card card">
      <div className="trend-card-header">
        <span className="trend-card-title">{title}</span>
        {delta !== null && (
          <span className={`trend-card-delta ${deltaClass}`}>
            {deltaSign}{fmt(delta, unit, precision)} overall
          </span>
        )}
      </div>
      <div className="trend-card-value">{fmt(current, unit, precision)}</div>
      <div
        className="trend-card-chart"
        role="img"
        aria-label={`Bar chart showing ${title} trend across intervals`}
      >
        <ResponsiveContainer width="100%" height={70}>
          <BarChart data={chartData} margin={{ top: 2, right: 4, bottom: 0, left: 4 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9 }}
              axisLine={false}
              tickLine={false}
            />
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

// ─── Side-by-side summary table ───────────────────────────────────────────────

interface MetricRow {
  label: string;
  key: keyof ComparisonStats['trends'];
  unit?: string;
  precision?: number;
  deltaInvert?: boolean;
}

const METRIC_ROWS: MetricRow[] = [
  { label: 'Total Participants',   key: 'participantCount',    precision: 0 },
  { label: 'Active Participants',  key: 'activeParticipants',  precision: 0 },
  { label: 'Female %',             key: 'femalePercent',       unit: '%' },
  { label: 'Non-Binary %',         key: 'nonBinaryPercent',    unit: '%' },
  { label: 'Male %',               key: 'malePercent',         unit: '%' },
  { label: 'Median Age',           key: 'medianAge',           precision: 0 },
  { label: 'Mean Age',             key: 'meanAge' },
  { label: 'States / Provinces',   key: 'stateCount',          precision: 0 },
  { label: 'Countries',            key: 'countryCount',        precision: 0 },
  { label: 'International %',      key: 'internationalPercent', unit: '%' },
  { label: 'Comped %',             key: 'compedPercent',       unit: '%' },
  { label: 'Coupon Usage %',       key: 'couponUsagePercent',  unit: '%' },
];

const DISTANCE_METRIC_ROWS: MetricRow[] = [
  { label: 'Median Distance',       key: 'medianDistanceMiles', unit: ' mi' },
  { label: 'Local % (< 50 mi)',     key: 'localPercent',        unit: '%' },
  { label: 'Destination % (≥ 200 mi)', key: 'destinationPercent', unit: '%' },
];

function deltaClass(
  current: number | null,
  first: number | null,
  deltaInvert = false,
): string {
  if (current === null || first === null) return '';
  const d = current - first;
  if (Math.abs(d) < 0.05) return 'cmp-cell--neutral';
  const good = deltaInvert ? d < 0 : d > 0;
  return good ? 'cmp-cell--good' : 'cmp-cell--bad';
}

interface SummaryTableProps {
  trends: ComparisonStats['trends'];
  labels: string[];
  hasDistanceTrend: boolean;
}

function SummaryTable({ trends, labels, hasDistanceTrend }: SummaryTableProps) {
  const rows = hasDistanceTrend
    ? [...METRIC_ROWS, ...DISTANCE_METRIC_ROWS]
    : METRIC_ROWS;

  return (
    <div className="cmp-table-scroll">
      <table className="stats-table cmp-table">
        <caption className="sr-only">Side-by-side comparison of key statistics across all intervals</caption>
        <thead>
          <tr>
            <th scope="col">Metric</th>
            {labels.map(lbl => <th scope="col" key={lbl}>{lbl}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const series = trends[row.key] as TrendPoint[];
            if (series.length === 0) return null;
            const first = series[0].value;
            return (
              <tr key={row.key}>
                <td className="cmp-metric-label">{row.label}</td>
                {series.map((pt, i) => (
                  <td
                    key={pt.label}
                    className={i === 0 ? '' : deltaClass(pt.value, first, row.deltaInvert)}
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

// ─── Per-interval tabs ────────────────────────────────────────────────────────

interface IntervalTabsProps {
  intervals: IntervalStats[];
}

function IntervalTabs({ intervals }: IntervalTabsProps) {
  const [activeIdx, setActiveIdx] = useState(0);

  return (
    <div className="interval-tabs">
      <div className="interval-tab-strip no-print" role="tablist" aria-label="Race intervals">
        {intervals.map((iv, i) => (
          <button
            key={iv.sessionId}
            role="tab"
            id={`interval-tab-${i}`}
            aria-selected={i === activeIdx}
            aria-controls={`interval-panel-${i}`}
            className={`interval-tab${i === activeIdx ? ' interval-tab--active' : ''}`}
            onClick={() => setActiveIdx(i)}
          >
            {iv.label}
          </button>
        ))}
      </div>

      {/* All panels are always in the DOM so @media print can reveal them all.
          Inactive panels are visually hidden via CSS only. */}
      {intervals.map((iv, i) => {
        const s = iv.stats;
        return (
          <div
            key={iv.sessionId}
            role="tabpanel"
            id={`interval-panel-${i}`}
            aria-labelledby={`interval-tab-${i}`}
            className={`interval-tab-panel${i !== activeIdx ? ' interval-tab-panel--inactive' : ''}`}
            aria-hidden={i !== activeIdx}
          >
            <div className="interval-tab-meta">
              <span className="interval-tab-meta-name">{iv.raceName}</span>
              <span className="interval-tab-meta-count">
                {iv.participantCount.toLocaleString()} participants
              </span>
              <span className="interval-tab-label-print">{iv.label}</span>
            </div>
            <GenderSection stats={s.gender} />
            <AgeSection stats={s.age} />
            <GeographicSection stats={s.geographic} />
            {s.distance && <DistanceSection stats={s.distance} />}
            <RegistrationSection stats={s.registration} />
            <CrossEventSection stats={s.crossEvent} />
            <ParticipationSection participation={s.participation} teams={s.teams} />
          </div>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ComparisonPage({ sessions, onBack }: Props) {
  const pageHeadingRef = useRef<HTMLHeadingElement>(null);
  const [data, setData] = useState<ComparisonStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { pageHeadingRef.current?.focus(); }, []);

  useEffect(() => {
    async function fetchComparison() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(apiUrl('/api/compare'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessions }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? 'Failed to load comparison statistics.');
          return;
        }
        setData(json as ComparisonStats);
      } catch {
        setError('Could not reach the server.');
      } finally {
        setLoading(false);
      }
    }
    fetchComparison();
  }, [sessions]);

  // Derive a page title from the first session's race name
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

      {loading && (
        <div className="comparison-loading" role="status" aria-live="polite" aria-busy="true">
          Loading comparison…
        </div>
      )}
      {error && (
        <div className="comparison-error" role="alert">{error}</div>
      )}

      {data && !loading && (
        <>
          {/* ── Key Trends ── */}
          <section className="chart-section" aria-labelledby="trends-heading">
            <SectionHeader title="Key Trends" />
            <div className="trend-cards-grid">
              <TrendCard title="Total Participants" data={data.trends.participantCount} precision={0} />
              <TrendCard title="Active Participants" data={data.trends.activeParticipants} precision={0} />
              <TrendCard title="Female %" data={data.trends.femalePercent} unit="%" />
              <TrendCard title="Non-Binary %" data={data.trends.nonBinaryPercent} unit="%" />
              <TrendCard title="Median Age" data={data.trends.medianAge} precision={0} />
              <TrendCard title="States / Provinces" data={data.trends.stateCount} precision={0} />
              <TrendCard title="Countries" data={data.trends.countryCount} precision={0} />
              <TrendCard title="International %" data={data.trends.internationalPercent} unit="%" />
              <TrendCard title="Coupon Usage %" data={data.trends.couponUsagePercent} unit="%" />
              {data.hasDistanceTrend && (
                <TrendCard title="Median Distance" data={data.trends.medianDistanceMiles} unit=" mi" />
              )}
              {data.hasDistanceTrend && (
                <TrendCard title="Local % (< 50 mi)" data={data.trends.localPercent} unit="%" />
              )}
              {data.hasDistanceTrend && (
                <TrendCard title="Destination % (≥ 200 mi)" data={data.trends.destinationPercent} unit="%" />
              )}
            </div>
          </section>

          {/* ── Side-by-side table ── */}
          <section className="chart-section" aria-labelledby="summary-table-heading">
            <SectionHeader title="Interval Comparison" />
            <SummaryTable
              trends={data.trends}
              labels={data.intervals.map(iv => iv.label)}
              hasDistanceTrend={data.hasDistanceTrend}
            />
          </section>

          {/* ── Per-interval detail ── */}
          <section className="chart-section" aria-labelledby="detail-heading">
            <SectionHeader title="Per-Interval Details" />
            <p className="comparison-detail-hint">
              Select an interval tab to view its full breakdown. Hour-of-day,
              cumulative curve, and cross-event statistics are most useful in
              this individual context.
            </p>
            <IntervalTabs intervals={data.intervals} />
          </section>
        </>
      )}
    </div>
  );
}
