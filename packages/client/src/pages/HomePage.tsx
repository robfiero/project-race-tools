import { useState } from 'react';
import { apiUrl } from '../api.ts';
import type { UploadResponse } from '../types.ts';
import type { Section, ParticipantSession } from '../App.tsx';
import './HomePage.css';

interface Props {
  onDemoLaunch: (session: ParticipantSession) => void;
  onNavigate: (section: Section) => void;
}

// ─── Demo data definitions ────────────────────────────────────────────────────

const SINGLE_DEMOS = [
  { id: 'pinecrest-5k-2024',         label: 'Pinecrest 5K — local race, ~100 participants',            year: '2024' },
  { id: 'white-mountains-2024',       label: 'White Mountains Challenge — multi-event, ~350 participants', year: '2024' },
  { id: 'mountain-endurance-2024',    label: 'Mountain Endurance Challenge — large race, ~850 participants', year: '2024' },
];

const MULTI_DEMOS = [
  {
    label: 'White Mountains Challenge — 2022, 2023, 2024',
    years: [
      { id: 'white-mountains-2022', year: '2022' },
      { id: 'white-mountains-2023', year: '2023' },
      { id: 'white-mountains-2024', year: '2024' },
    ],
  },
  {
    label: 'Mountain Endurance Challenge — 2022, 2023, 2024',
    years: [
      { id: 'mountain-endurance-2022', year: '2022' },
      { id: 'mountain-endurance-2023', year: '2023' },
      { id: 'mountain-endurance-2024', year: '2024' },
    ],
  },
];

async function fetchSample(sampleId: string): Promise<UploadResponse> {
  const res = await fetch(apiUrl('/api/sample'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sampleId }),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string) ?? 'Failed to load sample data');
  return data as unknown as UploadResponse;
}

// ─── Tool card ────────────────────────────────────────────────────────────────

interface ToolCardProps {
  title: string;
  description: string;
  section: Section;
  available: boolean;
  onNavigate: (section: Section) => void;
}

function ToolCard({ title, description, section, available, onNavigate }: ToolCardProps) {
  return (
    <div className={`tool-card${available ? '' : ' tool-card--soon'}`}>
      <div className="tool-card-header">
        <h3 className="tool-card-title">{title}</h3>
        {!available && <span className="tool-card-badge">Coming soon</span>}
      </div>
      <p className="tool-card-desc">{description}</p>
      {available ? (
        <button
          type="button"
          className="btn btn-primary tool-card-btn"
          onClick={() => onNavigate(section)}
        >
          Open tool →
        </button>
      ) : (
        <button type="button" className="btn tool-card-btn tool-card-btn--disabled" disabled>
          Not yet available
        </button>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HomePage({ onDemoLaunch, onNavigate }: Props) {
  const [singleDemoIdx, setSingleDemoIdx] = useState(0);
  const [multiDemoIdx, setMultiDemoIdx]   = useState(0);
  const [singleLoading, setSingleLoading] = useState(false);
  const [multiLoading,  setMultiLoading]  = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function launchSingleDemo() {
    const demo = SINGLE_DEMOS[singleDemoIdx];
    setSingleLoading(true);
    setError(null);
    try {
      const session = await fetchSample(demo.id);
      onDemoLaunch({ mode: 'single', session, label: demo.year });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load demo');
    } finally {
      setSingleLoading(false);
    }
  }

  async function launchMultiDemo() {
    const demo = MULTI_DEMOS[multiDemoIdx];
    setMultiLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        demo.years.map(y => fetchSample(y.id).then(session => ({ session, label: y.year })))
      );
      const sorted = [...results].sort((a, b) => parseInt(a.label) - parseInt(b.label));
      onDemoLaunch({
        mode: 'comparison',
        sessions: sorted.map(r => ({
          sessionId: r.session.sessionId,
          label: r.label,
          raceName: r.session.raceName,
        })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load demo');
    } finally {
      setMultiLoading(false);
    }
  }

  return (
    <div className="home-page">

      {/* ── Welcome ── */}
      <section className="home-hero">
        <h1 className="home-hero-title">Race Director Analytics</h1>
        <p className="home-hero-subtitle">
          This project is a suite of data tools for race directors to perform deeper analytics
          on various race related data. Upload various files from your registration and results
          hosting systems to explore demographics, registration trends, and year-over-year
          growth — with no personally identifiable information ever stored.
        </p>
      </section>

      {/* ── Demo launcher ── */}
      <section className="home-demo card">
        <h2 className="home-demo-title">Try it with sample data</h2>
        <p className="home-demo-desc">
          Explore the tools without uploading your own files. Choose a sample race below and
          launch the analysis instantly.
        </p>

        <div className="home-demo-tool-label">
          <span className="home-demo-tool-name">Participant Analytics</span>
          <span className="home-demo-tool-hint">Additional samples for Race Result Analytics and Financials will be added when those tools launch.</span>
        </div>

        <div className="home-demo-rows">

          {/* Single-year */}
          <div className="demo-row">
            <span className="demo-row-label">Single-year analysis</span>
            <div className="demo-row-controls">
              <select
                className="demo-select"
                value={singleDemoIdx}
                onChange={e => setSingleDemoIdx(Number(e.target.value))}
                aria-label="Select sample race for single-year demo"
              >
                {SINGLE_DEMOS.map((d, i) => (
                  <option key={d.id} value={i}>{d.label}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary demo-btn"
                onClick={launchSingleDemo}
                disabled={singleLoading || multiLoading}
                aria-label="Launch single-year demo"
              >
                {singleLoading ? 'Loading…' : 'See Demo →'}
              </button>
            </div>
          </div>

          <div className="demo-divider" aria-hidden="true" />

          {/* Multi-year */}
          <div className="demo-row">
            <span className="demo-row-label">Multi-year comparison</span>
            <div className="demo-row-controls">
              <select
                className="demo-select"
                value={multiDemoIdx}
                onChange={e => setMultiDemoIdx(Number(e.target.value))}
                aria-label="Select sample race series for multi-year demo"
              >
                {MULTI_DEMOS.map((d, i) => (
                  <option key={i} value={i}>{d.label}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary demo-btn"
                onClick={launchMultiDemo}
                disabled={singleLoading || multiLoading}
                aria-label="Launch multi-year demo"
              >
                {multiLoading ? 'Loading…' : 'See Demo →'}
              </button>
            </div>
          </div>

        </div>

        {error && <p className="demo-error" role="alert">{error}</p>}

        <p className="demo-note">
          Sample data is synthetic — names, emails, and addresses are never real. Personal
          information is stripped immediately on upload for your own files as well.
        </p>
      </section>

      {/* ── Tool cards ── */}
      <section className="home-tools">
        <h2 className="home-tools-title">Available tools</h2>
        <div className="home-tools-grid">
          <ToolCard
            title="Participant Analytics"
            description="Upload UltraSignup exports to explore registration demographics, age and gender breakdowns, geographic reach, registration timing, coupon usage, and year-over-year comparisons."
            section="participants"
            available={true}
            onNavigate={onNavigate}
          />
          <ToolCard
            title="Race Result Analytics"
            description="Analyze finish times, DNF rates, pace distributions, and performance trends across one or multiple years of race results."
            section="results"
            available={false}
            onNavigate={onNavigate}
          />
          <ToolCard
            title="Financials Reconciliation"
            description="Cross-reference registration revenue against financial statements to reconcile participant counts, fees, discounts, and comped entries for a single race year."
            section="financials"
            available={false}
            onNavigate={onNavigate}
          />
        </div>
      </section>

    </div>
  );
}
