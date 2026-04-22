import { useState } from 'react';
import { apiUrl } from '../api.ts';
import type { UploadResponse, ResultsUploadResponse } from '../types.ts';
import type { Section, ParticipantSession } from '../App.tsx';
import type { UploadResult as ResultsUploadResult } from './RaceResultsPage.tsx';
import './HomePage.css';

interface Props {
  onDemoLaunch: (session: ParticipantSession) => void;
  onResultsDemoLaunch: (result: ResultsUploadResult) => void;
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

// ─── Race Analytics demo data ─────────────────────────────────────────────────

const RESULTS_SINGLE_DEMOS = [
  { id: 'ghost-train-2024',                label: 'Ridgeline Trail Races — single 50K, ~90 starters',   year: '2024' },
  { id: 'white-mountains-results-2024',    label: 'White Mountains Challenge — HM + 50K, ~240 starters',  year: '2024' },
  { id: 'mountain-endurance-results-2024', label: 'Mountain Endurance Challenge — 4 events, ~650 starters', year: '2024' },
];

const RESULTS_MULTI_DEMOS = [
  {
    label: 'Ridgeline Trail Races — 2022, 2023, 2024',
    years: [
      { id: 'ghost-train-2022', year: '2022' },
      { id: 'ghost-train-2023', year: '2023' },
      { id: 'ghost-train-2024', year: '2024' },
    ],
  },
  {
    label: 'Mountain Endurance Challenge — 2022, 2023, 2024',
    years: [
      { id: 'mountain-endurance-results-2022', year: '2022' },
      { id: 'mountain-endurance-results-2023', year: '2023' },
      { id: 'mountain-endurance-results-2024', year: '2024' },
    ],
  },
];

async function fetchResultsSample(sampleId: string): Promise<ResultsUploadResponse> {
  const res = await fetch(apiUrl('/api/results/sample'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sampleId }),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string) ?? 'Failed to load results sample');
  return data as unknown as ResultsUploadResponse;
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

