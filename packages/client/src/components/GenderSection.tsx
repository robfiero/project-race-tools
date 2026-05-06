import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import type { GenderStats } from '../types.ts';
import SectionHeader from './SectionHeader.tsx';
import './ChartSection.css';

// Neutral demographic palette — not theme-driven, not traditional gender-coded colors.
const GENDER_COLORS = { F: '#0F766E', M: '#6366F1', NB: '#F59E0B', Unknown: '#9CA3AF' } as const;

type GenderTab = 'charts' | 'table';

interface Props { stats: GenderStats; title?: string; }

export default function GenderSection({ stats, title = 'Gender' }: Props) {
  const [tab, setTab] = useState<GenderTab>('charts');

  const total = stats.male + stats.female + stats.nonBinary + stats.unknown;
  if (total === 0) return null;

  const categories = [
    { name: 'Female',     key: 'F',       count: stats.female,    pct: stats.femalePercent },
    { name: 'Male',       key: 'M',       count: stats.male,      pct: stats.malePercent },
    ...(stats.nonBinary > 0 ? [{ name: 'Non-binary', key: 'NB',      count: stats.nonBinary, pct: stats.nonBinaryPercent }] : []),
    ...(stats.unknown   > 0 ? [{ name: 'Unknown',    key: 'Unknown', count: stats.unknown,   pct: +(stats.unknown / total * 100).toFixed(1) }] : []),
  ].filter(d => d.count > 0);

  const barData = categories.map(d => ({
    name: d.name,
    pct: d.pct,
    color: GENDER_COLORS[d.key as keyof typeof GENDER_COLORS] ?? '#9CA3AF',
  }));

  return (
    <section className="chart-section">
      <SectionHeader title={title} />

      <div className="rd-tab-strip" role="tablist" aria-label="Gender views">
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
          <div aria-hidden="true">
            <ResponsiveContainer width="100%" height={categories.length * 44 + 20}>
              <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 0 }}>
                <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={90} />
                <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Participants']} />
                <Bar dataKey="pct" radius={[0, 4, 4, 0]} name="Participants">
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                  <LabelList
                    dataKey="pct"
                    position="right"
                    formatter={(v: number) => `${v.toFixed(1)}%`}
                    style={{ fontSize: '0.8rem', fill: '#444' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === 'table' && (
        <div role="tabpanel" className="rd-tab-panel">
          <table className="stats-table stats-table--narrow">
            <caption className="sr-only">Gender breakdown by participant count and percentage</caption>
            <thead>
              <tr>
                <th scope="col">Gender</th>
                <th scope="col">Count</th>
                <th scope="col">%</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(d => (
                <tr key={d.key}>
                  <td>{d.name}</td>
                  <td>{d.count.toLocaleString()}</td>
                  <td>{((d.count / total) * 100).toFixed(1)}%</td>
                </tr>
              ))}
              <tr className="total-row">
                <td>Total</td>
                <td>{total.toLocaleString()}</td>
                <td>100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
