import type { CrossEventStats } from '../types.ts';
import SectionHeader from './SectionHeader.tsx';
import './ChartSection.css';

interface Props {
  stats: CrossEventStats;
}

export default function CrossEventSection({ stats }: Props) {
  if (stats.rows.length === 0) return null;

  const hasDistance = stats.rows.some(r => r.medianDistanceMiles !== null);
  const hasNonBinary = stats.rows.some(r => r.nonBinary > 0);

  return (
    <section className="chart-section">
      <SectionHeader
        title="Cross-Event Comparison"
        sub="Side-by-side summary of each event in this upload"
      />
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
              {hasDistance && <th scope="col">Median Distance</th>}
              {hasDistance && <th scope="col">Local %</th>}
              {hasDistance && <th scope="col">Destination % (≥ 200 mi)</th>}
            </tr>
          </thead>
          <tbody>
            {stats.rows.map(row => (
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
