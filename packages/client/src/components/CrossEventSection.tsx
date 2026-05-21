import { useState, type ReactNode } from 'react';
import type { CrossEventRow, CrossEventStats } from '../types.ts';
import SectionHeader from './SectionHeader.tsx';
import { useTheme } from '../ThemeContext.tsx';
import './ChartSection.css';

// Consistent with GenderSection neutral demographic palette
const GENDER_COLORS = { Female: '#0F766E', Male: '#6366F1', 'Non-Binary': '#F59E0B' } as const;

type CeTab  = 'charts' | 'table';

interface Props {
  stats: CrossEventStats;
  selectedEvents: string[];
}

function pct(value: number | null): string {
  return value == null ? '—' : `${value.toFixed(1)}%`;
}

function age(value: number | null): string {
  return value == null ? '—' : `${value.toFixed(1)} yrs`;
}

function rowPercent(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, value / max * 100));
}

function Segment({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <span
      className="cross-event-segment"
      style={{ flexBasis: `${Math.max(0, value)}%`, background: color }}
      title={`${label}: ${value.toFixed(1)}%`}
      aria-label={`${label}: ${value.toFixed(1)}%`}
    />
  );
}

export default function CrossEventSection({ stats, selectedEvents }: Props) {
  const { theme } = useTheme();
  const [tab, setTab] = useState<CeTab>('charts');

  const { rows } = stats;
  const hasDistance  = rows.some(r => r.medianDistanceMiles !== null);
  const hasNonBinary = rows.some(r => r.nonBinary > 0);

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

  if (rows.length <= 1) {
    return (
      <section className="chart-section">
        <SectionHeader title="Event Comparison" />
        <p className="cross-event-empty">
          Event Comparison appears when a report includes multiple events.
        </p>
      </section>
    );
  }

  const totalParticipants = rows.reduce((sum, row) => sum + row.count, 0);
  const maxParticipants = Math.max(...rows.map(row => row.count), 0);
  const participantLeader = rows.reduce<CrossEventRow | null>((best, row) =>
    !best || row.count > best.count ? row : best, null);
  const ageRows = rows.filter(row => row.avgAge != null || row.medianAge != null);
  const oldestAvg = ageRows.reduce<CrossEventRow | null>((best, row) =>
    row.avgAge != null && (!best || best.avgAge == null || row.avgAge > best.avgAge) ? row : best, null);
  const femaleLeader = rows.reduce<CrossEventRow | null>((best, row) =>
    !best || row.femalePercent > best.femalePercent ? row : best, null);
  const destinationLeader = rows.reduce<CrossEventRow | null>((best, row) => {
    if (row.destinationPercent == null) return best;
    return !best || (best.destinationPercent ?? -1) < row.destinationPercent ? row : best;
  }, null);

  function renderInsight(items: string[]) {
    if (items.length === 0) return null;
    return (
      <div className="insight-callout cross-event-insight">
        <ul className="insight-callout-list">
          {items.map(item => <li key={item} className="insight-callout-item">{item}</li>)}
        </ul>
      </div>
    );
  }

  function renderParticipantsByEvent() {
    return (
      <>
        <div className="cross-event-rows" aria-label="Participants by event">
          {rows.map(row => {
            const share = totalParticipants > 0 ? row.count / totalParticipants * 100 : 0;
            return (
              <div key={row.name} className="cross-event-row">
                <div className="cross-event-row-head">
                  <span className="cross-event-row-title">{row.name}</span>
                  <span className="cross-event-row-value">{row.count.toLocaleString()} · {share.toFixed(1)}%</span>
                </div>
                <div className="cross-event-bar-track" aria-hidden="true">
                  <span className="cross-event-bar-fill" style={{ width: `${rowPercent(row.count, maxParticipants)}%`, background: theme.chart[0] }} />
                </div>
              </div>
            );
          })}
        </div>
        {participantLeader && renderInsight([
          `${participantLeader.name} accounts for ${participantLeader.count.toLocaleString()} of ${totalParticipants.toLocaleString()} participants, ${(participantLeader.count / Math.max(totalParticipants, 1) * 100).toFixed(1)}% of the field.`,
        ])}
      </>
    );
  }

  function renderGenderMixByEvent() {
    return (
      <>
        <div className="cross-event-legend" aria-hidden="true">
          <span><i style={{ background: GENDER_COLORS.Female }} />Female</span>
          <span><i style={{ background: GENDER_COLORS.Male }} />Male</span>
          {hasNonBinary && <span><i style={{ background: GENDER_COLORS['Non-Binary'] }} />Non-Binary</span>}
        </div>
        <div className="cross-event-rows" aria-label="Gender mix by event">
          {rows.map(row => (
            <div key={row.name} className="cross-event-row">
              <div className="cross-event-row-head">
                <span className="cross-event-row-title">{row.name}</span>
                <span className="cross-event-row-value">
                  F {pct(row.femalePercent)} · M {pct(row.malePercent)}
                  {hasNonBinary ? ` · NB ${pct(row.nonBinaryPercent)}` : ''}
                </span>
              </div>
              <div className="cross-event-stacked-bar" aria-hidden="true">
                <Segment value={row.femalePercent} color={GENDER_COLORS.Female} label="Female" />
                <Segment value={row.malePercent} color={GENDER_COLORS.Male} label="Male" />
                {hasNonBinary && <Segment value={row.nonBinaryPercent} color={GENDER_COLORS['Non-Binary']} label="Non-Binary" />}
              </div>
            </div>
          ))}
        </div>
        {femaleLeader && renderInsight([
          `${femaleLeader.name} has the highest female participant share at ${femaleLeader.femalePercent.toFixed(1)}%.`,
        ])}
      </>
    );
  }

  function renderAgeProfileByEvent() {
    return (
      <>
        <p className="cross-event-subnote">Participant age data by event, based on registration records.</p>
        <div className="cross-event-age-profile" aria-label="Participant age profile by event">
          <div className="cross-event-age-profile-header" aria-hidden="true">
            <span>Event</span>
            <span>Average Age</span>
            <span>Median Age</span>
          </div>
          {rows.map(row => (
            <div key={row.name} className="cross-event-age-profile-row">
              <span className="cross-event-age-profile-event">{row.name}</span>
              <span className="cross-event-age-profile-stat" data-label="Average" aria-label={`Average age ${age(row.avgAge)}`}>
                <strong>{age(row.avgAge)}</strong>
              </span>
              <span className="cross-event-age-profile-stat" data-label="Median" aria-label={`Median age ${age(row.medianAge)}`}>
                <strong>{age(row.medianAge)}</strong>
              </span>
            </div>
          ))}
        </div>
        {oldestAvg && oldestAvg.avgAge != null && renderInsight([
          `${oldestAvg.name} has the oldest average participant age at ${oldestAvg.avgAge.toFixed(1)} years.`,
        ])}
      </>
    );
  }

  function renderTravelMixByEvent() {
    return (
      <>
        <div className="cross-event-legend" aria-hidden="true">
          <span><i style={{ background: theme.chart[0] }} />Local</span>
          <span><i style={{ background: theme.chart[1] }} />Regional</span>
          <span><i style={{ background: theme.chart[2] }} />Destination</span>
        </div>
        <div className="cross-event-rows" aria-label="Travel mix by event">
          {rows.map(row => (
            <div key={row.name} className="cross-event-row cross-event-row--light">
              <div className="cross-event-row-head">
                <span className="cross-event-row-title">{row.name}</span>
                <span className="cross-event-row-value">
                  Local {pct(row.localPercent)} · Regional {pct(row.regionalPercent)} · Destination {pct(row.destinationPercent)}
                </span>
              </div>
              <div className="cross-event-stacked-bar cross-event-stacked-bar--light" aria-hidden="true">
                <Segment value={row.localPercent ?? 0} color={theme.chart[0]} label="Local" />
                <Segment value={row.regionalPercent ?? 0} color={theme.chart[1]} label="Regional" />
                <Segment value={row.destinationPercent ?? 0} color={theme.chart[2]} label="Destination" />
              </div>
            </div>
          ))}
        </div>
        {destinationLeader && destinationLeader.destinationPercent != null && renderInsight([
          `${destinationLeader.name} has the highest destination share at ${destinationLeader.destinationPercent.toFixed(1)}%.`,
        ])}
      </>
    );
  }

  function renderComparisonGroup(title: string, children: ReactNode) {
    return (
      <div className="cross-event-group">
        <h3 className="cross-event-group-title">{title}</h3>
        {children}
      </div>
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
        <div role="tabpanel" className="rd-tab-panel cross-event-panel">
          {renderComparisonGroup('Participants by Event', renderParticipantsByEvent())}
          {renderComparisonGroup('Age Profile by Event', renderAgeProfileByEvent())}
          {renderComparisonGroup('Gender Mix by Event', renderGenderMixByEvent())}
          {hasDistance && renderComparisonGroup('Travel Mix by Event', renderTravelMixByEvent())}
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
