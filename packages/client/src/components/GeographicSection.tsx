import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { GeographicStats } from '../types.ts';
import SectionHeader from './SectionHeader.tsx';
import StatCard from './StatCard.tsx';
import { useTheme } from '../ThemeContext.tsx';
import './ChartSection.css';

interface Props { stats: GeographicStats; }

export default function GeographicSection({ stats }: Props) {
  const { theme } = useTheme();
  const topStates = stats.topStates.slice(0, 15);
  const topCountries = stats.topCountries.slice(0, 10);

  return (
    <section className="chart-section">
      <SectionHeader title="Geographic" />

      <div className="stat-cards-row">
        <StatCard label="US Participants" value={stats.usParticipants.toLocaleString()} />
        <StatCard label="International" value={stats.internationalParticipants.toLocaleString()} />
        <StatCard label="States / Provinces" value={Object.keys(stats.byState).length} />
        <StatCard label="Countries" value={Object.keys(stats.byCountry).length} />
      </div>

      <div className="chart-subsection">
        <h3 className="chart-subsection-title">Top States / Provinces</h3>
        <div className="two-col">
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={Math.max(200, topStates.length * 24)}>
              <BarChart
                data={topStates}
                layout="vertical"
                margin={{ top: 4, right: 40, bottom: 4, left: 24 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eee" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="state" tick={{ fontSize: 12 }} width={32} />
                <Tooltip formatter={(v: number) => [v, 'Participants']} />
                <Bar dataKey="count" fill={theme.chart[1]} radius={[0, 4, 4, 0]} name="Participants" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="stats-table">
            <thead>
              <tr><th>State</th><th>Count</th><th>%</th></tr>
            </thead>
            <tbody>
              {topStates.map(row => (
                <tr key={row.state}>
                  <td>{row.state}</td>
                  <td>{row.count.toLocaleString()}</td>
                  <td>{((row.count / (stats.usParticipants + stats.internationalParticipants)) * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {topCountries.length > 1 && (
        <div className="chart-subsection">
          <h3 className="chart-subsection-title">Countries</h3>
          <table className="stats-table stats-table--narrow">
            <thead>
              <tr><th>Country</th><th>Count</th></tr>
            </thead>
            <tbody>
              {topCountries.map(row => (
                <tr key={row.country}>
                  <td>{row.country}</td>
                  <td>{row.count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
