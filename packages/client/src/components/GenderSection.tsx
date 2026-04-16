import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { GenderStats } from '../types.ts';
import SectionHeader from './SectionHeader.tsx';
import { useTheme } from '../ThemeContext.tsx';
import './ChartSection.css';

interface Props { stats: GenderStats; }

export default function GenderSection({ stats }: Props) {
  const { theme } = useTheme();
  const COLORS = { M: theme.chart[1], F: theme.chart[0], NB: theme.chart[2], Unknown: '#bbb' };
  const data = [
    { name: 'Female', value: stats.female, key: 'F' },
    { name: 'Male', value: stats.male, key: 'M' },
    ...(stats.nonBinary > 0 ? [{ name: 'Non-binary', value: stats.nonBinary, key: 'NB' }] : []),
    ...(stats.unknown > 0 ? [{ name: 'Unknown', value: stats.unknown, key: 'Unknown' }] : []),
  ].filter(d => d.value > 0);

  const total = stats.male + stats.female + stats.nonBinary + stats.unknown;

  return (
    <section className="chart-section">
      <SectionHeader title="Gender" />
      <div className="chart-section-body two-col">
        <div className="chart-wrap" aria-hidden="true">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={85}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {data.map((entry) => (
                  <Cell key={entry.key} fill={COLORS[entry.key as keyof typeof COLORS] ?? '#ccc'} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [v, 'Participants']} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <table className="stats-table">
          <caption className="sr-only">Gender breakdown by participant count and percentage</caption>
          <thead>
            <tr><th scope="col">Gender</th><th scope="col">Count</th><th scope="col">%</th></tr>
          </thead>
          <tbody>
            {data.map(d => (
              <tr key={d.key}>
                <td>{d.name}</td>
                <td>{d.value.toLocaleString()}</td>
                <td>{((d.value / total) * 100).toFixed(1)}%</td>
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
    </section>
  );
}
