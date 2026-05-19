import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import type { ReactNode } from 'react';
import type { AgeStats } from '../types.ts';
import SectionHeader from './SectionHeader.tsx';
import StatCard from './StatCard.tsx';
import InsightCallout from './InsightCallout.tsx';
import { useTheme } from '../ThemeContext.tsx';
import { ageInsights } from '../insights.ts';
import './ChartSection.css';

interface Props {
  stats: AgeStats;
  additionalInsights?: string[];
  title?: string;
  basisNote?: string;
  contextNote?: ReactNode;
  contextStrip?: ReactNode;
  compact?: boolean;
  compactHighlights?: boolean;
  countLabel?: string;
}

export default function AgeSection({
  stats,
  additionalInsights,
  title = 'Age Distribution',
  basisNote,
  contextNote,
  contextStrip,
  compact = false,
  compactHighlights = false,
  countLabel = 'Participants',
}: Props) {
  const { theme } = useTheme();
  if (stats.mean === null) return null;
  const insights = [...ageInsights(stats), ...(additionalInsights ?? [])];
  const chartHeight = compact ? 190 : 240;

  return (
    <section className={`chart-section${compact ? ' age-section--compact' : ''}`}>
      <SectionHeader title={title} contextStrip={contextStrip} />
      {contextNote}
      {basisNote && <p className="chart-section-note">{basisNote}</p>}
      {compactHighlights ? (
        <div className="age-highlight-row">
          <div className="age-highlight-metric">
            <span className="age-highlight-label">Youngest</span>
            <span className="age-highlight-value">{stats.min ?? '—'}</span>
          </div>
          <div className="age-highlight-metric">
            <span className="age-highlight-label">Oldest</span>
            <span className="age-highlight-value">{stats.max ?? '—'}</span>
          </div>
          <div className="age-highlight-metric">
            <span className="age-highlight-label">Average Age</span>
            <span className="age-highlight-value">{stats.mean ?? '—'}</span>
          </div>
          <div className="age-highlight-metric">
            <span className="age-highlight-label">Median Age</span>
            <span className="age-highlight-value">{stats.median ?? '—'}</span>
          </div>
        </div>
      ) : (
        <div className="stat-cards-row">
          <StatCard label="Youngest" value={stats.min ?? '—'} />
          <StatCard label="Oldest" value={stats.max ?? '—'} />
          {/* User-facing labels say "Average"; stats.mean remains the internal field name. */}
          <StatCard label="Average Age" value={stats.mean ?? '—'} />
          <StatCard label="Median Age" value={stats.median ?? '—'} />
        </div>
      )}
      <div className="chart-wrap chart-wrap--full" role="img" aria-label={`Bar chart: ${countLabel.toLowerCase()} by age group`}>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={stats.buckets} margin={{ top: 20, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => [v, countLabel]} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} name={countLabel} fill={theme.chart[0]}>
              <LabelList
                dataKey="count"
                position="top"
                style={{ fontSize: 11, fill: '#555' }}
                formatter={(v: number) => v > 0 ? v.toLocaleString() : ''}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <InsightCallout insights={insights} />
    </section>
  );
}
