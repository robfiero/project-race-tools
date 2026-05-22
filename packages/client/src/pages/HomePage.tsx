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
  { id: 'pinecrest-5k-2024',         label: 'Pinecrest 5K — local registration demo, ~100 records',            year: '2024' },
  { id: 'white-mountains-2024',       label: 'White Mountains Challenge — multi-event registration demo, ~350 records', year: '2024' },
  { id: 'autumn-ridge-trail-festival-2024', label: 'Autumn Ridge Trail Festival — waitlist-focused registration demo, ~500 records', year: '2024' },
  { id: 'mountain-endurance-2024',    label: 'Mountain Endurance Challenge — large registration demo, ~850 records', year: '2024' },
];

const MULTI_DEMOS = [
  {
    label: 'White Mountains Challenge — registration trends, 2022–2024',
    years: [
      { id: 'white-mountains-2022', year: '2022' },
      { id: 'white-mountains-2023', year: '2023' },
      { id: 'white-mountains-2024', year: '2024' },
    ],
  },
  {
    label: 'Mountain Endurance Challenge — registration trends, 2022–2024',
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

// ─── Race Results demo data ───────────────────────────────────────────────────

const RESULTS_SINGLE_DEMOS = [
  { id: 'harbor-park-5k-results-2024',      label: 'Harbor Park 5K — single-event results demo, ~450 finishers', year: '2024' },
  { id: 'ghost-train-2024',                label: 'Ridgeline Trail Races — 25K + 50K results demo, ~150 starters',   year: '2024' },
  { id: 'white-mountains-results-2024',    label: 'White Mountains Challenge — HM + 50K results demo, ~240 starters',  year: '2024' },
  { id: 'mountain-endurance-results-2024', label: 'Mountain Endurance Challenge — 4-event results demo, ~650 starters', year: '2024' },
  { id: 'coyote-ridge-24hr-2024',          label: 'Coyote Ridge 24-Hour Endurance Run — fixed-time results demo, ~88 starters', year: '2024' },
];

const RESULTS_MULTI_DEMOS = [
  {
    label: 'Riverside Community 5K — race results, 2020–2024',
    years: [
      { id: 'riverside-5k-results-2020', year: '2020' },
      { id: 'riverside-5k-results-2021', year: '2021' },
      { id: 'riverside-5k-results-2022', year: '2022' },
      { id: 'riverside-5k-results-2023', year: '2023' },
      { id: 'riverside-5k-results-2024', year: '2024' },
    ],
  },
  {
    label: 'Foothill 6-Hour Challenge — fixed-time results, 2023–2024',
    years: [
      { id: 'foothill-6hr-results-2023', year: '2023' },
      { id: 'foothill-6hr-results-2024', year: '2024' },
    ],
  },
  {
    label: 'Ridgeline Trail Races — race results, 2022–2024',
    years: [
      { id: 'ghost-train-2022', year: '2022' },
      { id: 'ghost-train-2023', year: '2023' },
      { id: 'ghost-train-2024', year: '2024' },
    ],
  },
  {
    label: 'Mountain Endurance Challenge — race results, 2022–2024',
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
          adapterName: r.session.adapterName,
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
        <img
          className="home-hero-image"
          src="/home_page_hero_banner.svg"
          alt="Illustrated banner representing RaceOps race data analytics"
        />
        <h1 className="home-hero-title">Race Director Analytics</h1>
        <p className="home-hero-subtitle">
          RaceOps helps race directors turn registration and results CSV exports into
          deeper insight about registration patterns, participant geography, finish
          outcomes, and race-day conditions, without storing personally identifiable
          information.
        </p>
      </section>

      {/* ── Analytics pitch ── */}
      <section className="home-analytics-pitch card">
        <p className="home-analytics-pitch-text">
          <strong className="home-analytics-pitch-lead">
            Find the story behind the numbers.
          </strong>{' '}
          Explore registration timing, waitlist movement, travel distance, finish outcomes,
          pace or distance trends, and weather context from the data your race already has.
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
        <h2 className="home-demo-title">Try RaceOps with sample data</h2>
        <p className="home-demo-desc">
          Explore the tools without uploading your own files. Choose a sample dataset below and
          launch the analysis instantly.
        </p>
        <div className="home-demo-chips" aria-label="Analytics available in sample data">
          <span className="home-demo-chip">Registration timing</span>
          <span className="home-demo-chip">Waitlist behavior</span>
          <span className="home-demo-chip">Drops & coupons</span>
          <span className="home-demo-chip">Travel distance</span>
          <span className="home-demo-chip">Finish outcomes</span>
          <span className="home-demo-chip">Pace/distance trends</span>
          <span className="home-demo-chip">Weather context</span>
        </div>

        {/* ── Registration Analytics demos ── */}
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
                aria-label="Select sample dataset for single-year registration demo"
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
                aria-label="Launch single-year registration demo"
              >
                {singleLoading ? 'Loading…' : 'See demo →'}
              </button>
            </div>
          </div>

          <div className="demo-divider" aria-hidden="true" />

          <div className="demo-row">
            <span className="demo-row-label">Multi-year trend analysis</span>
            <div className="demo-row-controls">
              <select
                className="demo-select"
                value={multiDemoIdx}
                onChange={e => setMultiDemoIdx(Number(e.target.value))}
                aria-label="Select sample race series for multi-year registration demo"
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
                aria-label="Launch multi-year registration demo"
              >
                {multiLoading ? 'Loading…' : 'See demo →'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Race Results demos ── */}
        <div className="home-demo-tool-label home-demo-tool-label--spaced">
          <span className="home-demo-tool-name">Race Results</span>
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
            <span className="demo-row-label">Multi-year trend analysis</span>
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
    </div>
  );
}
