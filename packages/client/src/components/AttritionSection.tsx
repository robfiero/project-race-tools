import type { ParticipationStats, TeamStats } from '../types.ts';
import SectionHeader from './SectionHeader.tsx';
import StatCard from './StatCard.tsx';
import './ChartSection.css';

interface Props {
  participation: ParticipationStats;
  teams: TeamStats;
}

export default function ParticipationSection({ participation, teams }: Props) {
  const active = participation.totalRegistered - participation.dropped - participation.removed;

  return (
    <section className="chart-section">
      <SectionHeader title="Participation" />

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
