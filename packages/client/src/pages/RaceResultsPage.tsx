import {
  useState, useEffect, useRef, Fragment,
  type ChangeEvent, type DragEvent, type FormEvent,
} from 'react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { apiUrl } from '../api.ts';
import type {
  ResultsUploadResponse, ResultsStatsResponse, ResultsStats,
  ResultsSummaryStats, PerformanceStats, EventPerformanceStats, ResultsDemographicsStats,
  AttritionStats, ResultsCrossEventStats,
  ResultsComparisonStats, ResultsComparisonTrends, ResultsIntervalStats,
  TrendPoint, WeatherData,
} from '../types.ts';
import { useTheme } from '../ThemeContext.tsx';
import { chartPalette, genderColors } from '../chartColors.ts';
import SectionHeader from '../components/SectionHeader.tsx';
import GenderSection from '../components/GenderSection.tsx';
import AgeSection from '../components/AgeSection.tsx';
import GeographicSection from '../components/GeographicSection.tsx';
import StatCard from '../components/StatCard.tsx';
import InsightCallout from '../components/InsightCallout.tsx';
import WeatherSection from '../components/WeatherSection.tsx';
import { finishTimeInsights, attritionInsights, demographicsInsights } from '../insights.ts';
import IntervalComparisonPanel, {
  TrendCategorySelector,
  TrendLineChart,
  KeyChangesList,
  seriesDelta,
  fmtCountDelta,
  fmtPtsDelta,
  fmtTimeDelta,
  directionOf,
  type CategoryDef,
  type TrendSeries,
  type KeyChangeRow,
} from '../components/IntervalComparisonPanel.tsx';
import './RaceResultsPage.css';

// ─── Shared formatting helpers ────────────────────────────────────────────────

function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

// ─── Upload phase ─────────────────────────────────────────────────────────────

const MAX_ROWS = 5;
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 16 }, (_, i) => String(CURRENT_YEAR + 1 - i));

function detectYear(filename: string): string {
  const m = filename.match(/(?<!\d)(20\d{2})(?!\d)/);
  return m ? m[1] : '';
}

interface UploadRow {
  id: string;
  file: File | null;
  year: string;
  raceStart: string;
  raceDurationHours: string;
}

function makeRow(): UploadRow {
  return { id: crypto.randomUUID(), file: null, year: '', raceStart: '', raceDurationHours: '' };
}

function computeRaceEnd(raceStart: string, durationHours: string): string {
  if (!raceStart || !durationHours) return '';
  const hrs = parseFloat(durationHours);
  if (isNaN(hrs) || hrs <= 0) return '';
  const [datePart, timePart] = raceStart.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  const startDate = new Date(year, month - 1, day, hour, minute, 0);
  const endDate = new Date(startDate.getTime() + Math.round(hrs * 60) * 60 * 1000);
  const ey = endDate.getFullYear();
  const emo = String(endDate.getMonth() + 1).padStart(2, '0');
  const ed = String(endDate.getDate()).padStart(2, '0');
  const eh = String(endDate.getHours()).padStart(2, '0');
  const emi = String(endDate.getMinutes()).padStart(2, '0');
  return `${ey}-${emo}-${ed}T${eh}:${emi}`;
}

interface FileRowProps {
  row: UploadRow;
  index: number;
  required: boolean;
  dragging: boolean;
  fileInputRef: (el: HTMLInputElement | null) => void;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent<HTMLLabelElement>) => void;
  onClear: () => void;
  onYearChange: (year: string) => void;
  onStartChange: (v: string) => void;
  onDurationChange: (v: string) => void;
}