export default function HomePage({ onDemoLaunch, onResultsDemoLaunch, onNavigate }: Props) {
  const [singleDemoIdx, setSingleDemoIdx] = useState(0);
  const [multiDemoIdx, setMultiDemoIdx]   = useState(0);
  const [singleLoading, setSingleLoading] = useState(false);
  const [multiLoading,  setMultiLoading]  = useState(false);

  const [rSingleDemoIdx, setRSingleDemoIdx] = useState(0);
  const [rMultiDemoIdx,  setRMultiDemoIdx]  = useState(0);
  const [rSingleLoading, setRSingleLoading] = useState(false);
  const [rMultiLoading,  setRMultiLoading]  = useState(false);

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

  async function launchResultsSingleDemo() {
    const demo = RESULTS_SINGLE_DEMOS[rSingleDemoIdx];
    setRSingleLoading(true);
    setError(null);
    try {
      const response = await fetchResultsSample(demo.id);
      onResultsDemoLaunch({ mode: 'single', upload: response, label: demo.year });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load demo');
    } finally {
      setRSingleLoading(false);
    }
  }

  async function launchResultsMultiDemo() {
    const demo = RESULTS_MULTI_DEMOS[rMultiDemoIdx];
    setRMultiLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        demo.years.map(y => fetchResultsSample(y.id).then(r => ({ response: r, label: y.year }))),
      );
      const sorted = [...results].sort((a, b) => parseInt(a.label) - parseInt(b.label));
      onResultsDemoLaunch({
        mode: 'comparison',
        sessions: sorted.map(r => ({
          sessionId: r.response.sessionId,
          label: r.label,
          raceName: r.response.raceName,
        })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load demo');
    } finally {
      setRMultiLoading(false);
    }
  }

  const anyLoading = singleLoading || multiLoading || rSingleLoading || rMultiLoading;

  return (
    <div className="home-page">

      {/* ── Welcome ── */}
      <section className="home-hero">
        <h1 className="home-hero-title">Race Director Analytics</h1>
        <p className="home-hero-subtitle">
          This project is a suite of data tools for race directors to perform deeper analytics
          on various race-related data. Upload various files from your registration and results
          hosting systems to explore demographics, registration trends, and year-over-year
          growth — with no personally identifiable information ever stored.
        </p>
      </section>

      {/* ── Analytics pitch ── */}
      <section className="home-analytics-pitch card">
        <p className="home-analytics-pitch-text">
          <strong className="home-analytics-pitch-lead">
            Numbers alone don't capture what makes a race meaningful — but analytics can
            surface the story behind them.
          </strong>{' '}
          Whether it's understanding why your finish rate dropped, who your participants
          really are, or how conditions shaped the day, the data your race already
          generates is full of insight waiting to be read.
        </p>
        <button
          type="button"
          className="btn home-analytics-pitch-btn"
          onClick={() => onNavigate('learn')}
        >
          Learn how analytics can help your race →
        </button>
      </section>

      {/* ── Demo launcher ── */}
      <section className="home-demo card">
        <h2 className="home-demo-title">Explore analytics with our sample data</h2>
        <p className="home-demo-desc">
          Explore the tools without uploading your own files. Choose a sample race below and
          launch the analysis instantly.
        </p>

        {/* ── Participant Analytics demos ── */}
        <div className="home-demo-tool-label">
          <span className="home-demo-tool-name">Registration Analytics</span>
        </div>

        <div className="home-demo-rows">
          <div className="demo-row">
            <span className="demo-row-label">Single-year analysis</span>
            <div className="demo-row-controls">
              <select
                className="demo-select"
                value={singleDemoIdx}
                onChange={e => setSingleDemoIdx(Number(e.target.value))}
                aria-label="Select sample race for single-year participant demo"
              >
                {SINGLE_DEMOS.map((d, i) => (
                  <option key={d.id} value={i}>{d.label}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary demo-btn"
                onClick={launchSingleDemo}
                disabled={anyLoading}
                aria-label="Launch single-year participant demo"
              >
                {singleLoading ? 'Loading…' : 'See demo →'}
              </button>
            </div>
          </div>

          <div className="demo-divider" aria-hidden="true" />

          <div className="demo-row">
            <span className="demo-row-label">Multi-year comparison</span>
            <div className="demo-row-controls">
              <select
                className="demo-select"
                value={multiDemoIdx}
                onChange={e => setMultiDemoIdx(Number(e.target.value))}
                aria-label="Select sample race series for multi-year participant demo"
              >
                {MULTI_DEMOS.map((d, i) => (
                  <option key={i} value={i}>{d.label}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary demo-btn"
                onClick={launchMultiDemo}
                disabled={anyLoading}
                aria-label="Launch multi-year participant demo"
              >
                {multiLoading ? 'Loading…' : 'See demo →'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Race Analytics demos ── */}
        <div className="home-demo-tool-label home-demo-tool-label--spaced">
          <span className="home-demo-tool-name">Race Analytics</span>
        </div>

        <div className="home-demo-rows">
          <div className="demo-row">
            <span className="demo-row-label">Single-year analysis</span>
            <div className="demo-row-controls">
              <select
                className="demo-select"
                value={rSingleDemoIdx}
                onChange={e => setRSingleDemoIdx(Number(e.target.value))}
                aria-label="Select sample race for single-year results demo"
              >
                {RESULTS_SINGLE_DEMOS.map((d, i) => (
                  <option key={d.id} value={i}>{d.label}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary demo-btn"
                onClick={launchResultsSingleDemo}
                disabled={anyLoading}
                aria-label="Launch single-year results demo"
              >
                {rSingleLoading ? 'Loading…' : 'See demo →'}
              </button>
            </div>
          </div>

          <div className="demo-divider" aria-hidden="true" />

          <div className="demo-row">
            <span className="demo-row-label">Multi-year comparison</span>
            <div className="demo-row-controls">
              <select
                className="demo-select"
                value={rMultiDemoIdx}
                onChange={e => setRMultiDemoIdx(Number(e.target.value))}
                aria-label="Select sample race series for multi-year results demo"
              >
                {RESULTS_MULTI_DEMOS.map((d, i) => (
                  <option key={i} value={i}>{d.label}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary demo-btn"
                onClick={launchResultsMultiDemo}
                disabled={anyLoading}
                aria-label="Launch multi-year results demo"
              >
                {rMultiLoading ? 'Loading…' : 'See demo →'}
              </button>
            </div>
          </div>
        </div>

        {error && <p className="demo-error" role="alert">{error}</p>}

        <p className="demo-note">
          Sample data is synthetic. Names and personal information are never real, and
          personal information in uploaded files is never read or analyzed — only
          aggregate statistics are computed and displayed.
        </p>
      </section>

      {/* ── Tool cards ── */}
      <section className="home-tools">
        <h2 className="home-tools-title">Available tools</h2>
        <div className="home-tools-grid">
          <ToolCard
            title="Registration Analytics"
            description="Upload UltraSignup exports to explore registration demographics, age and gender breakdowns, geographic reach, registration timing, coupon usage, and year-over-year comparisons."
            section="participants"
            available={true}
            onNavigate={onNavigate}
          />
          <ToolCard
            title="Race Analytics"
            description="Analyze finish times, DNF rates, pace distributions, attrition patterns, and weather correlations across one or multiple years of race results."
            section="results"
            available={true}
            onNavigate={onNavigate}
          />
        </div>
      </section>

    </div>
  );
}
