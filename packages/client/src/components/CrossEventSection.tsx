import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LabelList,
} from 'recharts';
import type { CrossEventStats } from '../types.ts';
import SectionHeader from './SectionHeader.tsx';
import { useTheme } from '../ThemeContext.tsx';
import './ChartSection.css';

// Consistent with GenderSection neutral demographic palette
const GENDER_COLORS = { Female: '#0F766E', Male: '#6366F1', 'Non-Binary': '#F59E0B' } as const;

type CeView = 'participants' | 'gender' | 'age' | 'travel';
type CeTab  = 'charts' | 'table';

const VIEW_LABELS: Record<CeView, string> = {
  participants: 'Participants',
  gender:       'Gender Mix',
  age:          'Age',
  travel:       'Travel Mix',
};

interface Props {
  stats: CrossEventStats;
  selectedEvents: string[];
}

const LEGEND_STYLE  = { fontSize: '0.75rem', paddingBottom: 6 };
const LABEL_STYLE   = { fontSize: 10, fill: '#555' };
const Y_WIDTH       = 200;
const CHART_MARGIN  = { top: 4, right: 56, bottom: 4, left: 8 };

export default function CrossEventSection({ stats, selectedEvents }: Props) {
  const { theme } = useTheme();
  const [tab,  setTab]  = useState<CeTab>('charts');
  const [view, setView] = useState<CeView>('participants');

  const { rows } = stats;
  const hasDistance  = rows.some(r => r.medianDistanceMiles !== null);
  const hasNonBinary = rows.some(r => r.nonBinary > 0);

  const availableViews: CeView[] = [
    'participants', 'gender', 'age',
    ...(hasDistance ? ['travel' as CeView] : []),
  ];
  const activeView = availableViews.includes(view) ? view : 'participants';

  if (selectedEvents.length > 0) {
    return (
      <section className="chart-section">
        <SectionHeader title="Event Comparison" />
        <p className="cross-event-empty">
          Event Comparison is available when <strong>All Events</strong> is selected.{' '}
          Use the event filter above to return to All Events.
        </p>
      </section>
    );
  }

  if (rows.length === 0) return null;

  const n = rows.length;

  function chartHeight(): number {
    if (activeView === 'gender')  return Math.max(160, n * (hasNonBinary ? 76 : 60));
    if (activeView === 'age')     return Math.max(160, n * 60);
    if (activeView === 'travel')  return Math.max(180, n * 76);
    return Math.max(120, n * 44);
  }

  function renderChart() {
    if (activeView === 'gender') {
      const data = rows.map(r => ({
        name:            r.name,
        Female:          r.femalePercent,
        Male:            r.malePercent,
        ...(hasNonBinary ? { 'Non-Binary': r.nonBinaryPercent } : {}),
      }));
      return (
        <BarChart data={data} layout="vertical" barCategoryGap="28%" barGap={3} margin={CHART_MARGIN}>
          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={Y_WIDTH} />
          <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
          <Legend verticalAlign="top" iconType="square" iconSize={10} wrapperStyle={LEGEND_STYLE} />
          <Bar dataKey="Female" fill={GENDER_COLORS.Female} maxBarSize={16} radius={[0, 3, 3, 0]}>
            <LabelList dataKey="Female" position="right" style={LABEL_STYLE}
              formatter={(v: number) => v > 0 ? `${v.toFixed(1)}%` : ''} />
          </Bar>
          <Bar dataKey="Male" fill={GENDER_COLORS.Male} maxBarSize={16} radius={[0, 3, 3, 0]}>
            <LabelList dataKey="Male" position="right" style={LABEL_STYLE}
              formatter={(v: number) => v > 0 ? `${v.toFixed(1)}%` : ''} />
          </Bar>
          {hasNonBinary && (
            <Bar dataKey="Non-Binary" fill={GENDER_COLORS['Non-Binary']} maxBarSize={16} radius={[0, 3, 3, 0]}>
              <LabelList dataKey="Non-Binary" position="right" style={LABEL_STYLE}
                formatter={(v: number) => v > 0 ? `${v.toFixed(1)}%` : ''} />
            </Bar>
          )}
        </BarChart>
      );
    }

    if (activeView === 'age') {
      const data = rows.map(r => ({
        name:         r.name,
        'Avg Age':    r.avgAge    ?? 0,
        'Median Age': r.medianAge ?? 0,
      }));
      return (
        <BarChart data={data} layout="vertical" barCategoryGap="32%" barGap={3} margin={CHART_MARGIN}>
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={Y_WIDTH} />
          <Tooltip formatter={(v: number) => `${v.toFixed(1)} yrs`} />
          <Legend verticalAlign="top" iconType="square" iconSize={10} wrapperStyle={LEGEND_STYLE} />
          <Bar dataKey="Avg Age" fill={theme.chart[0]} maxBarSize={16} radius={[0, 3, 3, 0]}>
            <LabelList dataKey="Avg Age" position="right" style={LABEL_STYLE}
              formatter={(v: number) => v > 0 ? String(Math.round(v)) : ''} />
          </Bar>
          <Bar dataKey="Median Age" fill={theme.chart[1]} maxBarSize={16} radius={[0, 3, 3, 0]}>
            <LabelList dataKey="Median Age" position="right" style={LABEL_STYLE}
              formatter={(v: number) => v > 0 ? String(Math.round(v)) : ''} />
          </Bar>
        </BarChart>
      );
    }

    if (activeView === 'travel') {
      const data = rows.map(r => ({
        name:        r.name,
        Local:       r.localPercent       ?? 0,
        Regional:    r.regionalPercent    ?? 0,
        Destination: r.destinationPercent ?? 0,
      }));
      return (
        <BarChart data={data} layout="vertical" barCategoryGap="28%" barGap={3} margin={CHART_MARGIN}>
          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={Y_WIDTH} />
          <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
          <Legend verticalAlign="top" iconType="square" iconSize={10} wrapperStyle={LEGEND_STYLE} />
          <Bar dataKey="Local" fill={theme.chart[0]} maxBarSize={16} radius={[0, 3, 3, 0]}>
            <LabelList dataKey="Local" position="right" style={LABEL_STYLE}
              formatter={(v: number) => v > 0 ? `${v.toFixed(1)}%` : ''} />
          </Bar>
          <Bar dataKey="Regional" fill={theme.chart[1]} maxBarSize={16} radius={[0, 3, 3, 0]}>
            <LabelList dataKey="Regional" position="right" style={LABEL_STYLE}
              formatter={(v: number) => v > 0 ? `${v.toFixed(1)}%` : ''} />
          </Bar>
          <Bar dataKey="Destination" fill={theme.chart[2]} maxBarSize={16} radius={[0, 3, 3, 0]}>
            <LabelList dataKey="Destination" position="right" style={LABEL_STYLE}
              formatter={(v: number) => v > 0 ? `${v.toFixed(1)}%` : ''} />
          </Bar>
        </BarChart>
      );
    }

    // Participants (default)
    const data = rows.map(r => ({ name: r.name, Participants: r.count }));
    return (
      <BarChart data={data} layout="vertical" barCategoryGap="35%" margin={CHART_MARGIN}>
        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => v.toLocaleString()} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={Y_WIDTH} />
        <Tooltip formatter={(v: number) => [v.toLocaleString(), 'Participants']} />
        <Bar dataKey="Participants" fill={theme.chart[0]} maxBarSize={28} radius={[0, 4, 4, 0]}>
          <LabelList dataKey="Participants" position="right" style={LABEL_STYLE}
            formatter={(v: number) => v > 0 ? v.toLocaleString() : ''} />
        </Bar>
      </BarChart>
    );
  }

  return (
    <section className="chart-section">
      <SectionHeader title="Event Comparison" />

      <div className="rd-tab-strip" role="tablist" aria-label="Event Comparison views">
        {(['charts', 'table'] as const).map(id => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`rd-tab${tab === id ? ' rd-tab--active' : ''}`}
            onClick={() => setTab(id)}
          >
            {id === 'charts' ? 'Charts' : 'Table'}
          </button>
        ))}
      </div>

      {tab === 'charts' && (
        <div role="tabpanel" className="rd-tab-panel">
          <div className="metric-pills" role="group" aria-label="Select chart view">
            {availableViews.map(v => (
              <button
                key={v}
                type="button"
                className={`metric-pill${v === activeView ? ' metric-pill--active' : ''}`}
                onClick={() => setView(v)}
                aria-pressed={v === activeView}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>
          <div className="chart-wrap chart-wrap--full" aria-hidden="true">
            <ResponsiveContainer width="100%" height={chartHeight()}>
              {renderChart()}
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === 'table' && (
        <div role="tabpanel" className="rd-tab-panel">
          <div className="cross-event-scroll">
            <table className="stats-table cross-event-table">
              <caption className="sr-only">Side-by-side comparison of participant statistics across events</caption>
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Participants</th>
                  <th scope="col">Female %</th>
                  <th scope="col">Male %</th>
                  {hasNonBinary && <th scope="col">Non-Binary %</th>}
                  <th scope="col">Avg Age</th>
                  <th scope="col">Median Age</th>
                  {hasDistance && <th scope="col">Median Travel</th>}
                  {hasDistance && <th scope="col">Local %</th>}
                  {hasDistance && <th scope="col">Regional %</th>}
                  {hasDistance && <th scope="col">Destination % (≥ 200 mi)</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.name}>
                    <td className="cross-event-name">{row.name}</td>
                    <td>{row.count.toLocaleString()}</td>
                    <td>{row.femalePercent}%</td>
                    <td>{row.malePercent}%</td>
                    {hasNonBinary && <td>{row.nonBinaryPercent > 0 ? `${row.nonBinaryPercent}%` : '—'}</td>}
                    <td>{row.avgAge ?? '—'}</td>
                    <td>{row.medianAge ?? '—'}</td>
                    {hasDistance && (
                      <td>{row.medianDistanceMiles !== null ? `${row.medianDistanceMiles} mi` : '—'}</td>
                    )}
                    {hasDistance && (
                      <td>{row.localPercent !== null ? `${row.localPercent}%` : '—'}</td>
                    )}
                    {hasDistance && (
                      <td>{row.regionalPercent !== null ? `${row.regionalPercent}%` : '—'}</td>
                    )}
                    {hasDistance && (
                      <td>{row.destinationPercent !== null ? `${row.destinationPercent}%` : '—'}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
