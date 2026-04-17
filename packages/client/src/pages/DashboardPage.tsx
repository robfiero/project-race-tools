import { useState, useEffect, useCallback, useRef } from 'react';
import { apiUrl } from '../api.ts';
import type { UploadResponse, StatsResponse } from '../types.ts';
import EventFilter from '../components/EventFilter.tsx';
import StatCard from '../components/StatCard.tsx';
import GenderSection from '../components/GenderSection.tsx';
import AgeSection from '../components/AgeSection.tsx';
import GeographicSection from '../components/GeographicSection.tsx';
import DistanceSection from '../components/DistanceSection.tsx';
import CrossEventSection from '../components/CrossEventSection.tsx';
import RegistrationSection from '../components/RegistrationSection.tsx';
import ParticipationSection from '../components/AttritionSection.tsx';
import './DashboardPage.css';

interface Props {
  session: UploadResponse;
  label: string;
  onBack: () => void;
}

export default function DashboardPage({ session, label, onBack }: Props) {
  const pageHeadingRef = useRef<HTMLHeadingElement>(null);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (events: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const params = events.length > 0
        ? `?events=${encodeURIComponent(events.join(','))}`
        : '';
      const res = await fetch(apiUrl(`/api/stats/${session.sessionId}${params}`));
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Failed to load statistics.');
        return;
      }
      setData(json as StatsResponse);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [session.sessionId]);

  useEffect(() => {
    fetchStats(selectedEvents);
  }, [fetchStats, selectedEvents]);

  useEffect(() => {
    pageHeadingRef.current?.focus();
  }, [session.sessionId]);

  const stats = data?.stats;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="dashboard-header-left">
          <button type="button" className="btn-ghost dashboard-back" onClick={onBack}>
            ← New analysis
          </button>
          <h1 ref={pageHeadingRef} tabIndex={-1} className="dashboard-title">
            {session.raceName} — Participant Analysis{/^\d{4}$/.test(label) && ` ${label}`}
          </h1>
          <dl className="dashboard-meta">
            <div className="dashboard-meta-row">
              <dt>Participants</dt>
              <dd>{session.participantCount.toLocaleString()}</dd>
            </div>
            <div className="dashboard-meta-row">
              <dt>Export format</dt>
              <dd>{session.adapterName}</dd>
            </div>
            <div className="dashboard-meta-row">
              <dt>Time zone</dt>
              <dd>{session.timezone}</dd>
            </div>
            {!session.venueGeocoded && (
              <div className="dashboard-meta-row dashboard-no-venue">
                <dt>Distance stats</dt>
                <dd>Unavailable — no venue address provided</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <EventFilter
        events={session.events}
        selected={selectedEvents}
        onChange={setSelectedEvents}
      />

      {loading && <div className="dashboard-loading" role="status" aria-live="polite">Loading statistics…</div>}
      {error && <div className="dashboard-error" role="alert">{error}</div>}

      {stats && !loading && (
        <div className="dashboard-sections">
          {/* Summary row */}
          <div className="summary-cards">
            <StatCard
              label="Total Participants"
              value={stats.summary.totalParticipants.toLocaleString()}
            />
            <StatCard
              label="Active Participants"
              value={stats.summary.activeParticipants.toLocaleString()}
              sub="not dropped or removed"
            />
            {stats.summary.events.map(e => (
              <StatCard key={e.name} label={e.name} value={e.count.toLocaleString()} />
            ))}
          </div>

          <GenderSection stats={stats.gender} />
          <AgeSection stats={stats.age} />
          <GeographicSection stats={stats.geographic} />
          {stats.distance && <DistanceSection stats={stats.distance} />}
          <CrossEventSection stats={stats.crossEvent} />
          <RegistrationSection stats={stats.registration} />
          <ParticipationSection participation={stats.participation} teams={stats.teams} />
        </div>
      )}
    </div>
  );
}
