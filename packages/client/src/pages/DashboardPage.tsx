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
import ParticipationSection, { computeTotalActive } from '../components/AttritionSection.tsx';
import SectionHeader from '../components/SectionHeader.tsx';
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
  const reportYear = /^\d{4}$/.test(label) ? label : null;
  const eventTypeLabel = session.events.length > 1
    ? `Single-year registration · ${session.events.length} events`
    : 'Single-year registration';
  const venueAddress = stats?.distance?.venueAddress?.trim() || null;

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <button type="button" className="btn-ghost dashboard-back no-print" onClick={onBack}>
            ← New analysis
          </button>
          <h1 ref={pageHeadingRef} tabIndex={-1} className="dashboard-title">
            {session.raceName}
          </h1>
          <p className="dashboard-subtitle">
            Registration Analysis{reportYear ? ` · ${reportYear}` : ''}
          </p>
          <dl className="dashboard-meta">
            {reportYear && (
              <div className="dashboard-meta-row">
                <dt>Year</dt>
                <dd>{reportYear}</dd>
              </div>
            )}
            <div className="dashboard-meta-row">
              <dt>Imported Records</dt>
              <dd>{session.participantCount.toLocaleString()}</dd>
            </div>
            <div className="dashboard-meta-row">
              <dt>Import Source</dt>
              <dd>{session.adapterName || 'Registration Analytics'}</dd>
            </div>
            <div className="dashboard-meta-row">
              <dt>Time zone</dt>
              <dd>{session.timezone}</dd>
            </div>
            <div className="dashboard-meta-row">
              <dt>Event Type</dt>
              <dd>{eventTypeLabel}</dd>
            </div>
            {venueAddress && (
              <div className="dashboard-meta-row">
                <dt>Venue</dt>
                <dd>{venueAddress}</dd>
              </div>
            )}
            {!venueAddress && !session.venueGeocoded && (
              <div className="dashboard-meta-row dashboard-no-venue">
                <dt>Venue</dt>
                <dd>Unavailable — no venue address provided</dd>
              </div>
            )}
          </dl>
        </div>
        <button
          type="button"
          className="btn btn-primary no-print"
          onClick={() => window.print()}
          aria-label="Save analysis as PDF"
        >
          Save as PDF
        </button>
      </header>

      <EventFilter
        events={session.events}
        selected={selectedEvents}
        onChange={setSelectedEvents}
      />

      {loading && <div className="dashboard-loading" role="status" aria-live="polite" aria-busy="true">Loading statistics…</div>}
      {error && <div className="dashboard-error" role="alert">{error}</div>}

      {stats && !loading && (
        <>
          <nav className="report-nav no-print" aria-label="Jump to section">
            <span className="report-nav-label">Jump To:</span>
            <div className="report-nav-links">
              <a href="#dash-summary" className="report-nav-link">Summary</a>
              <a href="#dash-participation" className="report-nav-link">Registration & Drops</a>
              <a href="#dash-registration" className="report-nav-link">Registration Timing</a>
              <a href="#dash-cross-event" className="report-nav-link">Event Comparison</a>
              <a href="#dash-demographics" className="report-nav-link">Gender</a>
              <a href="#dash-age" className="report-nav-link">Age Distribution</a>
              <a href="#dash-geography" className="report-nav-link">Geography</a>
            </div>
          </nav>
          <div className="dashboard-sections">
            <section id="dash-summary" className="chart-section">
              <SectionHeader title="Quick Summary" />
              <div className="summary-cards">
                <StatCard
                  label="Active Participants"
                  value={(stats.participation.statusBreakdown.hasStatementData
                    ? computeTotalActive(stats.participation.statusBreakdown)
                    : stats.summary.activeParticipants
                  ).toLocaleString()}
                />
                <StatCard
                  label="Coupon Usage"
                  value={`${stats.registration.couponUsagePercent}%`}
                  sub="of registrants"
                />
                <StatCard
                  label="Paid & Dropped"
                  value={stats.participation.statusBreakdown.hasStatementData
                    ? (stats.participation.statusBreakdown.creditCardDropped
                      + stats.participation.statusBreakdown.paypalDropped
                      + stats.participation.statusBreakdown.giftCardDropped).toLocaleString()
                    : '—'}
                  sub={!stats.participation.statusBreakdown.hasStatementData ? 'not available' : undefined}
                />
                <StatCard
                  label="Not Invited From Waitlist"
                  value={stats.participation.statusBreakdown.hasStatementData
                    ? stats.participation.statusBreakdown.waitlistNeverInvited.toLocaleString()
                    : '—'}
                  sub={!stats.participation.statusBreakdown.hasStatementData ? 'not available' : undefined}
                />
                <StatCard label="Female" value={`${stats.gender.femalePercent}%`} />
                <StatCard label="Male" value={`${stats.gender.malePercent}%`} />
                <StatCard label="Non-Binary" value={`${stats.gender.nonBinaryPercent}%`} />
              </div>
            </section>

            <div id="dash-participation">
              <ParticipationSection
                participation={stats.participation}
                teams={stats.teams}
                couponUsageCount={stats.registration.couponUsageCount}
                couponUsagePercent={stats.registration.couponUsagePercent}
              />
            </div>
            <div id="dash-registration">
              <RegistrationSection stats={stats.registration} />
            </div>
            <div id="dash-cross-event">
              <CrossEventSection stats={stats.crossEvent} selectedEvents={selectedEvents} />
            </div>
            <div id="dash-demographics">
              <GenderSection stats={stats.gender} title="Gender" />
            </div>
            <div id="dash-age">
              <AgeSection stats={stats.age} />
            </div>
            <div id="dash-geography">
              <GeographicSection stats={stats.geographic} summaryMode="race-results" stateChartBarColor="#1F7A7A" />
              {stats.distance && <DistanceSection stats={stats.distance} />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
