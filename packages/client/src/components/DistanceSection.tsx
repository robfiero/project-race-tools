import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { DistanceStats } from '../types.ts';
import SectionHeader from './SectionHeader.tsx';
import StatCard from './StatCard.tsx';
import { useTheme } from '../ThemeContext.tsx';
import './ChartSection.css';

interface Props { stats: DistanceStats; }

export default function DistanceSection({ stats }: Props) {
  const { theme } = useTheme();
  const total = stats.local + stats.regional + stats.destination || 1;

  return (
    <section className="chart-section">
      <SectionHeader
        title="Distance Traveled"
        sub={`Venue: ${stats.venueAddress}`}
      />

      <div className="stat-cards-row">
        <StatCard label="Median Distance" value={`${stats.medianMiles} mi`} />
        <StatCard label="Mean Distance" value={`${stats.meanMiles} mi`} />
        <StatCard
          label="Local (< 50 mi)"
          value={stats.local.toLocaleString()}
          sub={`${((stats.local / total) * 100).toFixed(0)}%`}
        />
        <StatCard
          label="Regional (50–200 mi)"
          value={stats.regional.toLocaleString()}
          sub={`${((stats.regional / total) * 100).toFixed(0)}%`}
        />
        <StatCard
          label="Destination (200+ mi)"
          value={stats.destination.toLocaleString()}
          sub={`${((stats.destination / total) * 100).toFixed(0)}%`}
        />
      </div>
      <div className="chart-wrap chart-wrap--full" role="img" aria-label="Bar chart: participant counts by distance traveled">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={stats.buckets} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => [v, 'Participants']} />
            <Bar dataKey="count" fill={theme.chart[2]} radius={[4, 4, 0, 0]} name="Participants" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
