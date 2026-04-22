import type { ParticipationStats, ParticipantStatusStats, ParticipantStatusCounts, TeamStats } from '../types.ts';
import SectionHeader from './SectionHeader.tsx';
import StatCard from './StatCard.tsx';
import './ChartSection.css';

interface Props {
  participation: ParticipationStats;
  teams: TeamStats;
}

type StatusKey = keyof ParticipantStatusCounts;

const STATUS_ROWS: Array<{ key: StatusKey; label: string; note?: string }> = [
  { key: 'paidActive',                label: 'Paid & Active' },
  { key: 'paidDropped',               label: 'Paid & Dropped' },
  { key: 'waitlistNeverInvited',      label: 'Waitlist — Never Invited' },
  { key: 'waitlistWithdrawnDeclined', label: 'Waitlist — Withdrawn / Declined' },
  { key: 'specialCaseA',              label: 'Special Case A', note: 'No order type, removed' },
  { key: 'specialCaseB',              label: 'Special Case B', note: 'No order type, active' },
  { key: 'other',                     label: 'Other' },
];

export default function ParticipationSection({ participation, teams }: Props) {
  const active = participation.totalRegistered - participation.dropped - participation.removed;
  const { statusBreakdown } = participation;
  const multiEvent = statusBreakdown.byEvent.length > 1;

  // Only show rows where the overall total is non-zero
  const visibleRows = !statusBreakdown.hasStatementData
    ? []
    : STATUS_ROWS.filter(r => statusBreakdown[r.key] > 0);

  return (
    <section className="chart-section">
      <SectionHeader title="Registration & Drops" />

      <div className="stat-cards-row">
        <StatCard
          label="Total Registered"
          value={participation.totalRegistered.toLocaleString()}
        />
        <StatCard
          label="Paid"
          value={participation.paid.toLocaleString()}
        />
        {participation.relayJoins > 0 && (
          <StatCard
            label="Relay Joins"
            value={participation.relayJoins.toLocaleString()}
            sub="captain-pays model"
          />
        )}
        {participation.comped > 0 && (
          <StatCard
            label="Comped"
            value={participation.comped.toLocaleString()}
            sub={`${participation.compedPercent}% — RD / volunteer`}
          />
        )}
        <StatCard
          label="Active"
          value={active.toLocaleString()}
          sub="not dropped or removed"
        />
        {participation.dropped > 0 && (
          <StatCard
            label="Dropped"
            value={participation.dropped.toLocaleString()}
            sub={`${participation.droppedPercent}%`}
          />
        )}
        {participation.removed > 0 && (
          <StatCard
            label="Removed"
            value={participation.removed.toLocaleString()}
            sub={`${participation.removedPercent}%`}
          />
        )}
      </div>

      {visibleRows.length > 0 && (
        <div className="chart-subsection">
          <h3 className="chart-subsection-title">Registration Status Breakdown</h3>
          {multiEvent ? (
            <div className="cross-event-scroll">
              <table className="stats-table status-breakdown-table">
                <caption className="sr-only">Registration status by event</caption>
                <thead>
                  <tr>
                    <th scope="col">Status</th>
                    {statusBreakdown.byEvent.map(ev => (
                      <th key={ev.eventName} scope="col">{ev.eventName}</th>
                    ))}
                    <th scope="col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map(row => (
                    <tr key={row.key}>
                      <td>
                        {row.label}
                        {row.note && <span className="status-note"> — {row.note}</span>}
                      </td>
                      {statusBreakdown.byEvent.map(ev => (
                        <td key={ev.eventName}>{ev[row.key].toLocaleString()}</td>
                      ))}
                      <td className="status-total">{statusBreakdown[row.key].toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <table className="stats-table stats-table--narrow">
              <caption className="sr-only">Participant registration status classification</caption>
              <thead>
                <tr>
                  <th scope="col">Status</th>
                  <th scope="col">Count</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(row => (
                  <tr key={row.key}>
                    <td>{row.label}{row.note && <span className="status-note"> — {row.note}</span>}</td>
                    <td>{statusBreakdown[row.key].toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {teams.hasTeams && (
        <>
          <SectionHeader title="Teams" level={3} />
          <div className="stat-cards-row">
            <StatCard label="Teams" value={teams.totalTeams.toLocaleString()} />
            <StatCard label="Avg Team Size" value={teams.avgTeamSize} />
            <StatCard label="Team Participants" value={teams.teamParticipants.toLocaleString()} />
            <StatCard label="Solo Participants" value={teams.soloParticipants.toLocaleString()} />
            {teams.teamAvgAge !== null && (
              <StatCard label="Team Avg Age" value={teams.teamAvgAge} />
            )}
            {teams.soloAvgAge !== null && (
              <StatCard label="Solo Avg Age" value={teams.soloAvgAge} />
            )}
          </div>
          {(teams.allMaleTeams > 0 || teams.allFemaleTeams > 0 || teams.mixedTeams > 0) && (
            <div className="chart-subsection">
              <h3 className="chart-subsection-title">Team Gender Composition</h3>
              <table className="stats-table stats-table--narrow">
                <caption className="sr-only">Team gender composition counts</caption>
                <thead>
                  <tr><th scope="col">Composition</th><th scope="col">Teams</th></tr>
                </thead>
                <tbody>
                  {teams.allFemaleTeams > 0 && (
                    <tr><td>All Female</td><td>{teams.allFemaleTeams}</td></tr>
                  )}
                  {teams.allMaleTeams > 0 && (
                    <tr><td>All Male</td><td>{teams.allMaleTeams}</td></tr>
                  )}
                  {teams.mixedTeams > 0 && (
                    <tr><td>Mixed Gender</td><td>{teams.mixedTeams}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
