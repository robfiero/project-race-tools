import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { AgeStats } from '../types.ts';
import SectionHeader from './SectionHeader.tsx';
import StatCard from './StatCard.tsx';
import { useTheme } from '../ThemeContext.tsx';
import './ChartSection.css';

interface Props { stats: AgeStats; }

export default function AgeSection({ stats }: Props) {
  const { theme } = useTheme();
  if (stats.mean === null) return null;

  return (
    <section className="chart-section">
      <SectionHeader title="Age Distribution" />
      <div className="stat-cards-row">
        <StatCard label="Median Age" value={stats.median ?? '—'} />
        <StatCard label="Mean Age" value={stats.mean ?? '—'} />
        <StatCard label="Youngest" value={stats.min ?? '—'} />
        <StatCard label="Oldest" value={stats.max ?? '—'} />
      </div>
      <div className="chart-wrap chart-wrap--full">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={stats.buckets} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => [v, 'Participants']} />
            <Bar dataKey="count" fill={theme.chart[0]} radius={[4, 4, 0, 0]} name="Participants" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