function FileRow({
  row, index, required, dragging,
  fileInputRef, onFileChange,
  onDragEnter, onDragLeave, onDrop, onClear, onYearChange,
  onStartChange, onDurationChange,
}: FileRowProps) {
  const inputId = `rr-file-${row.id}`;
  const yearId = `rr-year-${row.id}`;
  const startId = `rr-start-${row.id}`;
  const durId = `rr-dur-${row.id}`;

  return (
    <div className="file-row-group">
      <div className="file-row">
        <span
          className={`file-row-num${required ? ' file-row-num--required' : ' file-row-num--optional'}`}
          aria-label={required ? 'Required' : 'Optional'}
        >
          {index + 1}
        </span>

        <label
          htmlFor={inputId}
          className={[
            'file-row-zone',
            dragging ? 'file-row-zone--active' : '',
            row.file ? 'file-row-zone--has-file' : '',
          ].filter(Boolean).join(' ')}
          onDragOver={e => { e.preventDefault(); onDragEnter(); }}
          onDragLeave={onDragLeave}
          onDrop={e => { e.preventDefault(); onDrop(e); }}
        >
          <input
            id={inputId}
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={onFileChange}
            style={{ display: 'none' }}
            aria-label={`${required ? 'Required: ' : ''}Results file for row ${index + 1}`}
          />
          {row.file ? (
            <>
              <span className="file-row-checkmark" aria-hidden="true">✓</span>
              <span className="file-row-filename">{row.file.name}</span>
              <span className="file-row-size">{(row.file.size / 1024).toFixed(0)} KB</span>
            </>
          ) : (
            <>
              <span className="file-row-upload-icon" aria-hidden="true">↑</span>
              <span className="file-row-prompt">
                Drop file or <span className="file-row-browse-link">browse</span>
              </span>
              {required && <span className="file-row-required-badge">required</span>}
            </>
          )}
        </label>

        <select
          id={yearId}
          className="file-row-year"
          value={row.year}
          onChange={e => onYearChange(e.target.value)}
          aria-label={`Year for row ${index + 1}`}
        >
          <option value="">—</option>
          {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        {row.file ? (
          <button
            type="button"
            className="file-row-clear"
            onClick={e => { e.preventDefault(); onClear(); }}
            aria-label={`Clear file from row ${index + 1}`}
          >
            ×
          </button>
        ) : (
          <span className="file-row-clear-placeholder" aria-hidden="true" />
        )}
      </div>

      <div className="file-row-dates">
        <label htmlFor={startId} className="file-row-dates-label">Race start</label>
        <input
          id={startId}
          type="datetime-local"
          className={`file-row-datetime${row.raceStart ? '' : ' datetime-empty'}`}
          value={row.raceStart}
          onChange={e => onStartChange(e.target.value)}
          aria-label={`Race start date and time for row ${index + 1}`}
        />
        <label htmlFor={durId} className="file-row-dates-label">Duration</label>
        <input
          id={durId}
          type="number"
          className="file-row-duration"
          min="0.5"
          max="200"
          step="0.5"
          value={row.raceDurationHours}
          onChange={e => onDurationChange(e.target.value)}
          placeholder="—"
          aria-label={`Race duration in hours for row ${index + 1}`}
        />
        <span className="file-row-dates-unit">hrs</span>
      </div>
    </div>
  );
}

interface UploadPhaseProps {
  onComplete: (result: UploadResult) => void;
}

function UploadPhase({ onComplete }: UploadPhaseProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [rows, setRows] = useState<UploadRow[]>(() => [makeRow()]);
  const [raceName, setRaceName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  useEffect(() => { headingRef.current?.focus(); }, []);

  const filledRows = rows.filter(r => r.file !== null);
  const firstRowFilled = rows[0].file !== null;
  const canSubmit = firstRowFilled && !uploading;

  function handleFileSelect(rowId: string, file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (ext !== 'csv') {
      setError('Only CSV files are accepted. To use an Excel export, open it in Excel or Google Sheets and save as CSV.');
      return;
    }
    setError(null);
    const detectedYear = detectYear(file.name);
    setRows(prev => prev.map(r =>
      r.id === rowId ? { ...r, file, year: r.year || detectedYear } : r,
    ));
  }

  function clearRow(rowId: string) {
    setRows(prev => prev.map(r =>
      r.id === rowId ? { ...r, file: null, year: '', raceStart: '', raceDurationHours: '' } : r,
    ));
    const input = fileInputRefs.current.get(rowId);
    if (input) input.value = '';
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rows[0].file) return;
    setUploading(true);
    setError(null);

    const toUpload = filledRows;
    const uploads: Array<{ response: ResultsUploadResponse; label: string }> = [];

    for (let i = 0; i < toUpload.length; i++) {
      const row = toUpload[i];
      const formData = new FormData();
      formData.append('file', row.file!);
      if (raceName.trim()) formData.append('raceName', raceName.trim());
      if (venueAddress.trim()) formData.append('venueAddress', venueAddress.trim());
      if (row.raceStart.trim()) formData.append('raceStart', row.raceStart.trim());
      const raceEnd = computeRaceEnd(row.raceStart, row.raceDurationHours);
      if (raceEnd) formData.append('raceEnd', raceEnd);

      try {
        const res = await fetch(apiUrl('/api/results/upload'), { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) {
          const suffix = toUpload.length > 1
            ? ` (${row.year || row.file!.name.replace(/\.(csv|xlsx)$/i, '')})`
            : '';
          setError((data.error ?? 'Upload failed.') + suffix);
          setUploading(false);
          return;
        }
        const label = row.year || row.file!.name.replace(/\.(csv|xlsx)$/i, '');
        uploads.push({ response: data as ResultsUploadResponse, label });
      } catch {
        setError('Could not reach the server. Make sure it is running.');
        setUploading(false);
        return;
      }
    }

    if (uploads.length === 1) {
      onComplete({ mode: 'single', upload: uploads[0].response, label: uploads[0].label });
    } else {
      // Sort by year label ascending
      const sorted = [...uploads].sort((a, b) => {
        const ya = parseInt(a.label, 10);
        const yb = parseInt(b.label, 10);
        if (!isNaN(ya) && !isNaN(yb)) return ya - yb;
        return a.label.localeCompare(b.label);
      });
      onComplete({
        mode: 'comparison',
        sessions: sorted.map(u => ({
          sessionId: u.response.sessionId,
          label: u.label,
          raceName: u.response.raceName,
        })),
      });
    }
  }

  const submitLabel = uploading
    ? (filledRows.length > 1 ? `Uploading ${filledRows.length} files…` : 'Analyzing…')
    : (filledRows.length >= 2 ? `Compare ${filledRows.length} years` : 'Analyze race data');

  return (
    <div className="rr-upload-page">
      <div className="rr-upload-intro">
        <h1 ref={headingRef} tabIndex={-1}>Race Analytics</h1>
        <p>
          Upload race results exports from your timing platform. Personal information
          in uploaded files is never read or analyzed — only aggregate statistics are
          computed and displayed.
        </p>
        <p className="rr-upload-supported">
          Supported platforms: <strong>UltraSignup</strong> &nbsp;·&nbsp; More coming soon
          &nbsp;·&nbsp; Format: <strong>CSV</strong>
        </p>
        <p className="rr-upload-format-note">
          <strong>Note:</strong> Your results file must include the required UltraSignup column headers.
        </p>
        <p className="rr-upload-format-links">
          <a
            href="https://help.ultrasignup.com/hc/en-us/articles/30339325435917-How-to-Format-Race-Result-Files"
            target="_blank"
            rel="noopener noreferrer"
            className="rr-upload-format-link"
          >
            Formatting requirements<span className="sr-only"> (opens in new tab)</span> ↗
          </a>
          <span className="rr-upload-format-sep" aria-hidden="true">·</span>
          <a
            href="/ultrasignup-results-template.csv"
            download
            className="rr-upload-format-link"
          >
            Download CSV template
          </a>
        </p>
        <p className="rr-upload-format-hint">
          If you don't have the original export file, results data that you have legitimate
          access to can be copied into the CSV template manually.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* ── Shared fields ── */}
        <div className="upload-shared card">
          <div className="upload-field">
            <label htmlFor="rr-race-name">
              Race name <span className="optional">(optional)</span>
            </label>
            <input
              id="rr-race-name"
              type="text"
              placeholder="e.g. Ridgeline Trail Races"
              value={raceName}
              onChange={e => setRaceName(e.target.value)}
            />
          </div>
          <div className="upload-field">
            <label htmlFor="rr-venue-address">
              Venue address <span className="optional">(optional)</span>
            </label>
            <input
              id="rr-venue-address"
              type="text"
              placeholder="e.g. 1 Mason Road, Brookline, NH 03033"
              value={venueAddress}
              onChange={e => setVenueAddress(e.target.value)}
            />
            <p className="upload-hint">
              <span className="info-icon" aria-hidden="true">i</span>
              Enables weather conditions in the analysis. Geocoded once at upload
              and never stored with results data.
            </p>
          </div>
        </div>

        {/* ── File rows ── */}
        <div className="upload-files card">
          <div className="upload-files-col-header" aria-hidden="true">
            <span />
            <span>
              File
              <span className="upload-files-hint-inline"> · up to 10,000 results · 5 MB each</span>
            </span>
            <span>Year</span>
            <span />
          </div>
          <p className="upload-files-dates-hint">
            Race start and duration are optional — include them to add weather conditions to the analysis.
          </p>

          {rows.map((row, i) => (
            <FileRow
              key={row.id}
              row={row}
              index={i}
              required={i === 0}
              dragging={draggingRowId === row.id}
              fileInputRef={el => {
                if (el) fileInputRefs.current.set(row.id, el);
                else fileInputRefs.current.delete(row.id);
              }}
              onFileChange={e => {
                if (e.target.files?.[0]) handleFileSelect(row.id, e.target.files[0]);
              }}
              onDragEnter={() => setDraggingRowId(row.id)}
              onDragLeave={() => setDraggingRowId(null)}
              onDrop={e => {
                setDraggingRowId(null);
                const f = e.dataTransfer.files[0];
                if (f) handleFileSelect(row.id, f);
              }}
              onClear={() => clearRow(row.id)}
              onYearChange={year => setRows(prev =>
                prev.map(r => r.id === row.id ? { ...r, year } : r),
              )}
              onStartChange={v => setRows(prev =>
                prev.map(r => r.id === row.id ? { ...r, raceStart: v } : r),
              )}
              onDurationChange={v => setRows(prev =>
                prev.map(r => r.id === row.id ? { ...r, raceDurationHours: v } : r),
              )}
            />
          ))}

          <div className="upload-files-add-row">
            {rows.length < MAX_ROWS && (
              <button
                type="button"
                className="btn upload-add-year-btn"
                onClick={() => setRows(prev => [...prev, makeRow()])}
                disabled={!firstRowFilled}
                title={!firstRowFilled ? 'Add at least one results file to continue.' : undefined}
              >
                + Add another year
              </button>
            )}
          </div>

          <p className="upload-files-footer-hint">
            Upload one file for a single-year analysis, or multiple files (same
            race, different years) for year-over-year comparison. Year is
            auto-detected from the filename when available.
          </p>
        </div>

        {error && <p className="rr-upload-error" role="alert">{error}</p>}

        <button
          type="submit"
          className="btn btn-primary upload-submit"
          disabled={!canSubmit}
        >
          {submitLabel}
        </button>
      </form>
    </div>
  );
}

// ─── Shared stat sections (used in both single and comparison detail tabs) ────

function formatRaceDatetime(iso: string): { date: string; time: string } {
  const [datePart, timePart] = iso.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  const d = new Date(year, month - 1, day);
  const date = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const time = `${h12}:${String(minute).padStart(2, '0')} ${ampm}`;
  return { date, time };
}

function SummarySection({ summary, weather, performance, raceName }: { summary: ResultsSummaryStats; weather?: WeatherData; performance?: PerformanceStats; raceName?: string }) {
  const start = weather?.raceStartIso ? formatRaceDatetime(weather.raceStartIso) : null;
  const end   = weather?.raceEndIso   ? formatRaceDatetime(weather.raceEndIso)   : null;

  return (
    <section className="chart-section" aria-labelledby="rr-summary-heading">
      <SectionHeader title={raceName ? `Summary — ${raceName}` : 'Summary'} />

      {(start || end) && (
        <div className="rr-race-dates">
          {start && (
            <div className="rr-race-date-item">
              <span className="rr-race-date-label">Race start</span>
              <span className="rr-race-date-value">{start.date}</span>
              <span className="rr-race-date-time">{start.time}</span>
            </div>
          )}
          {end && (
            <div className="rr-race-date-item">
              <span className="rr-race-date-label">Race end</span>
              <span className="rr-race-date-value">{end.date}</span>
              <span className="rr-race-date-time">{end.time}</span>
            </div>
          )}
        </div>
      )}

      <div className="summary-cards">
        <StatCard label="Total Entrants" value={summary.totalEntrants.toLocaleString()} />
        <StatCard
          label="Finishers"
          value={summary.finishers.toLocaleString()}
          sub={`${fmtPct(summary.finishRate)} finish rate`}
        />
        <StatCard
          label="DNF"
          value={summary.dnf.toLocaleString()}
          sub={`${fmtPct(summary.dnfRate)} of starters`}
        />
        <StatCard label="DNS" value={summary.dns.toLocaleString()} />
      </div>

      {summary.events.length > 1 && (
        <div className="rr-event-summary-grid">
          {summary.events.map(ev => (
            <div key={ev.name} className="rr-event-card card">
              <div className="rr-event-card-name">{ev.name}</div>
              <div className="rr-event-card-stats">
                <span><strong>{ev.finishers}</strong> finishers</span>
                <span>{fmtPct(ev.finishRate)} finish rate</span>
                <span>{ev.dnf} DNF · {ev.dns} DNS</span>
              </div>
              {ev.courseRecord && (
                <div className="rr-event-record">
                  <span className="rr-event-record-label">Fastest time</span>
                  <span className="rr-event-record-value">{ev.courseRecord.display}</span>
                </div>
              )}
              {ev.lastFinisher && (
                <div className="rr-event-record rr-event-record--last">
                  <span className="rr-event-record-label">Last finisher</span>
                  <span className="rr-event-record-value">{ev.lastFinisher.display}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {summary.events.length === 1 && (() => {
        const ev = summary.events[0];
        const GENDER_NAME: Record<string, string> = { M: 'Male', F: 'Female', NB: 'Non-Binary' };
        const byGender = (performance?.events[0]?.finishTime?.byGender ?? [])
          .filter(g => g.fastestSeconds != null && g.gender !== 'Unknown')
          .sort((a, b) => (a.fastestSeconds ?? Infinity) - (b.fastestSeconds ?? Infinity));
        const hasFastest = ev.courseRecord || byGender.length > 0;
        return (
          <div className="rr-records-block">
            {hasFastest && (
              <div className="rr-record-group">
                <span className="rr-record-group-label">Fastest Times</span>
                <div className="rr-record-group-items">
                  {ev.courseRecord && (
                    <span className="rr-record-group-item">
                      <span className="rr-record-group-gender">Overall</span>
                      <span className="rr-record-group-time">{ev.courseRecord.display}</span>
                    </span>
                  )}
                  {byGender.map(g => (
                    <span key={g.gender} className="rr-record-group-item">
                      <span className="rr-record-group-gender">{GENDER_NAME[g.gender] ?? g.gender}</span>
                      <span className="rr-record-group-time">{fmtTime(g.fastestSeconds!)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {ev.lastFinisher && (
              <div className="rr-record-group">
                <span className="rr-record-group-label">Last Finisher</span>
                <div className="rr-record-group-items">
                  <span className="rr-record-group-item">
                    <span className="rr-record-group-gender">Overall</span>
                    <span className="rr-record-group-time">{ev.lastFinisher.display}</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </section>
  );
}

function PerformancePanel({ perf }: { perf: EventPerformanceStats }) {
  const { theme } = useTheme();
  const gc = genderColors(theme);
  const ft = perf.finishTime;
  const da = perf.distanceAchieved;
  const buckets = ft?.buckets ?? da?.buckets ?? [];
  const chartData = buckets.map(b => ({ label: b.label, Male: b.male, Female: b.female, 'Non-Binary': b.nonBinary }));

  return (
    <div className="rr-perf-panel">
      {perf.eventType === 'fixed-distance' && ft ? (
        <div className="rr-perf-summary">
          <div className="rr-perf-stat">
            <span className="rr-perf-stat-label">Median time</span>
            <span className="rr-perf-stat-value">{fmtTime(ft.medianSeconds)}</span>
          </div>
          <div className="rr-perf-stat">
            <span className="rr-perf-stat-label">Mean time</span>
            <span className="rr-perf-stat-value">{fmtTime(ft.meanSeconds)}</span>
          </div>
          <div className="rr-perf-stat">
            <span className="rr-perf-stat-label">Fastest</span>
            <span className="rr-perf-stat-value">{fmtTime(ft.fastestSeconds)}</span>
          </div>
          <div className="rr-perf-stat">
            <span className="rr-perf-stat-label">Last</span>
            <span className="rr-perf-stat-value">{fmtTime(ft.slowestSeconds)}</span>
          </div>
        </div>
      ) : da ? (
        <div className="rr-perf-summary">
          <div className="rr-perf-stat">
            <span className="rr-perf-stat-label">Median distance</span>
            <span className="rr-perf-stat-value">{da.medianMiles.toFixed(1)} mi</span>
          </div>
          <div className="rr-perf-stat">
            <span className="rr-perf-stat-label">Mean distance</span>
            <span className="rr-perf-stat-value">{da.meanMiles.toFixed(1)} mi</span>
          </div>
          <div className="rr-perf-stat">
            <span className="rr-perf-stat-label">Farthest</span>
            <span className="rr-perf-stat-value">{da.maxMiles.toFixed(1)} mi</span>
          </div>
        </div>
      ) : null}

      {(ft || da) && (
        <div className="rr-percentile-block">
          <span className="rr-percentile-heading">
            {ft ? 'Finish time percentiles' : 'Distance percentiles'}
          </span>
          <div className="rr-percentile-row">
            {ft && ft.percentiles.map(p => (
              <div key={p.label} className="rr-percentile-cell">
                <span className="rr-percentile-label">{p.label}</span>
                <span className="rr-percentile-value">{fmtTime(p.seconds)}</span>
              </div>
            ))}
            {da && da.percentiles.map(p => (
              <div key={p.label} className="rr-percentile-cell">
                <span className="rr-percentile-label">{p.label}</span>
                <span className="rr-percentile-value">{p.miles.toFixed(1)} mi</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {chartData.length > 0 && (
        <div className="rr-perf-chart">
          <p className="rr-perf-chart-label">
            {ft
              ? 'Finishers per time range — each bar represents an equal-width slice of the total finish-time span, stacked by gender'
              : 'Finishers per distance range — each bar represents an equal-width slice of the distance spread, stacked by gender'}
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 64, left: 32 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" interval={0} />
              <YAxis
                tick={{ fontSize: 11 }}
                allowDecimals={false}
                label={{ value: 'Finishers', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: '0.72rem', fill: '#888' } }}
              />
              <Tooltip contentStyle={{ fontSize: '0.8rem' }} />
              <Legend verticalAlign="top" iconType="square" wrapperStyle={{ fontSize: '0.8rem', paddingBottom: '0.5rem' }} />
              <Bar dataKey="Male" stackId="a" fill={gc.M} />
              <Bar dataKey="Female" stackId="a" fill={gc.F} />
              <Bar dataKey="Non-Binary" stackId="a" fill={gc.NB} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {ft && ft.byGender.length > 0 && (
        <table className="stats-table rr-gender-time-table">
          <caption className="sr-only">Finish time by gender</caption>
          <thead>
            <tr><th>Gender</th><th>Finishers</th><th>Median</th><th>Fastest</th><th>Last finisher</th></tr>
          </thead>
          <tbody>
            {ft.byGender.map(row => (
              <tr key={row.gender}>
                <td>{row.gender}</td>
                <td>{row.finishers}</td>
                <td>{row.medianSeconds != null ? fmtTime(row.medianSeconds) : '—'}</td>
                <td>{row.fastestSeconds != null ? fmtTime(row.fastestSeconds) : '—'}</td>
                <td>{row.slowestSeconds != null ? fmtTime(row.slowestSeconds) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {da && da.byGender.length > 0 && (
        <table className="stats-table rr-gender-time-table">
          <caption className="sr-only">Distance achieved by gender</caption>
          <thead>
            <tr><th>Gender</th><th>Finishers</th><th>Median distance</th><th>Farthest</th></tr>
          </thead>
          <tbody>
            {da.byGender.map(row => (
              <tr key={row.gender}>
                <td>{row.gender}</td>
                <td>{row.finishers}</td>
                <td>{row.medianMiles != null ? row.medianMiles.toFixed(1) + ' mi' : '—'}</td>
                <td>{row.maxMiles != null ? row.maxMiles.toFixed(1) + ' mi' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PerformanceSection({ events }: { events: EventPerformanceStats[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  if (events.length === 0) return null;

  const isFixedDist = events[activeIdx]?.eventType === 'fixed-distance';
  const insights = finishTimeInsights(events);

  return (
    <section className="chart-section" aria-labelledby="rr-perf-heading">
      <SectionHeader title="Finish Time Distribution" />
      <p className="rr-perf-intro">
        {isFixedDist
          ? 'Finish time statistics for finishers. Percentiles show the exact time at each threshold — e.g. the 90th percentile is the time by which 90% of finishers had crossed the line. The chart groups finishers into equal time ranges to show the overall distribution.'
          : 'Distance statistics for finishers in this fixed-time event. Percentiles show the distance at each threshold — e.g. the 90th percentile is the distance exceeded by only 10% of finishers. The chart groups finishers into equal distance ranges to show the spread of results.'}
      </p>
      <InsightCallout insights={insights} />
      {events.length > 1 && (
        <div className="rr-perf-tabs" role="tablist">
          {events.map((ev, i) => (
            <button
              key={ev.eventName}
              role="tab"
              aria-selected={i === activeIdx}
              className={`rr-perf-tab${i === activeIdx ? ' rr-perf-tab--active' : ''}`}
              onClick={() => setActiveIdx(i)}
            >
              {ev.eventName}
            </button>
          ))}
        </div>
      )}
      <PerformancePanel perf={events[activeIdx]} />
    </section>
  );
}

function AttritionSection({ attrition, multiEvent }: { attrition: AttritionStats; multiEvent: boolean }) {
  const { theme } = useTheme();
  // When multi-event, per-event rows are already shown in Event Comparison — show only overall + gender here
  const rows = multiEvent
    ? [attrition.overall, ...attrition.byGender]
    : [attrition.overall, ...attrition.byEvent, ...attrition.byGender];
  const chartRows = rows.filter(r => r.total > 0);
  const chartData = chartRows.map(r => ({ name: r.name, finished: r.finished, dnf: r.dnf, dns: r.dns }));
  const colors = chartPalette(theme, 3);
  const insights = attritionInsights(attrition);

  return (
    <section className="chart-section" aria-labelledby="rr-attrition-heading">
      <SectionHeader title="Completion Rates" />
      <InsightCallout insights={insights} />
      <table className="stats-table">
        <caption className="sr-only">Finish, DNF, and DNS counts by group</caption>
        <thead>
          <tr>
            <th>Group</th><th>Total</th><th>Finished</th><th>Finish %</th>
            <th>DNF</th><th>DNF %</th><th>DNS</th><th>DNS %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.name} className={r.name === 'Overall' ? 'rr-attrition-overall' : ''}>
              <td>{r.name}</td>
              <td>{r.total > 0 ? r.total : '—'}</td>
              <td>{r.total > 0 ? r.finished : '—'}</td>
              <td>{r.total > 0 ? fmtPct(r.finishRate) : '—'}</td>
              <td>{r.total > 0 ? r.dnf : '—'}</td>
              <td>{r.total > 0 && r.dnfRate > 0 ? fmtPct(r.dnfRate) : '—'}</td>
              <td>{r.total > 0 ? r.dns : '—'}</td>
              <td>{r.total > 0 && r.dnsRate > 0 ? fmtPct(r.dnsRate) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {chartData.length > 1 && (
        <div className="rr-attrition-chart" role="img" aria-label="Attrition breakdown chart">
          <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 36) + 30}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
              <Tooltip contentStyle={{ fontSize: '0.8rem' }} />
              <Legend verticalAlign="top" iconType="square" wrapperStyle={{ fontSize: '0.8rem' }} />
              <Bar dataKey="finished" name="Finished" stackId="a" fill={colors[0]} />
              <Bar dataKey="dnf" name="DNF" stackId="a" fill={colors[1]} />
              <Bar dataKey="dns" name="DNS" stackId="a" fill={colors[2]} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function CrossEventSection({ crossEvent, attrition }: { crossEvent: ResultsCrossEventStats; attrition: AttritionStats }) {
  if (crossEvent.rows.length === 0) return null;

  // Build a lookup of DNF/DNS counts from attrition.byEvent, keyed by event name
  const attritionByEvent = new Map(attrition.byEvent.map(r => [r.name, r]));

  return (
    <section className="chart-section" aria-labelledby="rr-cross-heading">
      <SectionHeader title="Event Comparison" />
      <div className="cmp-table-scroll">
        <table className="stats-table cmp-table">
          <caption className="sr-only">Side-by-side comparison across events</caption>
          <thead>
            <tr>
              <th>Event</th><th>Entrants</th><th>Finishers</th><th>Finish %</th>
              <th>DNF</th><th>DNF %</th><th>DNS</th>
              <th>Male %</th><th>Female %</th><th>Non-Binary %</th><th>Avg Age</th>
            </tr>
          </thead>
          <tbody>
            {crossEvent.rows.map(row => {
              const atr = attritionByEvent.get(row.name);
              return (
                <tr key={row.name}>
                  <td style={{ fontWeight: 600 }}>{row.name}</td>
                  <td>{row.totalEntrants}</td>
                  <td>{row.finishers}</td>
                  <td>{fmtPct(row.finishRate)}</td>
                  <td>{atr && atr.dnf > 0 ? atr.dnf : '—'}</td>
                  <td>{atr && atr.dnfRate > 0 ? fmtPct(atr.dnfRate) : '—'}</td>
                  <td>{atr && atr.dns > 0 ? atr.dns : '—'}</td>
                  <td>{row.maleFinishers > 0 ? fmtPct(row.malePercent) : '—'}</td>
                  <td>{row.femaleFinishers > 0 ? fmtPct(row.femalePercent) : '—'}</td>
                  <td>{row.nonBinaryFinishers > 0 ? fmtPct(row.nonBinaryPercent) : '—'}</td>
                  <td>{row.avgAge != null ? row.avgAge.toFixed(1) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FullStatsSections({ stats, weather, raceName }: { stats: ResultsStats; weather?: WeatherData; raceName?: string }) {
  const demoInsights = demographicsInsights(stats.demographics);
  return (
    <>
      <div id="rr-summary"><SummarySection summary={stats.summary} weather={weather} performance={stats.performance} raceName={raceName} /></div>
      {weather && <div id="rr-weather"><WeatherSection weather={weather} /></div>}
      <div id="rr-performance"><PerformanceSection events={stats.performance.events} /></div>
      <div id="rr-cross-event"><CrossEventSection crossEvent={stats.crossEvent} attrition={stats.attrition} /></div>
      <div id="rr-attrition"><AttritionSection attrition={stats.attrition} multiEvent={stats.crossEvent.rows.length > 0} /></div>
      <div id="rr-gender"><GenderSection stats={stats.demographics.finisherGender} /></div>
      <div id="rr-age"><AgeSection stats={stats.demographics.finisherAge} additionalInsights={demoInsights} /></div>
      <div id="rr-geography"><GeographicSection stats={stats.geographic} /></div>
    </>
  );
}

// ─── Single-year dashboard ────────────────────────────────────────────────────

interface SingleDashboardProps {
  upload: ResultsUploadResponse;
  label: string;
  onBack: () => void;
}

function SingleDashboard({ upload, label, onBack }: SingleDashboardProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [data, setData] = useState<ResultsStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(apiUrl(`/api/results/stats/${upload.sessionId}`));
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? 'Failed to load statistics.'); return; }
        setData(json as ResultsStatsResponse);
      } catch {
        setError('Could not reach the server.');
      } finally {
        setLoading(false);
      }
    })();
  }, [upload.sessionId]);

  useEffect(() => { headingRef.current?.focus(); }, []);

  return (
    <div className="rr-dashboard">
      <div className="dashboard-header">
        <div className="dashboard-header-left">
          <button type="button" className="btn-ghost dashboard-back no-print" onClick={onBack}>
            ← New analysis
          </button>
          <h1 ref={headingRef} tabIndex={-1} className="dashboard-title">
            {upload.raceName} — Results Analysis{/^\d{4}$/.test(label) && ` ${label}`}
          </h1>
          <dl className="dashboard-meta">
            <div className="dashboard-meta-row">
              <dt>Results</dt>
              <dd>{upload.resultCount.toLocaleString()} records</dd>
            </div>
            <div className="dashboard-meta-row">
              <dt>Format</dt>
              <dd>{upload.adapterName}</dd>
            </div>
          </dl>
        </div>
        <button type="button" className="btn btn-primary no-print"
          onClick={() => window.print()} aria-label="Save analysis as PDF">
          Save as PDF
        </button>
      </div>

      {loading && <div className="dashboard-loading" role="status" aria-live="polite" aria-busy="true">Loading statistics…</div>}
      {error && <div className="dashboard-error" role="alert">{error}</div>}

      {data?.stats && !loading && (
        <>
          <nav className="report-nav no-print" aria-label="Jump to section">
            <a href="#rr-summary" className="report-nav-link">Summary</a>
            {data.weatherData && <a href="#rr-weather" className="report-nav-link">Weather</a>}
            <a href="#rr-performance" className="report-nav-link">Finish Time Distribution</a>
            <a href="#rr-cross-event" className="report-nav-link">Event Comparison</a>
            <a href="#rr-attrition" className="report-nav-link">Completion Rates</a>
            <a href="#rr-gender" className="report-nav-link">Gender Distribution</a>
            <a href="#rr-age" className="report-nav-link">Age Distribution</a>
            <a href="#rr-geography" className="report-nav-link">Geographic Distribution</a>
          </nav>
          <div className="rr-dashboard-sections">
            <FullStatsSections stats={data.stats} weather={data.weatherData as WeatherData | undefined} />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Multi-year trend card ────────────────────────────────────────────────────

interface ResultsTrendCardProps {
  title: string;
  data: TrendPoint[];
  unit?: string;
  precision?: number;
  formatValue?: (v: number) => string;
  deltaInvert?: boolean;
}

function ResultsTrendCard({
  title, data, unit = '', precision = 1, formatValue, deltaInvert = false,
}: ResultsTrendCardProps) {
  const { theme } = useTheme();
  if (data.length === 0) return null;

  const current = data[data.length - 1].value;
  const first = data[0].value;
  const delta = current !== null && first !== null ? current - first : null;

  let deltaClass = 'trend-card-delta--neutral';
  let deltaSign = '';
  if (delta !== null && Math.abs(delta) >= 0.05) {
    const positive = delta > 0;
    const good = deltaInvert ? !positive : positive;
    deltaClass = good ? 'trend-card-delta--good' : 'trend-card-delta--bad';
    deltaSign = positive ? '+' : '';
  }

  function display(v: number | null): string {
    if (v === null) return '—';
    if (formatValue) return formatValue(v);
    return precision === 0 ? String(Math.round(v)) : v.toFixed(precision);
  }

  const chartData = data.map(d => ({ label: d.label, value: d.value ?? 0 }));
  const colors = chartPalette(theme, chartData.length);

  return (
    <div className="trend-card card">
      <div className="trend-card-header">
        <span className="trend-card-title">{title}</span>
        {delta !== null && (
          <span className={`trend-card-delta ${deltaClass}`}>
            {deltaSign}{display(delta)}{unit} overall
          </span>
        )}
      </div>
      <div className="trend-card-value">{display(current)}{unit}</div>
      <div className="trend-card-chart" role="img" aria-label={`${title} trend`}>
        <ResponsiveContainer width="100%" height={70}>
          <BarChart data={chartData} margin={{ top: 2, right: 4, bottom: 0, left: 4 }}>
            <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis hide domain={[0, 'auto']} />
            <Tooltip formatter={(v: number) => [display(v), title]} contentStyle={{ fontSize: '0.8rem' }} />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={colors[i]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Interval comparison table ───────────────────────────────────────────────

function deltaClass(current: number | null, first: number | null, invert = false, neutral = false): string {
  if (current === null || first === null) return '';
  const d = current - first;
  if (neutral || Math.abs(d) < 0.05) return 'cmp-cell--neutral';
  const good = invert ? d < 0 : d > 0;
  return good ? 'cmp-cell--good' : 'cmp-cell--bad';
}

function fmtVal(v: number | null, unit = '', precision = 1): string {
  if (v === null) return '—';
  return `${precision === 0 ? Math.round(v) : v.toFixed(precision)}${unit}`;
}

interface ICRow {
  label: string;
  values: (number | null)[];
  fmt: (v: number | null) => string;
  deltaInvert?: boolean;
  skip?: boolean;
  sub?: boolean;
  neutral?: boolean;
}

interface ICGroup {
  parent: ICRow;
  subs: ICRow[];
}

// ─── Race trend lines ─────────────────────────────────────────────────────────

type RCategory = 'participation' | 'attrition' | 'times' | 'demographics' | 'geography';

const R_CATEGORIES_FIXED_DIST: CategoryDef[] = [
  { id: 'participation',  label: 'Participation' },
  { id: 'attrition',     label: 'Attrition' },
  { id: 'times',         label: 'Finish Times' },
  { id: 'demographics',  label: 'Demographics' },
  { id: 'geography',     label: 'Geography' },
];

const R_CATEGORIES_FIXED_TIME: CategoryDef[] = [
  { id: 'participation', label: 'Participation' },
  { id: 'attrition',     label: 'Attrition' },
  { id: 'demographics',  label: 'Demographics' },
  { id: 'geography',     label: 'Geography' },
];

interface RaceTrendLinesProps {
  trends: ResultsComparisonTrends;
  intervals: ResultsIntervalStats[];
  isFixedDist: boolean;
}

function RaceTrendLines({ trends, intervals, isFixedDist }: RaceTrendLinesProps) {
  const [cat, setCat] = useState<RCategory>('participation');

  const labels = intervals.map(iv => iv.label);

  function derivedSeries(name: string, fn: (iv: ResultsIntervalStats) => number | null): TrendSeries {
    return { name, data: intervals.map(iv => ({ label: iv.label, value: fn(iv) })) };
  }

  const seriesMap: Partial<Record<RCategory, TrendSeries[]>> = {
    participation: [
      { name: 'Total Entrants', data: trends.totalEntrants },
      { name: 'Finishers',      data: trends.finishers },
    ],
    attrition: [
      { name: 'Finish Rate %', data: trends.finishRate },
      { name: 'DNF Rate %',    data: trends.dnfRate },
      derivedSeries('DNS Rate %', iv => iv.stats.attrition.overall.dnsRate),
    ],
    times: isFixedDist ? [
      { name: 'Median Finish Time', data: trends.medianFinishTimeSeconds },
    ] : [],
    demographics: [
      { name: 'Female Finishers %',     data: trends.femaleFinisherPercent },
      derivedSeries('Male Finishers %', iv => iv.stats.demographics.finisherGender.malePercent),
      { name: 'Median Finisher Age',    data: trends.medianFinisherAge },
    ],
    geography: [
      derivedSeries('States / Provinces', iv => Object.keys(iv.stats.geographic.byState).length),
      derivedSeries('Countries',          iv => Object.keys(iv.stats.geographic.byCountry).length),
    ],
  };

  const activeCats = isFixedDist ? R_CATEGORIES_FIXED_DIST : R_CATEGORIES_FIXED_TIME;
  const effectiveCat: RCategory = (isFixedDist || cat !== 'times') ? cat : 'participation';

  const formatY = (c: RCategory): ((v: number) => string) | undefined => {
    if (c === 'participation') return (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v));
    return undefined;
  };

  const formatTooltip = (c: RCategory): ((v: number, name: string) => string) | undefined => {
    if (c === 'times') return (v) => fmtTime(Math.round(v));
    if (c === 'demographics') return (v, name) => name.includes('Age') ? `${v.toFixed(1)} yrs` : `${v.toFixed(1)}%`;
    return undefined;
  };

  const activeSeries = seriesMap[effectiveCat] ?? [];

  return (
    <>
      <TrendCategorySelector
        categories={activeCats}
        active={effectiveCat}
        onChange={id => setCat(id as RCategory)}
      />
      <TrendLineChart
        series={activeSeries}
        formatY={formatY(effectiveCat)}
        formatTooltipValue={formatTooltip(effectiveCat)}
        yUnit={effectiveCat === 'attrition' ? '%' : ''}
        emptyMessage={effectiveCat === 'geography' ? 'Geographic data did not change across the compared intervals.' : undefined}
      />
      {/* show Y axis note for finish times — values are raw seconds */}
      {effectiveCat === 'times' && labels.length > 0 && (
        <p className="trend-line-empty" style={{ marginTop: '0.25rem' }}>
          Y axis shows finish time in seconds. Tooltip displays formatted time.
        </p>
      )}
    </>
  );
}

// ─── Race key changes ─────────────────────────────────────────────────────────

interface RaceKeyChangesProps {
  trends: ResultsComparisonTrends;
  intervals: ResultsIntervalStats[];
  isFixedDist: boolean;
}

function RaceKeyChanges({ trends, intervals, isFixedDist }: RaceKeyChangesProps) {
  if (intervals.length < 2) return <p className="trend-line-empty">Need at least two intervals to show key changes.</p>;

  const firstLabel = intervals[0].label;
  const lastLabel  = intervals[intervals.length - 1].label;

  function derived(fn: (iv: ResultsIntervalStats) => number | null): Array<{ label: string; value: number | null }> {
    return intervals.map(iv => ({ label: iv.label, value: fn(iv) }));
  }

  const dnsRateData   = derived(iv => iv.stats.attrition.overall.dnsRate);
  const maleFinPctData = derived(iv => iv.stats.demographics.finisherGender.malePercent);

  const rows: KeyChangeRow[] = [
    {
      label: 'Total Entrants',
      formattedDelta: fmtCountDelta(seriesDelta(trends.totalEntrants)),
      direction: directionOf(seriesDelta(trends.totalEntrants), 0.5),
      neutral: false,
    },
    {
      label: 'Finishers',
      formattedDelta: fmtCountDelta(seriesDelta(trends.finishers)),
      direction: directionOf(seriesDelta(trends.finishers), 0.5),
      neutral: false,
    },
    {
      label: 'Finish Rate',
      formattedDelta: fmtPtsDelta(seriesDelta(trends.finishRate)),
      direction: directionOf(seriesDelta(trends.finishRate), 0.05),
      neutral: false,
    },
    {
      label: 'DNF Rate',
      formattedDelta: fmtPtsDelta(seriesDelta(trends.dnfRate)),
      direction: directionOf(seriesDelta(trends.dnfRate), 0.05, true),
      neutral: false,
    },
    {
      label: 'DNS Rate',
      formattedDelta: fmtPtsDelta(seriesDelta(dnsRateData)),
      direction: directionOf(seriesDelta(dnsRateData), 0.05, true),
      neutral: false,
    },
    ...(isFixedDist ? [{
      label: 'Median Finish Time',
      formattedDelta: fmtTimeDelta(seriesDelta(trends.medianFinishTimeSeconds)),
      direction: directionOf(seriesDelta(trends.medianFinishTimeSeconds), 30, true) as KeyChangeRow['direction'],
      neutral: false,
    }] : []),
    {
      label: 'Female Finishers %',
      formattedDelta: fmtPtsDelta(seriesDelta(trends.femaleFinisherPercent)),
      direction: directionOf(seriesDelta(trends.femaleFinisherPercent), 0.05),
      neutral: true,
    },
    {
      label: 'Male Finishers %',
      formattedDelta: fmtPtsDelta(seriesDelta(maleFinPctData)),
      direction: directionOf(seriesDelta(maleFinPctData), 0.05),
      neutral: true,
    },
    {
      label: 'Median Finisher Age',
      formattedDelta: (() => {
        const d = seriesDelta(trends.medianFinisherAge);
        if (d === null || Math.abs(d) < 0.05) return 'unchanged';
        return `${d > 0 ? '+' : ''}${d.toFixed(1)} yrs`;
      })(),
      direction: directionOf(seriesDelta(trends.medianFinisherAge), 0.05),
      neutral: true,
    },
  ];

  return <KeyChangesList rows={rows} firstLabel={firstLabel} lastLabel={lastLabel} />;
}

function groupICRows(rows: ICRow[]): ICGroup[] {
  const groups: ICGroup[] = [];
  for (const row of rows) {
    if (row.sub) {
      groups[groups.length - 1]?.subs.push(row);
    } else {
      groups.push({ parent: row, subs: [] });
    }
  }
  return groups;
}

function ResultsIntervalComparisonTable({
  intervals, isFixedDist,
}: { intervals: ResultsIntervalStats[]; isFixedDist: boolean }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  function toggleGroup(i: number) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  const labels = intervals.map(iv => iv.label);
  const first = intervals[0];
  if (!first) return null;

  const firstPerf = first.stats.performance.events[0];
  const hasFt = isFixedDist && firstPerf?.finishTime != null;

  function ftGenderVal(iv: ResultsIntervalStats, g: 'M' | 'F' | 'NB', field: 'fastestSeconds' | 'slowestSeconds' | 'medianSeconds'): number | null {
    const row = iv.stats.performance.events[0]?.finishTime?.byGender.find(r => r.gender === g);
    return row?.[field] ?? null;
  }

  function ageByGender(iv: ResultsIntervalStats, g: 'M' | 'F' | 'NB', field: 'min' | 'max' | 'median'): number | null {
    const row = iv.stats.demographics.finisherAgeByGender.find(r => r.gender === g);
    return row?.[field] ?? null;
  }

  const fmtSec  = (v: number | null) => v !== null ? fmtTime(Math.round(v)) : '—';
  const fmtPct0 = (v: number | null) => fmtVal(v, '%');
  const fmtN0   = (v: number | null) => fmtVal(v, '', 0);
  const fmtN1   = (v: number | null) => fmtVal(v, '', 1);

  function atr(iv: ResultsIntervalStats, name: 'Male' | 'Female' | 'Non-Binary', f: keyof typeof iv.stats.attrition.overall): number | null {
    const row = iv.stats.attrition.byGender.find(r => r.name === name);
    return row ? (row[f] as number) : null;
  }

  const rows: ICRow[] = [
    // ── Total Entrants ──────────────────────────────────────────────────────────
    { label: 'Total Entrants',      values: intervals.map(iv => iv.stats.summary.totalEntrants), fmt: fmtN0 },
    { label: 'Male',                values: intervals.map(iv => atr(iv, 'Male', 'total')), fmt: fmtN0, sub: true },
    { label: 'Female',              values: intervals.map(iv => atr(iv, 'Female', 'total')), fmt: fmtN0, sub: true },
    { label: 'Non-Binary',          values: intervals.map(iv => atr(iv, 'Non-Binary', 'total')), fmt: fmtN0, sub: true },
    // ── Finishers ───────────────────────────────────────────────────────────────
    { label: 'Finishers',           values: intervals.map(iv => iv.stats.summary.finishers), fmt: fmtN0 },
    { label: 'Male',                values: intervals.map(iv => atr(iv, 'Male', 'finished')), fmt: fmtN0, sub: true },
    { label: 'Female',              values: intervals.map(iv => atr(iv, 'Female', 'finished')), fmt: fmtN0, sub: true },
    { label: 'Non-Binary',          values: intervals.map(iv => atr(iv, 'Non-Binary', 'finished')), fmt: fmtN0, sub: true },
    // ── Finish Rate ─────────────────────────────────────────────────────────────
    { label: 'Finish Rate',         values: intervals.map(iv => iv.stats.summary.finishRate), fmt: fmtPct0 },
    { label: 'Male',                values: intervals.map(iv => atr(iv, 'Male', 'finishRate')), fmt: fmtPct0, sub: true },
    { label: 'Female',              values: intervals.map(iv => atr(iv, 'Female', 'finishRate')), fmt: fmtPct0, sub: true },
    { label: 'Non-Binary',          values: intervals.map(iv => atr(iv, 'Non-Binary', 'finishRate')), fmt: fmtPct0, sub: true },
    // ── DNS ─────────────────────────────────────────────────────────────────────
    { label: 'DNS',                 values: intervals.map(iv => iv.stats.summary.dns), fmt: fmtN0, deltaInvert: true },
    { label: 'Male',                values: intervals.map(iv => atr(iv, 'Male', 'dns')), fmt: fmtN0, deltaInvert: true, sub: true },
    { label: 'Female',              values: intervals.map(iv => atr(iv, 'Female', 'dns')), fmt: fmtN0, deltaInvert: true, sub: true },
    { label: 'Non-Binary',          values: intervals.map(iv => atr(iv, 'Non-Binary', 'dns')), fmt: fmtN0, deltaInvert: true, sub: true },
    // ── DNS Rate ────────────────────────────────────────────────────────────────
    { label: 'DNS Rate',            values: intervals.map(iv => iv.stats.attrition.overall.dnsRate), fmt: fmtPct0, deltaInvert: true },
    { label: 'Male',                values: intervals.map(iv => atr(iv, 'Male', 'dnsRate')), fmt: fmtPct0, deltaInvert: true, sub: true },
    { label: 'Female',              values: intervals.map(iv => atr(iv, 'Female', 'dnsRate')), fmt: fmtPct0, deltaInvert: true, sub: true },
    { label: 'Non-Binary',          values: intervals.map(iv => atr(iv, 'Non-Binary', 'dnsRate')), fmt: fmtPct0, deltaInvert: true, sub: true },
    // ── DNF ─────────────────────────────────────────────────────────────────────
    { label: 'DNF',                 values: intervals.map(iv => iv.stats.summary.dnf), fmt: fmtN0, deltaInvert: true },
    { label: 'Male',                values: intervals.map(iv => atr(iv, 'Male', 'dnf')), fmt: fmtN0, deltaInvert: true, sub: true },
    { label: 'Female',              values: intervals.map(iv => atr(iv, 'Female', 'dnf')), fmt: fmtN0, deltaInvert: true, sub: true },
    { label: 'Non-Binary',          values: intervals.map(iv => atr(iv, 'Non-Binary', 'dnf')), fmt: fmtN0, deltaInvert: true, sub: true },
    // ── DNF Rate ────────────────────────────────────────────────────────────────
    { label: 'DNF Rate',            values: intervals.map(iv => iv.stats.summary.dnfRate), fmt: fmtPct0, deltaInvert: true },
    { label: 'Male',                values: intervals.map(iv => atr(iv, 'Male', 'dnfRate')), fmt: fmtPct0, deltaInvert: true, sub: true },
    { label: 'Female',              values: intervals.map(iv => atr(iv, 'Female', 'dnfRate')), fmt: fmtPct0, deltaInvert: true, sub: true },
    { label: 'Non-Binary',          values: intervals.map(iv => atr(iv, 'Non-Binary', 'dnfRate')), fmt: fmtPct0, deltaInvert: true, sub: true },
    // ── Median Finish Time ───────────────────────────────────────────────────────
    { label: 'Median Finish Time',  values: intervals.map(iv => iv.stats.performance.events[0]?.finishTime?.medianSeconds ?? null), fmt: fmtSec, deltaInvert: true, skip: !hasFt },
    { label: 'Male',                values: intervals.map(iv => ftGenderVal(iv, 'M', 'medianSeconds')), fmt: fmtSec, deltaInvert: true, skip: !hasFt, sub: true },
    { label: 'Female',              values: intervals.map(iv => ftGenderVal(iv, 'F', 'medianSeconds')), fmt: fmtSec, deltaInvert: true, skip: !hasFt, sub: true },
    { label: 'Non-Binary',          values: intervals.map(iv => ftGenderVal(iv, 'NB', 'medianSeconds')), fmt: fmtSec, deltaInvert: true, skip: !hasFt, sub: true },
    // ── Median Age ───────────────────────────────────────────────────────────────
    { label: 'Median Age (finishers)', values: intervals.map(iv => iv.stats.demographics.finisherAge.median), fmt: fmtN1, neutral: true },
    { label: 'Male',                values: intervals.map(iv => ageByGender(iv, 'M', 'median')), fmt: fmtN1, sub: true, neutral: true },
    { label: 'Female',              values: intervals.map(iv => ageByGender(iv, 'F', 'median')), fmt: fmtN1, sub: true, neutral: true },
    { label: 'Non-Binary',          values: intervals.map(iv => ageByGender(iv, 'NB', 'median')), fmt: fmtN1, sub: true, neutral: true },
    // ── Oldest Finisher ──────────────────────────────────────────────────────────
    { label: 'Oldest Finisher',     values: intervals.map(iv => iv.stats.demographics.finisherAge.max), fmt: fmtN0, neutral: true },
    { label: 'Male',                values: intervals.map(iv => ageByGender(iv, 'M', 'max')), fmt: fmtN0, sub: true, neutral: true },
    { label: 'Female',              values: intervals.map(iv => ageByGender(iv, 'F', 'max')), fmt: fmtN0, sub: true, neutral: true },
    { label: 'Non-Binary',          values: intervals.map(iv => ageByGender(iv, 'NB', 'max')), fmt: fmtN0, sub: true, neutral: true },
    // ── Youngest Finisher ────────────────────────────────────────────────────────
    { label: 'Youngest Finisher',   values: intervals.map(iv => iv.stats.demographics.finisherAge.min), fmt: fmtN0, neutral: true },
    { label: 'Male',                values: intervals.map(iv => ageByGender(iv, 'M', 'min')), fmt: fmtN0, sub: true, neutral: true },
    { label: 'Female',              values: intervals.map(iv => ageByGender(iv, 'F', 'min')), fmt: fmtN0, sub: true, neutral: true },
    { label: 'Non-Binary',          values: intervals.map(iv => ageByGender(iv, 'NB', 'min')), fmt: fmtN0, sub: true, neutral: true },
    // ── Last Finisher ─────────────────────────────────────────────────────────────
    { label: 'Last Finisher',       values: intervals.map(iv => iv.stats.performance.events[0]?.finishTime?.slowestSeconds ?? null), fmt: fmtSec, deltaInvert: true, skip: !hasFt },
    { label: 'Male',                values: intervals.map(iv => ftGenderVal(iv, 'M', 'slowestSeconds')), fmt: fmtSec, deltaInvert: true, skip: !hasFt, sub: true },
    { label: 'Female',              values: intervals.map(iv => ftGenderVal(iv, 'F', 'slowestSeconds')), fmt: fmtSec, deltaInvert: true, skip: !hasFt, sub: true },
    { label: 'Non-Binary',          values: intervals.map(iv => ftGenderVal(iv, 'NB', 'slowestSeconds')), fmt: fmtSec, deltaInvert: true, skip: !hasFt, sub: true },
    // ── Finisher gender breakdown ────────────────────────────────────────────────
    { label: 'Male Finishers %',    values: intervals.map(iv => iv.stats.demographics.finisherGender.malePercent), fmt: fmtPct0, neutral: true },
    { label: 'Female Finishers %',  values: intervals.map(iv => iv.stats.demographics.finisherGender.femalePercent), fmt: fmtPct0, neutral: true },
    { label: 'Non-Binary Finishers %', values: intervals.map(iv => iv.stats.demographics.finisherGender.nonBinaryPercent), fmt: fmtPct0, neutral: true },
    // ── Geography ────────────────────────────────────────────────────────────────
    { label: 'US Participants',     values: intervals.map(iv => iv.stats.geographic.usParticipants), fmt: fmtN0, neutral: true },
    { label: 'International',       values: intervals.map(iv => iv.stats.geographic.internationalParticipants), fmt: fmtN0, neutral: true },
    { label: 'States / Provinces',  values: intervals.map(iv => Object.keys(iv.stats.geographic.byState).length), fmt: fmtN0, neutral: true },
    { label: 'Countries',           values: intervals.map(iv => Object.keys(iv.stats.geographic.byCountry).length), fmt: fmtN0, neutral: true },
  ].filter(r => !r.skip);

  const groups = groupICRows(rows);

  function renderCells(row: ICRow) {
    const firstVal = row.values[0];
    return row.values.map((v, i) => (
      <td key={i} className={i === 0 ? '' : deltaClass(v, firstVal, row.deltaInvert, row.neutral)}>
        {row.fmt(v)}
        {i > 0 && v !== null && firstVal !== null && Math.abs(v - firstVal) >= 0.05 && (
          <>
            <span className="cmp-delta" aria-hidden="true">
              {' '}{v > firstVal ? '▲' : '▼'}
            </span>
            <span className="sr-only">{v > firstVal ? ', increased' : ', decreased'}</span>
          </>
        )}
      </td>
    ));
  }

  return (
    <div className="cmp-table-scroll">
      <table className="stats-table cmp-table">
        <caption className="sr-only">Side-by-side comparison of key statistics across all years</caption>
        <thead>
          <tr>
            <th scope="col">Metric</th>
            {labels.map(lbl => <th scope="col" key={lbl}>{lbl}</th>)}
          </tr>
        </thead>
        <tbody>
          {groups.map((group, gi) => {
            const isExp = expanded.has(gi);
            const hasSubs = group.subs.length > 0;
            return (
              <Fragment key={gi}>
                <tr>
                  <td className="cmp-metric-label">
                    {hasSubs ? (
                      <button
                        className="cmp-expander-btn"
                        onClick={() => toggleGroup(gi)}
                        aria-expanded={isExp}
                      >
                        <span className="cmp-expander-icon" aria-hidden="true">{isExp ? '▾' : '▸'}</span>
                        {group.parent.label}
                      </button>
                    ) : group.parent.label}
                  </td>
                  {renderCells(group.parent)}
                </tr>
                {hasSubs && group.subs.map((sub, si) => (
                  <tr key={si} className={`cmp-sub-row${isExp ? '' : ' cmp-sub-row--hidden'}`}>
                    <td className="cmp-metric-label cmp-metric-label--sub">{sub.label}</td>
                    {renderCells(sub)}
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Multi-year comparison dashboard ─────────────────────────────────────────

interface ComparisonDashboardProps {
  sessions: Array<{ sessionId: string; label: string; raceName: string }>;
  onBack: () => void;
}

function ComparisonDashboard({ sessions, onBack }: ComparisonDashboardProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [data, setData] = useState<ResultsComparisonStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => { headingRef.current?.focus(); }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(apiUrl('/api/results/compare'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessions }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? 'Failed to load comparison.'); return; }
        setData(json as ResultsComparisonStats);
      } catch {
        setError('Could not reach the server.');
      } finally {
        setLoading(false);
      }
    })();
  }, [sessions]);

  const raceName = sessions[0]?.raceName ?? 'Race';
  const trends = data?.trends;
  const isFixedDist = data?.primaryEventType === 'fixed-distance';

  return (
    <div className="rr-dashboard">
      <div className="dashboard-header">
        <div className="dashboard-header-left">
          <button type="button" className="btn-ghost dashboard-back no-print" onClick={onBack}>
            ← New analysis
          </button>
          <h1 ref={headingRef} tabIndex={-1} className="dashboard-title">
            {raceName} — {sessions.length}-Year Comparison
          </h1>
          <div className="comparison-intervals" aria-label="Years being compared">
            {sessions.map(s => (
              <span key={s.sessionId} className="comparison-interval-pill">{s.label}</span>
            ))}
          </div>
        </div>
        <button type="button" className="btn btn-primary no-print"
          onClick={() => window.print()} aria-label="Save as PDF">
          Save as PDF
        </button>
      </div>

      {loading && <div className="dashboard-loading" role="status" aria-live="polite" aria-busy="true">Loading comparison…</div>}
      {error && <div className="dashboard-error" role="alert">{error}</div>}

      {data && trends && !loading && (
        <>
          {/* ── Key Trends ── */}
          <section className="chart-section" aria-labelledby="rr-trends-heading">
            <SectionHeader title="Key Trends" />
            <div className="trend-cards-grid">
              {/* Participation */}
              <ResultsTrendCard title="Total Entrants" data={trends.totalEntrants} precision={0} />
              <ResultsTrendCard title="Finishers" data={trends.finishers} precision={0} />
              <ResultsTrendCard title="Finish Rate" data={trends.finishRate} unit="%" />
              <ResultsTrendCard title="DNF Rate" data={trends.dnfRate} unit="%" deltaInvert />
              {/* Medians */}
              {isFixedDist && trends.medianFinishTimeSeconds.length > 0 && (
                <ResultsTrendCard
                  title="Median Finish Time"
                  data={trends.medianFinishTimeSeconds}
                  formatValue={v => fmtTime(Math.round(v))}
                  deltaInvert
                />
              )}
              {!isFixedDist && trends.medianDistanceMiles.length > 0 && (
                <ResultsTrendCard
                  title="Median Distance"
                  data={trends.medianDistanceMiles}
                  unit=" mi"
                />
              )}
              <ResultsTrendCard title="Median Finisher Age" data={trends.medianFinisherAge} precision={1} />
              {/* Gender */}
              <ResultsTrendCard title="Female Finisher %" data={trends.femaleFinisherPercent} unit="%" />
              <ResultsTrendCard title="Non-Binary Finisher %" data={trends.nbFinisherPercent} unit="%" />
            </div>
          </section>

          {/* ── Interval comparison ── */}
          <section className="chart-section" aria-labelledby="rr-interval-heading">
            <SectionHeader title="Interval Comparison" />
            <IntervalComparisonPanel
              trendsContent={
                <RaceTrendLines
                  trends={data.trends}
                  intervals={data.intervals}
                  isFixedDist={isFixedDist}
                />
              }
              tableContent={
                <ResultsIntervalComparisonTable intervals={data.intervals} isFixedDist={isFixedDist} />
              }
              keyChangesContent={
                <RaceKeyChanges
                  trends={data.trends}
                  intervals={data.intervals}
                  isFixedDist={isFixedDist}
                />
              }
            />
          </section>

          {/* ── Per-year detail ── */}
          <section className="chart-section" aria-labelledby="rr-detail-heading">
            <SectionHeader title="Per-Year Details" />

            {/* Tab strip — hidden in print, all panels revealed */}
            <div className="interval-tab-strip no-print" role="tablist" aria-label="Race years">
              {data.intervals.map((iv, i) => (
                <button
                  key={iv.sessionId}
                  role="tab"
                  id={`rr-tab-${i}`}
                  aria-selected={i === activeTab}
                  aria-controls={`rr-panel-${i}`}
                  className={`interval-tab${i === activeTab ? ' interval-tab--active' : ''}`}
                  onClick={() => setActiveTab(i)}
                >
                  {iv.label}
                </button>
              ))}
            </div>

            {data.intervals.map((iv, i) => (
              <div
                key={iv.sessionId}
                role="tabpanel"
                id={`rr-panel-${i}`}
                aria-labelledby={`rr-tab-${i}`}
                className={`interval-tab-panel${i !== activeTab ? ' interval-tab-panel--inactive' : ''}`}
                aria-hidden={i !== activeTab}
              >
                <span className="interval-tab-label-print">{iv.label}</span>
                <FullStatsSections stats={iv.stats} weather={iv.weatherData as WeatherData | undefined} raceName={iv.raceName} />
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

// ─── Root page state machine ──────────────────────────────────────────────────

export type UploadResult =
  | { mode: 'single'; upload: ResultsUploadResponse; label: string }
  | { mode: 'comparison'; sessions: Array<{ sessionId: string; label: string; raceName: string }> };

type Phase =
  | { name: 'upload' }
  | { name: 'single'; upload: ResultsUploadResponse; label: string }
  | { name: 'comparison'; sessions: Array<{ sessionId: string; label: string; raceName: string }> };

function resultToPhase(r: UploadResult): Phase {
  if (r.mode === 'single') return { name: 'single', upload: r.upload, label: r.label };
  return { name: 'comparison', sessions: r.sessions };
}

export default function RaceResultsPage({ initialResult }: { initialResult?: UploadResult }) {
  const [phase, setPhase] = useState<Phase>(() =>
    initialResult ? resultToPhase(initialResult) : { name: 'upload' },
  );

  function handleComplete(result: UploadResult) {
    if (result.mode === 'single') {
      setPhase({ name: 'single', upload: result.upload, label: result.label });
    } else {
      setPhase({ name: 'comparison', sessions: result.sessions });
    }
  }

  function handleBack() {
    setPhase({ name: 'upload' });
  }

  if (phase.name === 'upload') {
    return <UploadPhase onComplete={handleComplete} />;
  }

  if (phase.name === 'single') {
    return <SingleDashboard upload={phase.upload} label={phase.label} onBack={handleBack} />;
  }

  return <ComparisonDashboard sessions={phase.sessions} onBack={handleBack} />;
}
