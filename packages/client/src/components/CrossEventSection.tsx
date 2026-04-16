import type { CrossEventStats } from '../types.ts';
import SectionHeader from './SectionHeader.tsx';
import './ChartSection.css';

interface Props {
  stats: CrossEventStats;
}

export default function CrossEventSection({ stats }: Props) {
  if (stats.rows.length === 0) return null;

  const hasDistance = stats.rows.some(r => r.medianDistanceMiles !== null);

  return (
    <section className="chart-section">
      <SectionHeader
        title="Cross-Event Comparison"
        sub="Side-by-side summary of each event in this upload"
      />
      <div className="cross-event-scroll">
        <table className="stats-table cross-event-table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Participants</th>
              <th>Female %</th>
              <th>Male %</th>
              <th>Avg Age</th>
              <th>Median Age</th>
              {hasDistance && <th>Median Distance</th>}
              {hasDistance && <th>Local %</th>}
              {hasDistance && <th>Destination %</th>}
            </tr>
          </thead>
          <tbody>
            {stats.rows.map(row => (
              <tr key={row.name}>
                <td className="cross-event-name">{row.name}</td>
                <td>{row.count.toLocaleString()}</td>
                <td>{row.femalePercent}%</td>
                <td>{(100 - row.femalePercent).toFixed(1)}%</td>
                <td>{row.avgAge ?? '—'}</td>
                <td>{row.medianAge ?? '—'}</td>
                {hasDistance && (
                  <td>{row.medianDistanceMiles !== null ? `${row.medianDistanceMiles} mi` : '—'}</td>
                )}
                {hasDistance && (
                  <td>{row.localPercent !== null ? `${row.localPercent}%` : '—'}</td>
                )}
                {hasDistance && (
                  <td>{row.destinationPercent !== null ? `${row.destinationPercent}%` : '—'}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
