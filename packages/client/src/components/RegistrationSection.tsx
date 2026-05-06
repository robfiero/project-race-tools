import {
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList,
} from 'recharts';
import type { RegistrationStats, EventRegistrationStats } from '../types.ts';
import SectionHeader from './SectionHeader.tsx';
import StatCard from './StatCard.tsx';
import InsightCallout from './InsightCallout.tsx';
import { useTheme } from '../ThemeContext.tsx';
import { chartPalette } from '../chartColors.ts';
import { registrationInsights } from '../insights.ts';
import './ChartSection.css';

interface Props { stats: RegistrationStats; compact?: boolean; }

function formatMonth(ym: string): string {
  const [year, month] = ym.split('-');
  return new Date(Number(year), Number(month) - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

// ─── Per-event data helpers ──────────────────────────────────────────────────

function buildStackedMonthData(events: EventRegistrationStats[]) {
  const allMonths = [...new Set(events.flatMap(ev => ev.byMonth.map(m => m.month)))].sort();
  return allMonths.map(month => {
    const row: Record<string, string | number> = { month: formatMonth(month) };
    let total = 0;
    for (const ev of events) {
      const count = ev.byMonth.find(m => m.month === month)?.count ?? 0;
      row[ev.eventName] = count;
      total += count;
    }
    row['__total'] = total;
    return row;
  });
}

function buildMultiCumulativeData(events: EventRegistrationStats[]) {
  const allDates = [...new Set(events.flatMap(ev => ev.cumulative.map(d => d.date)))].sort();
  const lastKnown = new Map<string, number>();
  return allDates.map(date => {
    const row: Record<string, string | number> = { date: date.slice(5) };
    for (const ev of events) {
      const pt = ev.cumulative.find(d => d.date === date);
      if (pt) lastKnown.set(ev.eventName, pt.total);
      row[ev.eventName] = lastKnown.get(ev.eventName) ?? 0;
    }
    return row;
  });
}

// ─── Stacked month tooltip showing total + per-event breakdown ───────────────

interface TooltipEntry { dataKey: string; value: number; fill: string; }

function StackedMonthTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const entries = payload.filter(p => p.dataKey !== '__total');
  const total = entries.reduce((s, p) => s + (p.value ?? 0), 0);
  return (
    <div style={{
      background: '#fff', border: '1px solid #ddd', borderRadius: 6,
      padding: '8px 12px', fontSize: '0.8rem', lineHeight: 1.5,
    }}>
      <p style={{ fontWeight: 600, margin: '0 0 3px' }}>{label}</p>
      <p style={{ color: '#666', margin: '0 0 4px', borderBottom: '1px solid #eee', paddingBottom: 3 }}>
        Total: {total.toLocaleString()}
      </p>
      {[...entries].reverse().map(p => (
        <p key={p.dataKey} style={{ color: p.fill, margin: '1px 0' }}>
          {p.dataKey}: {(p.value ?? 0).toLocaleString()}
        </p>
      ))}
    </div>
  );
}

const BAR_LABEL_STYLE = { fontSize: 10, fill: '#555' };

// ─── Main component ──────────────────────────────────────────────────────────

export default function RegistrationSection({ stats, compact = false }: Props) {
  const { theme } = useTheme();
  const [c0, c1] = theme.chart;
  const eventColors = chartPalette(theme, stats.byEvent.length);
  const monthData = stats.byMonth.map(m => ({ ...m, month: formatMonth(m.month) }));
  const insights = registrationInsights(stats);
  const multiEvent = stats.byEvent.length > 1;

  // Single-event cumulative (area chart)
  const stride = Math.max(1, Math.floor(stats.cumulative.length / 60));
  const cumulativeData = stats.cumulative
    .filter((_, i) => i % stride === 0 || i === stats.cumulative.length - 1)
    .map(d => ({ date: d.date.slice(5), total: d.total }));

  // Multi-event stacked/line data
  const stackedMonthData = multiEvent ? buildStackedMonthData(stats.byEvent) : [];
  const multiCumulativeData = multiEvent
    ? (() => {
        const raw = buildMultiCumulativeData(stats.byEvent);
        const s = Math.max(1, Math.floor(raw.length / 60));
        return raw.filter((_, i) => i % s === 0 || i === raw.length - 1);
      })()
    : [];

  const peakHour = [...stats.byHourOfDay].sort((a, b) => b.count - a.count)[0];
  const peakDay  = [...stats.byDayOfWeek].sort((a, b) => b.count - a.count)[0];
  const lastEventIdx = stats.byEvent.length - 1;

  return (
    <section className="chart-section">
      <SectionHeader title="Registration Timing" />

      <div className="stat-cards-row">
        <StatCard label="Peak Day" value={peakDay.day} sub={`${peakDay.count} registrations`} />
        <StatCard label="Peak Hour" value={peakHour.label} sub={`${peakHour.count} registrations`} />
      </div>

      <InsightCallout insights={insights} />

      {/* ── Registrations by Month ── */}
      <div className="chart-subsection">
        <h3 className="chart-subsection-title">Registrations by Month</h3>
        <div className="chart-wrap chart-wrap--full" role="img" aria-label={multiEvent ? 'Stacked bar chart: registrations by month and event' : 'Bar chart: registrations by month'}>
          <ResponsiveContainer width="100%" height={multiEvent ? 220 : 200}>
            {multiEvent ? (
              <BarChart data={stackedMonthData} margin={{ top: 20, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<StackedMonthTooltip />} />
                <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                {stats.byEvent.map((ev, i) => (
                  <Bar key={ev.eventName} dataKey={ev.eventName} stackId="a" fill={eventColors[i]}
                    radius={i === lastEventIdx ? [3, 3, 0, 0] : [0, 0, 0, 0]}>
                    {i === lastEventIdx && (
                      <LabelList dataKey="__total" position="top" style={BAR_LABEL_STYLE}
                        formatter={(v: number) => v > 0 ? v.toLocaleString() : ''} />
                    )}
                  </Bar>
                ))}
              </BarChart>
            ) : (
              <BarChart data={monthData} margin={{ top: 20, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [v, 'Registrations']} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Registrations" fill={c0}>
                  <LabelList dataKey="count" position="top" style={BAR_LABEL_STYLE}
                    formatter={(v: number) => v > 0 ? v.toLocaleString() : ''} />
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Cumulative Registrations ── */}
      {(cumulativeData.length > 1 || multiCumulativeData.length > 1) && (
        <div className="chart-subsection">
          <h3 className="chart-subsection-title">Cumulative Registrations</h3>
          <div className="chart-wrap chart-wrap--full" role="img" aria-label={multiEvent ? 'Line chart: cumulative registrations by event' : 'Area chart: cumulative registrations over time'}>
            <ResponsiveContainer width="100%" height={multiEvent ? 220 : 200}>
              {multiEvent ? (
                <LineChart data={multiCumulativeData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                  {stats.byEvent.map((ev, i) => (
                    <Line key={ev.eventName} type="monotone" dataKey={ev.eventName}
                      stroke={eventColors[i]} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              ) : (
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
                  <Area type="monotone" dataKey="total" stroke={c1} strokeWidth={2}
                    fill="url(#cumGrad)" name="Total registered" />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Day of Week + Hour of Day ── */}
      <div className="two-col">
        <div className="chart-subsection">
          <h3 className="chart-subsection-title">Registrations by Day of Week</h3>
          <div role="img" aria-label="Bar chart: registrations by day of week">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.byDayOfWeek} margin={{ top: 20, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(0, 3)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [v, 'Registrations']} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Registrations" fill={c0}>
                  <LabelList dataKey="count" position="top" style={BAR_LABEL_STYLE}
                    formatter={(v: number) => v > 0 ? v.toLocaleString() : ''} />
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
                <Bar dataKey="count" fill={c0} radius={[4, 4, 0, 0]} name="Registrations" />
              </BarChart>
            </ResponsiveContainer>
          </div>
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
