import {
  AreaChart, Area,
  BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { RegistrationStats, RegistrantProfile } from '../types.ts';
import SectionHeader from './SectionHeader.tsx';
import StatCard from './StatCard.tsx';
import InsightCallout from './InsightCallout.tsx';
import { useTheme } from '../ThemeContext.tsx';
import { chartPalette } from '../chartColors.ts';
import { registrationInsights } from '../insights.ts';
import './ChartSection.css';

interface Props { stats: RegistrationStats; }

function formatMonth(ym: string): string {
  const [year, month] = ym.split('-');
  return new Date(Number(year), Number(month) - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function ProfileTable({ label, profile }: { label: string; profile: RegistrantProfile }) {
  return (
    <div className="profile-block">
      <h4 className="profile-label">{label} <span className="profile-count">({profile.count} registrants)</span></h4>
      <table className="stats-table stats-table--narrow">
        <caption className="sr-only">{label} profile statistics</caption>
        <tbody>
          <tr><th scope="row">Female</th><td>{profile.femalePercent}%</td></tr>
          <tr><th scope="row">Avg Age</th><td>{profile.avgAge ?? '—'}</td></tr>
          {profile.medianDistanceMiles !== null && (
            <tr><th scope="row">Median Distance</th><td>{profile.medianDistanceMiles} mi</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function RegistrationSection({ stats }: Props) {
  const { theme } = useTheme();
  const [c0, c1, , c3] = theme.chart;
  const monthColors = chartPalette(theme, stats.byMonth.length);
  const dowColors = chartPalette(theme, stats.byDayOfWeek.length);
  const monthData = stats.byMonth.map(m => ({ ...m, month: formatMonth(m.month) }));
  const insights = registrationInsights(stats);

  // For the cumulative chart, show every Nth point to keep it readable
  const stride = Math.max(1, Math.floor(stats.cumulative.length / 60));
  const cumulativeData = stats.cumulative
    .filter((_, i) => i % stride === 0 || i === stats.cumulative.length - 1)
    .map(d => ({ date: d.date.slice(5), total: d.total })); // MM-DD

  // Peak hour for the callout
  const peakHour = [...stats.byHourOfDay].sort((a, b) => b.count - a.count)[0];
  const peakDay = [...stats.byDayOfWeek].sort((a, b) => b.count - a.count)[0];

  return (
    <section className="chart-section">
      <SectionHeader title="Registration Timing" />

      <div className="stat-cards-row">
        <StatCard
          label="Coupon Users"
          value={stats.couponUsageCount.toLocaleString()}
          sub={`${stats.couponUsagePercent}% of registrants`}
        />
        <StatCard label="Peak Day" value={peakDay.day} sub={`${peakDay.count} registrations`} />
        <StatCard label="Peak Hour" value={peakHour.label} sub={`${peakHour.count} registrations`} />
      </div>

      <InsightCallout insights={insights} />

      {/* Monthly registrations */}
      <div className="chart-subsection">
        <h3 className="chart-subsection-title">Registrations by Month</h3>
        <div className="chart-wrap chart-wrap--full" role="img" aria-label="Bar chart: registrations by month">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => [v, 'Registrations']} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Registrations">
                {monthData.map((_, i) => <Cell key={i} fill={monthColors[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cumulative */}
      {cumulativeData.length > 1 && (
        <div className="chart-subsection">
          <h3 className="chart-subsection-title">Cumulative Registrations</h3>
          <div className="chart-wrap chart-wrap--full" role="img" aria-label="Area chart: cumulative registrations over time">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={cumulativeData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <defs>
                  <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={c1} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={c1} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [v, 'Total registered']} />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke={c1}
                  strokeWidth={2}
                  fill="url(#cumGrad)"
                  name="Total registered"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Day of week + Hour of day side by side */}
      <div className="two-col">
        <div className="chart-subsection">
          <h3 className="chart-subsection-title">Registrations by Day of Week</h3>
          <div role="img" aria-label="Bar chart: registrations by day of week">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.byDayOfWeek} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(0, 3)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [v, 'Registrations']} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Registrations">
                  {stats.byDayOfWeek.map((_, i) => <Cell key={i} fill={dowColors[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-subsection">
          <h3 className="chart-subsection-title">Registrations by Hour of Day</h3>
          <div role="img" aria-label="Bar chart: registrations by hour of day">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.byHourOfDay} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={h => h % 6 === 0 ? hourLabel(h) : ''} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  labelFormatter={h => hourLabel(Number(h))}
                  formatter={(v: number) => [v, 'Registrations']}
                />
                <Bar dataKey="count" fill={c3} radius={[4, 4, 0, 0]} name="Registrations" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Early vs late profile */}
      <div className="chart-subsection">
        <h3 className="chart-subsection-title">Early vs. Late Registrants (first vs. last 25%)</h3>
        <div className="profile-row">
          <ProfileTable label="Early Registrants" profile={stats.earlyProfile} />
          <ProfileTable label="Late Registrants" profile={stats.lateProfile} />
        </div>
      </div>
    </section>
  );
}

function hourLabel(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}
