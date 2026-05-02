import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useTheme } from '../ThemeContext.tsx';
import { chartPalette } from '../chartColors.ts';
import './IntervalComparisonPanel.css';

// ─── Tab panel ────────────────────────────────────────────────────────────────

type TabId = 'trends' | 'table' | 'changes';

interface PanelProps {
  trendsContent?:    React.ReactNode;
  tableContent:      React.ReactNode;
  keyChangesContent: React.ReactNode;
}

export default function IntervalComparisonPanel({ trendsContent, tableContent, keyChangesContent }: PanelProps) {
  const TABS: { id: TabId; label: string }[] = [
    ...(trendsContent !== undefined ? [{ id: 'trends' as TabId, label: 'Charts' }] : []),
    { id: 'changes', label: 'Key Changes' },
    { id: 'table',   label: 'Table' },
  ];
  const [tab, setTab] = useState<TabId>(trendsContent !== undefined ? 'trends' : 'changes');

  return (
    <div className="cmp-panel">
      <div className="cmp-panel-tabs" role="tablist" aria-label="Comparison views">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`cmp-panel-body-${t.id}`}
            id={`cmp-panel-tab-${t.id}`}
            className={`cmp-panel-tab${tab === t.id ? ' cmp-panel-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        id={`cmp-panel-body-${tab}`}
        role="tabpanel"
        aria-labelledby={`cmp-panel-tab-${tab}`}
        className="cmp-panel-body"
      >
        {tab === 'trends'  && trendsContent}
        {tab === 'table'   && tableContent}
        {tab === 'changes' && keyChangesContent}
      </div>
    </div>
  );
}

// ─── Category pill selector ───────────────────────────────────────────────────

export interface CategoryDef {
  id: string;
  label: string;
}

interface CategorySelectorProps {
  categories: CategoryDef[];
  active: string;
  onChange: (id: string) => void;
}

export function TrendCategorySelector({ categories, active, onChange }: CategorySelectorProps) {
  return (
    <div className="trend-cat-strip" role="group" aria-label="Trend category">
      {categories.map(c => (
        <button
          key={c.id}
          type="button"
          className={`trend-cat-pill${active === c.id ? ' trend-cat-pill--active' : ''}`}
          aria-pressed={active === c.id}
          onClick={() => onChange(c.id)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

// ─── Trend line chart ─────────────────────────────────────────────────────────

export interface TrendSeries {
  name: string;
  data: Array<{ label: string; value: number | null }>;
}

interface TrendLineChartProps {
  series: TrendSeries[];
  formatY?: (v: number) => string;
  formatTooltipValue?: (v: number, name: string, label?: string) => string;
  yUnit?: string;
  emptyMessage?: string;
}

export function TrendLineChart({
  series, formatY, formatTooltipValue, yUnit = '', emptyMessage,
}: TrendLineChartProps) {
  const { theme } = useTheme();
  const colors = chartPalette(theme, series.length);
  const labels = series[0]?.data.map(p => p.label) ?? [];

  const isFlat = series.every(s =>
    s.data.length > 1 && s.data.slice(1).every(p => p.value === s.data[0].value),
  );

  if (isFlat && emptyMessage) {
    return <p className="trend-line-empty">{emptyMessage}</p>;
  }

  if (labels.length === 0) {
    return <p className="trend-line-empty">No chartable trend metrics are available for this comparison.</p>;
  }

  const chartData = labels.map((label, i) => {
    const row: Record<string, string | number | null> = { label };
    series.forEach(s => { row[s.name] = s.data[i]?.value ?? null; });
    return row;
  });

  return (
    <div className="trend-line-chart">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 8, right: 24, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={formatY ?? (v => `${v}${yUnit}`)}
            width={52}
          />
          <Tooltip
            formatter={(value: number, name: string, props: { payload?: Record<string, unknown> }) => [
              formatTooltipValue
                ? formatTooltipValue(value, name, props.payload?.label as string | undefined)
                : `${typeof value === 'number' ? value.toFixed(yUnit === '' ? 0 : 1) : value}${yUnit}`,
              name,
            ]}
          />
          {series.length > 1 && <Legend />}
          {series.map((s, i) => (
            <Line
              key={s.name}
              type="monotone"
              dataKey={s.name}
              stroke={colors[i]}
              strokeWidth={2.5}
              dot={{ r: 4, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Key changes list ─────────────────────────────────────────────────────────

export interface KeyChangeRow {
  label: string;
  formattedDelta: string;      // e.g. "+70", "-2.1 pts", "51:46 faster", "unchanged"
  direction: 'up' | 'down' | 'none';
  neutral: boolean;            // if true, no red/green coloring
}

interface KeyChangesListProps {
  rows: KeyChangeRow[];
  firstLabel: string;
  lastLabel: string;
}

export function KeyChangesList({ rows, firstLabel, lastLabel }: KeyChangesListProps) {
  if (rows.length === 0) {
    return <p className="trend-line-empty">No key changes to display.</p>;
  }

  return (
    <div>
      <p className="key-changes-intro">
        Comparing <strong>{lastLabel}</strong> to <strong>{firstLabel}</strong>:
      </p>
      <dl className="key-changes-list">
        {rows.map(row => {
          const isUnchanged = row.direction === 'none';
          let valueClass = 'key-changes-value--neutral';
          if (!isUnchanged && !row.neutral) {
            valueClass = row.direction === 'up' ? 'key-changes-value--up' : 'key-changes-value--down';
          }
          const arrow = isUnchanged ? null : row.direction === 'up' ? '▲' : '▼';
          return (
            <div key={row.label} className="key-changes-item">
              <dt className="key-changes-metric">{row.label}</dt>
              <dd className={`key-changes-value ${valueClass}`}>
                {arrow && <span className="key-changes-arrow" aria-hidden="true">{arrow} </span>}
                {row.formattedDelta}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

// ─── Shared delta helpers ─────────────────────────────────────────────────────

export function seriesDelta(data: Array<{ label: string; value: number | null }>): number | null {
  const first = data[0]?.value;
  const last  = data[data.length - 1]?.value;
  if (first === null || last === null || first === undefined || last === undefined) return null;
  return last - first;
}

export function fmtCountDelta(delta: number | null, threshold = 0.5): KeyChangeRow['formattedDelta'] {
  if (delta === null || Math.abs(delta) < threshold) return 'unchanged';
  const rounded = Math.round(delta);
  return `${rounded > 0 ? '+' : ''}${rounded}`;
}

export function fmtPtsDelta(delta: number | null, precision = 1, threshold = 0.05): KeyChangeRow['formattedDelta'] {
  if (delta === null || Math.abs(delta) < threshold) return 'unchanged';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(precision)} pts`;
}

export function fmtYrsDelta(delta: number | null, precision = 1, threshold = 0.05): KeyChangeRow['formattedDelta'] {
  if (delta === null || Math.abs(delta) < threshold) return 'unchanged';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(precision)} yrs`;
}

export function fmtTimeDelta(deltaSeconds: number | null, thresholdSec = 30): KeyChangeRow['formattedDelta'] {
  if (deltaSeconds === null || Math.abs(deltaSeconds) < thresholdSec) return 'unchanged';
  const abs = Math.abs(Math.round(deltaSeconds));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const formatted = h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
  return `${formatted} ${deltaSeconds < 0 ? 'faster' : 'slower'}`;
}

export function directionOf(
  delta: number | null,
  threshold: number,
  invert = false,
): KeyChangeRow['direction'] {
  if (delta === null || Math.abs(delta) < threshold) return 'none';
  const positive = delta > 0;
  const good     = invert ? !positive : positive;
  return good ? 'up' : 'down';
}
