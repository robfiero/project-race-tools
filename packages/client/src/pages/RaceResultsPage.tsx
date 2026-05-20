import {
  useState, useEffect, useRef, Fragment,
  type ChangeEvent, type DragEvent, type FormEvent, type ReactNode,
} from 'react';
import {
  BarChart, Bar, Cell, LabelList, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { apiUrl } from '../api.ts';
import type {
  ResultsUploadResponse, ResultsStatsResponse, ResultsStats,
  ResultsSummaryStats, EventPerformanceStats, ResultsDemographicsStats,
  AttritionStats, ResultsCrossEventStats, AgeGroupPerformanceStats, AgeGroupPerformanceByEvent, DivisionPerformanceStats, DivisionPerformanceByEvent, PerformanceBandStats, GenderStats, AgeStats,
  ResultsComparisonStats, ResultsComparisonTrends, ResultsIntervalStats,
  TrendPoint, WeatherData,
} from '../types.ts';
import { useTheme } from '../ThemeContext.tsx';
import { chartPalette, genderColors, comparisonPalette, comparisonPaletteName } from '../chartColors.ts';
import SectionHeader from '../components/SectionHeader.tsx';
import AgeSection from '../components/AgeSection.tsx';
import GeographicSection from '../components/GeographicSection.tsx';
import StatCard from '../components/StatCard.tsx';
import InsightCallout from '../components/InsightCallout.tsx';
import WeatherSection from '../components/WeatherSection.tsx';
import { finishTimeInsights, demographicsInsights } from '../insights.ts';
import {
  TrendLineChart,
  KeyChangesList,
  seriesDelta,
  fmtCountDelta,
  fmtPtsDelta,
  fmtTimeDelta,
  directionOf,
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

function fmtBarCount(v: number): string {
  if (v <= 0) return '';
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v));
}

function fmtDist(miles: number): string {
  return `${miles.toFixed(1)} mi`;
}

function fmtPace(secsPerMile: number): string {
  const totalSecs = Math.round(secsPerMile);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}/mi`;
  return `${m}:${String(s).padStart(2, '0')}/mi`;
}

function eventDistanceMiles(name: string): number {
  const lower = name.toLowerCase();
  if (/\bhalf[\s-]marathon\b/.test(lower)) return 13.1;
  if (/\bmarathon\b/.test(lower)) return 26.2;
  const km = name.match(/(\d+(?:\.\d+)?)\s*k(?:m\b|\b)/i);
  if (km) return parseFloat(km[1]) * 0.621371;
  const mi = name.match(/(\d+(?:\.\d+)?)\s*(?:mile[rs]?|mi)\b/i);
  if (mi) return parseFloat(mi[1]);
  return Infinity;
}

function sortEventNames(events: string[]): string[] {
  return [...events].sort((a, b) => {
    const da = eventDistanceMiles(a);
    const db = eventDistanceMiles(b);
    if (da !== db) return da - db;
    return a.localeCompare(b);
  });
}

const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC',
]);

function displayGenderLabel(gender: string): string {
  const trimmed = gender.trim();
  if (!trimmed) return 'Unknown';
  const normalized = trimmed.toUpperCase();
  if (normalized === 'M' || normalized === 'MALE') return 'Male';
  if (normalized === 'F' || normalized === 'FEMALE') return 'Female';
  if (normalized === 'NB' || normalized === 'NON-BINARY' || normalized === 'NONBINARY') return 'Non-Binary';
  if (normalized === 'UNKNOWN') return 'Unknown';
  return trimmed;
}

function activeByEventIdx<T extends { eventName: string }>(
  items: T[],
  selectedEventName: string | null,
): number {
  if (items.length === 0) return 0;
  return Math.max(0, items.findIndex(item => item.eventName === selectedEventName));
}

function hasCrossEventPerformance(crossEvent: ResultsCrossEventStats): boolean {
  if (crossEvent.rows.length === 0) return false;
  const hasFixedDist = crossEvent.rows.some(r => r.eventType === 'fixed-distance');
  const hasFixedTime = crossEvent.rows.some(r => r.eventType === 'fixed-time');
  const hasTimePerfData = crossEvent.rows.some(r => r.fastestSeconds != null && Number.isFinite(r.fastestSeconds));
  const hasPacePerfData = crossEvent.rows.some(r => r.medianPaceSecsPerMile != null && Number.isFinite(r.medianPaceSecsPerMile));
  const hasDistPerfData = crossEvent.rows.some(r => r.farthestMiles != null && Number.isFinite(r.farthestMiles));
  return (hasFixedDist && (hasTimePerfData || hasPacePerfData)) || (hasFixedTime && hasDistPerfData);
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

function reportTitleWithYear(raceName: string, year: string | null): string {
  if (!year || raceName.includes(year)) return raceName;
  return `${raceName} ${year}`;
}

function reportYearFromWeatherOrLabel(weather: WeatherData | undefined, label: string): string | null {
  if (weather?.raceStartIso) return weather.raceStartIso.slice(0, 4);
  return /^\d{4}$/.test(label) ? label : null;
}

function GenderSummary({ male, female, nonBinary }: { male: number; female: number; nonBinary: number }) {
  const { theme } = useTheme();
  const gc = genderColors(theme);
  const total = male + female + nonBinary;
  if (total === 0) return null;
  const segments = [
    { key: 'M',  label: 'Male',       count: male,      pct: (male / total) * 100,      color: gc.M },
    { key: 'F',  label: 'Female',     count: female,    pct: (female / total) * 100,    color: gc.F },
    { key: 'NB', label: 'Non-Binary', count: nonBinary, pct: (nonBinary / total) * 100, color: gc.NB },
  ].filter(s => s.count > 0);
  return (
    <div className="rr-gender-summary" role="list" aria-label="Gender breakdown">
      {segments.map(s => (
        <div key={s.key} className="rr-gender-summary-item" role="listitem">
          <span className="rr-gender-summary-chip" style={{ background: s.color }} aria-hidden="true" />
          <span className="rr-gender-summary-label">{s.label}</span>
          <span className="rr-gender-summary-count">{s.count.toLocaleString()}</span>
          <span className="rr-gender-summary-pct">{s.pct.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

function DemographicTeaserRow({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rr-demo-teaser-row${className ? ` ${className}` : ''}`}>
      <span className="rr-demo-teaser-label">{label}</span>
      <div className="rr-demo-teaser-content">{children}</div>
    </div>
  );
}

function ParticipantAgeRange({ stats }: { stats?: AgeStats }) {
  if (!stats || stats.min === null || stats.max === null) return null;
  return (
    <DemographicTeaserRow label="Participant Age Range:">
      <span className="rr-age-range-inline-value">Youngest participant: {stats.min}</span>
      <span className="rr-age-range-inline-separator" aria-hidden="true">·</span>
      <span className="rr-age-range-inline-value">Oldest participant: {stats.max}</span>
    </DemographicTeaserRow>
  );
}

function SelectedEventContext({ eventName }: { eventName?: string | null }) {
  if (!eventName) return null;
  return (
    <p className="rr-selected-event-context">
      <span>Selected event: <strong>{eventName}</strong></span>
      <span className="rr-selected-event-context-separator" aria-hidden="true">·</span>
      <a href="#rr-report-controls">Change event ↑</a>
    </p>
  );
}


function SummarySection({
  summary,
  entrantGender,
  participantAge,
  attrition,
}: {
  summary: ResultsSummaryStats;
  entrantGender?: GenderStats;
  participantAge?: AgeStats;
  attrition?: AttritionStats;
}) {
  const overallAttrition = attrition?.overall;
  const starters = overallAttrition?.starters ?? (summary.totalEntrants - summary.dns);
  const overallFinishRate = overallAttrition?.finishRate ?? (starters > 0 ? (summary.finishers / starters) * 100 : 0);
  const overallDnfRate = overallAttrition?.dnfRate ?? summary.dnfRate;
  const overallDnsRate = overallAttrition?.dnsRate ?? (summary.totalEntrants > 0 ? (summary.dns / summary.totalEntrants) * 100 : 0);

  return (
    <section className="chart-section" aria-labelledby="rr-summary-heading">
      <SectionHeader title="Overall Summary" />

      {/* 1 — Overall race snapshot */}
      <div className="summary-cards rr-summary-snap-cards">
        <StatCard label="Total Participants" value={summary.totalEntrants.toLocaleString()} />
        <StatCard label="DNS"            value={summary.dns.toLocaleString()} sub={`${fmtPct(overallDnsRate)} of participants`} />
        <StatCard label="Starters"       value={starters.toLocaleString()} />
        <StatCard label="Finishers"      value={summary.finishers.toLocaleString()} />
        <StatCard label="DNF"            value={summary.dnf.toLocaleString()} sub={`${fmtPct(overallDnfRate)} of starters`} />
        <StatCard label="Finish Rate"    value={fmtPct(overallFinishRate)} sub="of starters" />
      </div>

      {/* 2 — Overall entrant gender mix — compact centered inline row */}
      {entrantGender && (entrantGender.male + entrantGender.female + entrantGender.nonBinary > 0) && (
        <DemographicTeaserRow label="Participant Gender Mix:">
          <GenderSummary male={entrantGender.male} female={entrantGender.female} nonBinary={entrantGender.nonBinary} />
        </DemographicTeaserRow>
      )}
      <ParticipantAgeRange stats={participantAge} />
    </section>
  );
}

function EventSnapshotSection({
  summary,
  selectedEventName,
  showSelectedEventContext = true,
}: {
  summary: ResultsSummaryStats;
  selectedEventName: string | null;
  showSelectedEventContext?: boolean;
}) {
  const activeEventIdx = Math.max(0, summary.events.findIndex(ev => ev.name === selectedEventName));
  const activeEvent = summary.events[activeEventIdx];

  return (
    <section className="chart-section" aria-labelledby="rr-event-snapshot-heading">
      <div className="rr-event-snapshot">
        <p id="rr-event-snapshot-heading" className="rr-snap-subheading">Event Snapshot</p>
        {showSelectedEventContext && <SelectedEventContext eventName={activeEvent?.name} />}
        <div className="rr-snap-divider" aria-hidden="true" />

        {summary.events.map((ev, i) => {
          if (summary.events.length > 1 && i !== activeEventIdx) return null;
          const evStarters = ev.totalEntrants - ev.dns;
          const evMale = ev.gender.male;
          const evFemale = ev.gender.female;
          const evNB = ev.gender.nonBinary;

          const evFieldShare = summary.totalEntrants > 0 ? (ev.totalEntrants / summary.totalEntrants) * 100 : 0;

          return (
            <div key={ev.name} className="rr-event-snap-panel">

              {/* Participation block */}
              <div className="rr-event-snap-block">
                <p className="rr-event-snap-block-label">Participation</p>
                <div className="rr-event-snap-stats">
                  <div className="rr-event-snap-stat">
                    <span className="rr-event-snap-stat-label">Total Participants</span>
                    <span className="rr-event-snap-stat-value">{ev.totalEntrants.toLocaleString()}</span>
                  </div>
                  {summary.events.length > 1 && (
                    <div className="rr-event-snap-stat">
                      <span className="rr-event-snap-stat-label">Race Field %</span>
                      <span className="rr-event-snap-stat-value">{evFieldShare.toFixed(1)}%</span>
                    </div>
                  )}
                  <div className="rr-event-snap-stat">
                    <span className="rr-event-snap-stat-label">DNS</span>
                    <span className="rr-event-snap-stat-value">{ev.dns.toLocaleString()}</span>
                  </div>
                  <div className="rr-event-snap-stat">
                    <span className="rr-event-snap-stat-label">Starters</span>
                    <span className="rr-event-snap-stat-value">{evStarters.toLocaleString()}</span>
                  </div>
                  <div className="rr-event-snap-stat">
                    <span className="rr-event-snap-stat-label">Finishers</span>
                    <span className="rr-event-snap-stat-value">{ev.finishers.toLocaleString()}</span>
                  </div>
                  <div className="rr-event-snap-stat">
                    <span className="rr-event-snap-stat-label">DNF</span>
                    <span className="rr-event-snap-stat-value">{ev.dnf.toLocaleString()}</span>
                  </div>
                  <div className="rr-event-snap-stat">
                    <span className="rr-event-snap-stat-label">Finish Rate</span>
                    <span className="rr-event-snap-stat-value">{fmtPct(ev.finishRate)}</span>
                  </div>
                </div>
              </div>

              {/* Gender mix block */}
              {(evMale + evFemale + evNB) > 0 && (
                <DemographicTeaserRow label="Participant Gender Mix:" className="rr-event-snap-gender-row">
                  <GenderSummary male={evMale} female={evFemale} nonBinary={evNB} />
                </DemographicTeaserRow>
              )}
              <ParticipantAgeRange stats={ev.participantAge} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SelectedEventSelector({
  events,
  selectedEventName,
  onSelect,
}: {
  events: EventPerformanceStats[];
  selectedEventName: string | null;
  onSelect: (eventName: string) => void;
}) {
  if (events.length <= 1) return null;
  const activeName = selectedEventName && events.some(ev => ev.eventName === selectedEventName)
    ? selectedEventName
    : events[0].eventName;

  return (
    <div className="rr-selected-event-control no-print" aria-label="Report selected event selector">
      <div className="rr-selected-event-copy">
        <span className="rr-selected-event-label">Selected Event</span>
      </div>
      <div className="rr-perf-tabs rr-selected-event-tabs" role="tablist" aria-label="Selected Event">
        {events.map(ev => (
          <button
            key={ev.eventName}
            type="button"
            role="tab"
            aria-selected={activeName === ev.eventName}
            className={`rr-perf-tab${activeName === ev.eventName ? ' rr-perf-tab--active' : ''}`}
            onClick={() => onSelect(ev.eventName)}
          >
            {ev.eventName}
          </button>
        ))}
      </div>
    </div>
  );
}

function PerformancePanel({ perf }: { perf: EventPerformanceStats }) {
  const { theme } = useTheme();
  const gc = genderColors(theme);
  const ft = perf.finishTime;
  const da = perf.distanceAchieved;
  const [paceView, setPaceView] = useState<'chart' | 'tables'>('chart');
  const [distView, setDistView] = useState<'chart' | 'tables'>('chart');
  const buckets = ft?.buckets ?? da?.buckets ?? [];
  const chartData = buckets.map(b => ({ label: b.label, Male: b.male, Female: b.female, 'Non-Binary': b.nonBinary }));
  const ftFinishers = ft?.byGender.reduce((sum, row) => sum + row.finishers, 0) ?? 0;
  const daFinishers = da?.byGender.reduce((sum, row) => sum + row.finishers, 0) ?? 0;

  return (
    <div className="rr-perf-panel rr-finish-distribution-panel">
      {perf.eventType === 'fixed-distance' && ft ? (
        <div className="rr-finish-distribution-group">
          <div className="rr-finish-distribution-table-panel">
            <h4 className="rr-finish-distribution-table-heading">Finish Time Summary</h4>
            <table className="stats-table rr-gender-time-table rr-finish-summary-table">
              <caption className="sr-only">Finish time summary by group</caption>
              <thead>
                <tr><th>Group</th><th>Finishers</th><th>Fastest Time</th><th>Average Time</th><th>Median Time</th><th>Last Finisher</th></tr>
              </thead>
              <tbody>
                <tr className="rr-finish-summary-overall-row">
                  <td>Overall</td>
                  <td>{ftFinishers.toLocaleString()}</td>
                  <td>{fmtTime(ft.fastestSeconds)}</td>
                  <td>{fmtTime(ft.meanSeconds)}</td>
                  <td>{fmtTime(ft.medianSeconds)}</td>
                  <td>{fmtTime(ft.slowestSeconds)}</td>
                </tr>
                {ft.byGender.map(row => (
                  <tr key={row.gender}>
                    <td>{displayGenderLabel(row.gender)}</td>
                    <td>{row.finishers}</td>
                    <td>{row.fastestSeconds != null ? fmtTime(row.fastestSeconds) : '—'}</td>
                    <td>{row.meanSeconds != null ? fmtTime(row.meanSeconds) : '—'}</td>
                    <td>{row.medianSeconds != null ? fmtTime(row.medianSeconds) : '—'}</td>
                    <td>{row.slowestSeconds != null ? fmtTime(row.slowestSeconds) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : da ? (
        <div className="rr-finish-distribution-group">
          <div className="rr-finish-distribution-table-panel">
            <h4 className="rr-finish-distribution-table-heading">Finish Distance Summary</h4>
            <table className="stats-table rr-gender-time-table rr-finish-summary-table">
              <caption className="sr-only">Finish distance summary by group</caption>
              <thead>
                <tr><th>Group</th><th>Finishers</th><th>Longest Distance</th><th>Average Distance</th><th>Median Distance</th><th>Shortest Distance</th></tr>
              </thead>
              <tbody>
                <tr className="rr-finish-summary-overall-row">
                  <td>Overall</td>
                  <td>{daFinishers.toLocaleString()}</td>
                  <td>{fmtDist(da.maxMiles)}</td>
                  <td>{fmtDist(da.meanMiles)}</td>
                  <td>{fmtDist(da.medianMiles)}</td>
                  <td>{fmtDist(da.minMiles)}</td>
                </tr>
                {da.byGender.map(row => (
                  <tr key={row.gender}>
                    <td>{displayGenderLabel(row.gender)}</td>
                    <td>{row.finishers}</td>
                    <td>{row.maxMiles != null ? fmtDist(row.maxMiles) : '—'}</td>
                    <td>{row.meanMiles != null ? fmtDist(row.meanMiles) : '—'}</td>
                    <td>{row.medianMiles != null ? fmtDist(row.medianMiles) : '—'}</td>
                    <td>{row.minMiles != null ? fmtDist(row.minMiles) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {ft && (
        <div className="rr-finish-distribution-group">
          <h4 className="rr-finish-distribution-group-heading">Finish Time Distribution</h4>
          <p className="rr-finish-distribution-helper">
            Equal time-slice buckets show where finishers landed across the selected event’s finish-time span.
          </p>

          {chartData.length > 0 && (
            <div className="rr-perf-chart rr-finish-distribution-chart-panel">
              <p className="rr-perf-chart-label">Finishers per time range, stacked by gender</p>
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
        </div>
      )}

      {ft && (
        <div className="rr-finish-distribution-group rr-finish-percentiles-group">
          <h4 className="rr-finish-distribution-group-heading">Finish Time Percentiles</h4>
          <p className="rr-finish-distribution-helper">
            Percentiles mark the exact time reached by each share of the finishing field.
          </p>
          <div className="rr-percentile-block">
            <span className="rr-percentile-heading">Percentile times</span>
            <div className="rr-percentile-row">
              {ft.percentiles.map(p => (
                <div key={p.label} className="rr-percentile-cell">
                  <span className="rr-percentile-label">{p.label}</span>
                  <span className="rr-percentile-value">{fmtTime(p.seconds)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {da && (
        <div className="rr-finish-distribution-group">
          <h4 className="rr-finish-distribution-group-heading">Finish Distance Distribution</h4>
          <p className="rr-finish-distribution-helper">
            Equal distance buckets show how finishers spread across the selected event’s distance range.
          </p>

          {chartData.length > 0 && (
            <div className="rr-perf-chart rr-finish-distribution-chart-panel">
              <p className="rr-perf-chart-label">Finishers per distance range, stacked by gender</p>
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
        </div>
      )}

      {da && (
        <div className="rr-finish-distribution-group rr-finish-percentiles-group">
          <h4 className="rr-finish-distribution-group-heading">Finish Distance Percentiles</h4>
          <p className="rr-finish-distribution-helper">
            Percentiles mark the distance reached by each share of the finishing field.
          </p>
          <div className="rr-percentile-block">
            <span className="rr-percentile-heading">Distance percentiles</span>
            <div className="rr-percentile-row">
              {da.percentiles.map(p => (
                <div key={p.label} className="rr-percentile-cell">
                  <span className="rr-percentile-label">{p.label}</span>
                  <span className="rr-percentile-value">{p.miles.toFixed(1)} mi</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {perf.paceStats && (() => {
        const ps = perf.paceStats;
        const paceChartData = ps.buckets.map(b => ({ label: b.label, Finishers: b.count }));
        return (
          <div className="rr-pace-section rr-distribution-analysis-section">
            <h4 className="rr-pace-heading">Pace Bracket Analysis</h4>
            <p className="rr-distribution-analysis-helper">A secondary view of finishers grouped by pace range.</p>

            <div className="rr-perf-summary rr-distribution-analysis-metric-strip">
              <div className="rr-perf-stat">
                <span className="rr-perf-stat-label">Fastest Pace</span>
                <span className="rr-perf-stat-value">{fmtPace(ps.fastestSecsPerMile)}</span>
              </div>
              <div className="rr-perf-stat">
                <span className="rr-perf-stat-label">Average Pace</span>
                <span className="rr-perf-stat-value">{fmtPace(ps.meanSecsPerMile)}</span>
              </div>
              <div className="rr-perf-stat">
                <span className="rr-perf-stat-label">Median Pace</span>
                <span className="rr-perf-stat-value">{fmtPace(ps.medianSecsPerMile)}</span>
              </div>
              <div className="rr-perf-stat">
                <span className="rr-perf-stat-label">Last Finisher Pace</span>
                <span className="rr-perf-stat-value">{fmtPace(ps.slowestSecsPerMile)}</span>
              </div>
              <div className="rr-perf-stat">
                <span className="rr-perf-stat-label">Pace Spread</span>
                <span className="rr-perf-stat-value">{fmtPace(ps.spreadSecsPerMile)}</span>
              </div>
            </div>

            <div className="rd-tab-strip rr-distribution-analysis-tabs" role="tablist">
              <button
                role="tab"
                aria-selected={paceView === 'chart'}
                className={`rd-tab${paceView === 'chart' ? ' rd-tab--active' : ''}`}
                onClick={() => setPaceView('chart')}
              >Chart</button>
              <button
                role="tab"
                aria-selected={paceView === 'tables'}
                className={`rd-tab${paceView === 'tables' ? ' rd-tab--active' : ''}`}
                onClick={() => setPaceView('tables')}
              >Tables</button>
            </div>

            {paceView === 'chart' && paceChartData.length > 0 && (
              <div role="tabpanel" className="rd-tab-panel rr-distribution-analysis-chart-panel">
                <p className="rr-perf-chart-label">Finishers per pace range (min/mi) — each bar is a 1–5 minute pace bucket depending on the spread of the field</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={paceChartData} margin={{ top: 8, right: 8, bottom: 56, left: 32 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" interval={0} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      allowDecimals={false}
                      label={{ value: 'Finishers', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: '0.72rem', fill: '#888' } }}
                    />
                    <Tooltip contentStyle={{ fontSize: '0.8rem' }} formatter={(v: number) => [v, 'Finishers']} />
                    <Bar dataKey="Finishers" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {paceView === 'tables' && (
              <div role="tabpanel" className="rd-tab-panel rr-distribution-analysis-table-panel">
                {ps.byGender.length > 0 && (
                  <table className="stats-table rr-gender-time-table">
                    <caption className="sr-only">Pace by gender</caption>
                    <thead>
                      <tr><th>Gender</th><th>Finishers</th><th>Fastest</th><th>Median</th><th>Last finisher</th></tr>
                    </thead>
                    <tbody>
                      {ps.byGender.map(row => (
                        <tr key={row.gender}>
                          <td>{row.gender}</td>
                          <td>{row.finishers}</td>
                          <td>{fmtPace(row.fastestSecsPerMile)}</td>
                          <td>{fmtPace(row.medianSecsPerMile)}</td>
                          <td>{fmtPace(row.slowestSecsPerMile)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {ps.byAgeGroup.length > 0 && (
                  <table className="stats-table rr-gender-time-table">
                    <caption className="sr-only">Pace by age group</caption>
                    <thead>
                      <tr><th>Age group</th><th>Finishers</th><th>Fastest</th><th>Median</th><th>Last finisher</th></tr>
                    </thead>
                    <tbody>
                      {ps.byAgeGroup.map(row => (
                        <tr key={row.ageGroup}>
                          <td>{row.ageGroup}</td>
                          <td>{row.finishers}</td>
                          <td>{fmtPace(row.fastestSecsPerMile)}</td>
                          <td>{fmtPace(row.medianSecsPerMile)}</td>
                          <td>{fmtPace(row.slowestSecsPerMile)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {da && (() => {
        return (
          <div className="rr-pace-section rr-distribution-analysis-section">
            <h4 className="rr-pace-heading">Distance Bracket Analysis</h4>
            <p className="rr-distribution-analysis-helper">A secondary view of finishers grouped by distance bracket.</p>

            <div className="rr-perf-summary rr-distribution-analysis-metric-strip">
              <div className="rr-perf-stat">
                <span className="rr-perf-stat-label">Longest Distance</span>
                <span className="rr-perf-stat-value">{fmtDist(da.maxMiles)}</span>
              </div>
              <div className="rr-perf-stat">
                <span className="rr-perf-stat-label">Average Distance</span>
                <span className="rr-perf-stat-value">{fmtDist(da.meanMiles)}</span>
              </div>
              <div className="rr-perf-stat">
                <span className="rr-perf-stat-label">Median Distance</span>
                <span className="rr-perf-stat-value">{fmtDist(da.medianMiles)}</span>
              </div>
              <div className="rr-perf-stat">
                <span className="rr-perf-stat-label">Shortest Distance</span>
                <span className="rr-perf-stat-value">{fmtDist(da.minMiles)}</span>
              </div>
              <div className="rr-perf-stat">
                <span className="rr-perf-stat-label">Distance Spread</span>
                <span className="rr-perf-stat-value">{fmtDist(da.spreadMiles)}</span>
              </div>
            </div>

            <div className="rd-tab-strip rr-distribution-analysis-tabs" role="tablist">
              <button
                role="tab"
                aria-selected={distView === 'chart'}
                className={`rd-tab${distView === 'chart' ? ' rd-tab--active' : ''}`}
                onClick={() => setDistView('chart')}
              >Chart</button>
              <button
                role="tab"
                aria-selected={distView === 'tables'}
                className={`rd-tab${distView === 'tables' ? ' rd-tab--active' : ''}`}
                onClick={() => setDistView('tables')}
              >Tables</button>
            </div>

            {distView === 'chart' && da.distBuckets.length > 0 && (
              <div role="tabpanel" className="rd-tab-panel rr-distribution-analysis-chart-panel">
                <p className="rr-perf-chart-label">Finishers per distance range — bars show how many finishers reached each distance bracket</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={da.distBuckets} barCategoryGap="35%" margin={{ top: 22, right: 8, bottom: 56, left: 32 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" interval={0} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      allowDecimals={false}
                      label={{ value: 'Finishers', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: '0.72rem', fill: '#888' } }}
                    />
                    <Tooltip contentStyle={{ fontSize: '0.8rem' }} formatter={(v: number) => [v, 'Finishers']} />
                    <Bar dataKey="count" fill="var(--color-primary)" maxBarSize={40} radius={[3, 3, 0, 0]}>
                      <LabelList dataKey="count" position="top"
                        formatter={(v: number) => (v > 0 ? String(v) : '')}
                        style={{ fontSize: '0.68rem', fill: '#555' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {distView === 'tables' && (
              <div role="tabpanel" className="rd-tab-panel rr-distribution-analysis-table-panel">
                {da.byGender.length > 0 && (
                  <table className="stats-table rr-gender-time-table">
                    <caption className="sr-only">Distance by gender</caption>
                    <thead>
                      <tr><th>Gender</th><th>Finishers</th><th>Longest</th><th>Average</th><th>Median</th><th>Shortest distance</th></tr>
                    </thead>
                    <tbody>
                      {da.byGender.map(row => (
                        <tr key={row.gender}>
                          <td>{row.gender}</td>
                          <td>{row.finishers}</td>
                          <td>{row.maxMiles != null ? fmtDist(row.maxMiles) : '—'}</td>
                          <td>{row.meanMiles != null ? fmtDist(row.meanMiles) : '—'}</td>
                          <td>{row.medianMiles != null ? fmtDist(row.medianMiles) : '—'}</td>
                          <td>{row.minMiles != null ? fmtDist(row.minMiles) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {da.byAgeGroup.length > 0 && (
                  <table className="stats-table rr-gender-time-table">
                    <caption className="sr-only">Distance by age group</caption>
                    <thead>
                      <tr><th>Age group</th><th>Finishers</th><th>Longest</th><th>Average</th><th>Median</th><th>Shortest distance</th></tr>
                    </thead>
                    <tbody>
                      {da.byAgeGroup.map(row => (
                        <tr key={row.ageGroup}>
                          <td>{row.ageGroup}</td>
                          <td>{row.finishers}</td>
                          <td>{row.maxMiles != null ? fmtDist(row.maxMiles) : '—'}</td>
                          <td>{row.meanMiles != null ? fmtDist(row.meanMiles) : '—'}</td>
                          <td>{row.medianMiles != null ? fmtDist(row.medianMiles) : '—'}</td>
                          <td>{row.minMiles != null ? fmtDist(row.minMiles) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

function PerformanceSection({
  events,
  selectedEventName,
  showSelectedEventContext = true,
}: {
  events: EventPerformanceStats[];
  selectedEventName: string | null;
  showSelectedEventContext?: boolean;
}) {
  if (events.length === 0) return null;

  const activeIdx = activeByEventIdx(events, selectedEventName);
  const activeEvent = events[activeIdx];
  const isFixedDist = activeEvent?.eventType === 'fixed-distance';
  const insights = finishTimeInsights([events[activeIdx]]);

  return (
    <section className="chart-section rr-finish-distribution-section" aria-labelledby="rr-perf-heading">
      <SectionHeader
        title={isFixedDist ? 'Finish Performance' : 'Distance Performance'}
        contextStrip={showSelectedEventContext ? <SelectedEventContext eventName={activeEvent?.eventName} /> : undefined}
      />
      <p className="rr-perf-intro">
        {isFixedDist
          ? 'Selected-event finish performance for finishers. The summary compares overall results with gender groups, followed by equal time-slice distribution, percentile times, and pace brackets.'
          : 'Selected-event distance performance for finishers. The summary compares overall results with gender groups, followed by equal distance distribution, distance percentiles, and distance brackets.'}
      </p>
      <InsightCallout insights={insights} />
      <PerformancePanel perf={events[activeIdx]} />
    </section>
  );
}

function EventBreakdownSection({ attrition }: { attrition: AttritionStats }) {
  const { theme } = useTheme();
  const [atrTab, setAtrTab] = useState<'charts' | 'table'>('charts');

  if (attrition.byEvent.length <= 1) return null;

  const colors = chartPalette(theme, 3);
  const overall = attrition.overall;
  const atrChartRows = attrition.byEvent.filter(r => r.total > 0);
  const atrChartData = atrChartRows.map(r => ({
    name: r.name, Finished: r.finished, DNF: r.dnf, DNS: r.dns, total: r.total,
  }));
  const atrTableRows = [overall, ...attrition.byEvent];
  const atrChartHeight = Math.max(120, atrChartData.length * 56) + 40;

  const atrInsights: string[] = [];
  if (overall.dns > 0 || overall.dnf > 0) {
    if (overall.dns > overall.dnf * 1.25) {
      atrInsights.push('Most attrition happened before race day, with DNS exceeding on-course DNFs.');
    } else if (overall.dnf > overall.dns * 1.25) {
      atrInsights.push('Most attrition happened on course, with DNFs exceeding DNS.');
    } else {
      atrInsights.push('Attrition was split fairly evenly between DNS and DNF outcomes.');
    }
  }

  return (
    <section className="chart-section" aria-labelledby="rr-event-breakdown-heading">
      <SectionHeader title="Event Breakdown" />
      <div className="ce-subsection">
        <h3 id="rr-event-breakdown-heading" className="ce-subsection-title">Completion &amp; Attrition by Event</h3>

        <div className="rd-tab-strip" role="tablist" aria-label="DNS, starters and DNF views">
          {(['charts', 'table'] as const).map(id => (
            <button key={id} type="button" role="tab"
              aria-selected={atrTab === id}
              className={`rd-tab${atrTab === id ? ' rd-tab--active' : ''}`}
              onClick={() => setAtrTab(id)}
            >
              {id === 'charts' ? 'Charts' : 'Table'}
            </button>
          ))}
        </div>

        {atrTab === 'charts' && (
          <div role="tabpanel" className="rd-tab-panel">
            <div className="rr-attrition-chart" role="img" aria-label="Completion and attrition breakdown chart">
              <ResponsiveContainer width="100%" height={atrChartHeight}>
                <BarChart data={atrChartData} margin={{ top: 8, right: 72, bottom: 8, left: 8 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip contentStyle={{ fontSize: '0.8rem' }} />
                  <Legend verticalAlign="top" iconType="square" wrapperStyle={{ fontSize: '0.8rem' }} />
                  <Bar dataKey="Finished" stackId="a" fill={colors[0]} />
                  <Bar dataKey="DNF" stackId="a" fill={colors[1]} />
                  <Bar dataKey="DNS" stackId="a" fill={colors[2]} radius={[0, 3, 3, 0]}>
                    <LabelList dataKey="total" position="right"
                      formatter={fmtBarCount}
                      style={{ fontSize: '0.72rem', fill: '#555' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {atrTab === 'table' && (
          <div role="tabpanel" className="rd-tab-panel">
            <div className="rr-agp-table-wrap">
              <table className="stats-table">
                <caption className="sr-only">Completion and attrition by group</caption>
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Total Participants</th>
                    <th>Starters</th>
                    <th>Start %</th>
                    <th>Finishers</th>
                    <th>Finish % of Starters</th>
                    <th>DNF</th>
                    <th>DNF % of Starters</th>
                    <th>DNS</th>
                    <th>DNS % of Participants</th>
                  </tr>
                </thead>
                <tbody>
                  {atrTableRows.map(r => (
                    <tr key={r.name} className={r.name === 'Overall' ? 'rr-attrition-overall' : ''}>
                      <td>{r.name}</td>
                      <td>{r.total}</td>
                      <td>{r.starters}</td>
                      <td>{r.total > 0 ? fmtPct(r.startRate) : '—'}</td>
                      <td>{r.finished}</td>
                      <td>{r.starters > 0 ? fmtPct(r.finishRate) : '—'}</td>
                      <td>{r.dnf}</td>
                      <td>{r.starters > 0 && r.dnf > 0 ? fmtPct(r.dnfRate) : '—'}</td>
                      <td>{r.dns}</td>
                      <td>{r.total > 0 && r.dns > 0 ? fmtPct(r.dnsRate) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {atrInsights.length > 0 && <InsightCallout insights={atrInsights} />}
      </div>
    </section>
  );
}

function CrossEventSection({ crossEvent }: { crossEvent: ResultsCrossEventStats }) {
  const { theme } = useTheme();

  type PerfMetric = 'fastestSeconds' | 'medianSeconds' | 'lastSeconds' | 'avgPaceSecsPerMile' | 'medianPaceSecsPerMile';
  type DistMetric = 'farthestMiles' | 'meanMiles' | 'medianMiles' | 'shortestMiles';

  const [perfGroup, setPerfGroup]   = useState<'time' | 'pace'>('pace');
  const [perfMetric, setPerfMetric] = useState<PerfMetric>('medianPaceSecsPerMile');
  const [distMetric, setDistMetric] = useState<DistMetric>('farthestMiles');
  const [perfTab, setPerfTab]       = useState<'charts' | 'table'>('charts');

  if (crossEvent.rows.length === 0) return null;

  const hasFixedDist    = crossEvent.rows.some(r => r.eventType === 'fixed-distance');
  const hasFixedTime    = crossEvent.rows.some(r => r.eventType === 'fixed-time');
  const hasTimePerfData = crossEvent.rows.some(r => r.fastestSeconds != null && Number.isFinite(r.fastestSeconds));
  const hasPacePerfData = crossEvent.rows.some(r => r.medianPaceSecsPerMile != null && Number.isFinite(r.medianPaceSecsPerMile));
  const hasDistPerfData = crossEvent.rows.some(r => r.farthestMiles != null && Number.isFinite(r.farthestMiles));
  const hasPerfTab      = hasFixedDist && (hasTimePerfData || hasPacePerfData);
  const hasDistTab      = hasFixedTime && hasDistPerfData;
  const barH    = Math.max(220, crossEvent.rows.length * 52 + 44);
  const barColor = chartPalette(theme, 3)[0];

  if (!hasPerfTab && !hasDistTab) return null;

  const perfData = crossEvent.rows.map(row => ({
    name: row.name,
    fastestSeconds: row.fastestSeconds, medianSeconds: row.medianSeconds, lastSeconds: row.lastSeconds,
    avgPaceSecsPerMile: row.avgPaceSecsPerMile, medianPaceSecsPerMile: row.medianPaceSecsPerMile,
  }));

  const distData = crossEvent.rows.map(row => ({
    name: row.name,
    farthestMiles: row.farthestMiles, meanMiles: row.meanMiles,
    medianMiles: row.medianMiles, shortestMiles: row.shortestMiles,
  }));

  function fmtPerf(m: PerfMetric, v: number): string {
    return (m === 'avgPaceSecsPerMile' || m === 'medianPaceSecsPerMile') ? fmtPace(v) : fmtTime(Math.round(v));
  }

  function switchPerfGroup(g: 'time' | 'pace') {
    setPerfGroup(g);
    if (g === 'time' && (perfMetric === 'avgPaceSecsPerMile' || perfMetric === 'medianPaceSecsPerMile')) {
      setPerfMetric('medianSeconds');
    }
    if (g === 'pace' && perfMetric !== 'avgPaceSecsPerMile' && perfMetric !== 'medianPaceSecsPerMile') {
      setPerfMetric('medianPaceSecsPerMile');
    }
  }

  // Clamp perfMetric to available data (guards against initial state when only pace data exists)
  const activeMetric: PerfMetric =
    (perfMetric !== 'avgPaceSecsPerMile' && perfMetric !== 'medianPaceSecsPerMile' && !hasTimePerfData)
      ? 'medianPaceSecsPerMile'
      : (perfMetric === 'avgPaceSecsPerMile' || perfMetric === 'medianPaceSecsPerMile') && !hasPacePerfData
        ? 'medianSeconds'
        : perfMetric;
  const performanceIntro = hasPacePerfData
    ? 'Compare performance across race distances. Pace is the default view because it normalizes finish performance across events of different lengths.'
    : 'Compare performance across race events using the available event-level performance metrics.';
  const scopeNote = 'Cross-event view: compares all events and is not affected by the selected event control.';

  return (
    <section className="chart-section" aria-labelledby="rr-cross-heading">
      <SectionHeader title="Cross-Event Performance" />
      <p className="ce-performance-intro">{performanceIntro}</p>
      <p className="rr-cross-event-scope-note">{scopeNote}</p>

      <div className="ce-subsection">
          <div className="ce-performance-toolbar" aria-label="Cross-event performance controls">
            <div className="ce-control-row">
              <span className="ce-control-label">View:</span>
              <div className="metric-pills" role="group" aria-label="Performance view">
            {(['charts', 'table'] as const).map(id => (
              <button key={id} type="button"
                aria-pressed={perfTab === id}
                className={`metric-pill${perfTab === id ? ' metric-pill--active' : ''}`}
                onClick={() => setPerfTab(id)}
              >
                {id === 'charts' ? 'Charts' : 'Table'}
              </button>
            ))}
              </div>
            </div>
            {perfTab === 'charts' && hasPerfTab && hasTimePerfData && hasPacePerfData && (
              <div className="ce-control-row">
                <span className="ce-control-label">Type:</span>
                <div className="metric-pills" role="group" aria-label="Performance type">
                  <button type="button"
                    className={`metric-pill${perfGroup === 'pace' ? ' metric-pill--active' : ''}`}
                    aria-pressed={perfGroup === 'pace'}
                    onClick={() => switchPerfGroup('pace')}
                  >Pace</button>
                  <button type="button"
                    className={`metric-pill${perfGroup === 'time' ? ' metric-pill--active' : ''}`}
                    aria-pressed={perfGroup === 'time'}
                    onClick={() => switchPerfGroup('time')}
                  >Time</button>
                </div>
              </div>
            )}
            {perfTab === 'charts' && hasTimePerfData && (perfGroup === 'time' || !hasPacePerfData) && (
              <div className="ce-control-row">
                <span className="ce-control-label">Metric:</span>
                <div className="metric-pills" role="group" aria-label="Time metric">
                  {([
                    ['fastestSeconds', 'Fastest Time'],
                    ['medianSeconds',  'Median Time'],
                    ['lastSeconds',    'Last Finisher'],
                  ] as const).map(([m, label]) => (
                    <button key={m} type="button"
                      className={`metric-pill${activeMetric === m ? ' metric-pill--active' : ''}`}
                      aria-pressed={activeMetric === m}
                      onClick={() => setPerfMetric(m)}
                    >{label}</button>
                  ))}
                </div>
              </div>
            )}
            {perfTab === 'charts' && hasPacePerfData && (perfGroup === 'pace' || !hasTimePerfData) && (
              <div className="ce-control-row">
                <span className="ce-control-label">Metric:</span>
                <div className="metric-pills" role="group" aria-label="Pace metric">
                  {([
                    ['avgPaceSecsPerMile',    'Average Pace'],
                    ['medianPaceSecsPerMile', 'Median Pace'],
                  ] as const).map(([m, label]) => (
                    <button key={m} type="button"
                      className={`metric-pill${activeMetric === m ? ' metric-pill--active' : ''}`}
                      aria-pressed={activeMetric === m}
                      onClick={() => setPerfMetric(m)}
                    >{label}</button>
                  ))}
                </div>
              </div>
            )}
            {perfTab === 'charts' && hasDistTab && (
              <div className="ce-control-row">
                <span className="ce-control-label">Metric:</span>
                <div className="metric-pills" role="group" aria-label="Distance metric">
                  {([
                    ['farthestMiles', 'Longest'],
                    ['meanMiles',     'Average'],
                    ['medianMiles',   'Median'],
                    ['shortestMiles', 'Shortest'],
                  ] as const).map(([m, label]) => (
                    <button key={m} type="button"
                      className={`metric-pill${distMetric === m ? ' metric-pill--active' : ''}`}
                      aria-pressed={distMetric === m}
                      onClick={() => setDistMetric(m)}
                    >{label}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {perfTab === 'charts' && (
            <div role="tabpanel" className="rd-tab-panel">
              {/* Fixed-distance: Type/Metric controls + chart */}
              {hasPerfTab && (
                <>
                  <div className="chart-wrap chart-wrap--full" aria-hidden="true">
                    <ResponsiveContainer width="100%" height={barH}>
                      <BarChart layout="vertical" data={perfData} barCategoryGap="20%"
                        margin={{ top: 4, right: 116, bottom: 4, left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }}
                          tickFormatter={(v: number) => fmtPerf(activeMetric, v)} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                        <Tooltip contentStyle={{ fontSize: '0.8rem' }}
                          formatter={(v: number) => fmtPerf(activeMetric, v)} />
                        <Bar dataKey={activeMetric} fill={barColor} radius={[0, 3, 3, 0]} maxBarSize={56}>
                          <LabelList dataKey={activeMetric} position="right"
                            formatter={(v: unknown) => typeof v === 'number' ? fmtPerf(activeMetric, v) : ''}
                            style={{ fontSize: '0.72rem', fill: '#555' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}

              {/* Fixed-time: Distance metric controls + chart */}
              {hasDistTab && (
                <>
                  <div className="chart-wrap chart-wrap--full" aria-hidden="true">
                    <ResponsiveContainer width="100%" height={barH}>
                      <BarChart layout="vertical" data={distData} barCategoryGap="20%"
                        margin={{ top: 4, right: 116, bottom: 4, left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmtDist(v)} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                        <Tooltip contentStyle={{ fontSize: '0.8rem' }} formatter={(v: number) => fmtDist(v)} />
                        <Bar dataKey={distMetric} fill={barColor} radius={[0, 3, 3, 0]} maxBarSize={56}>
                          <LabelList dataKey={distMetric} position="right"
                            formatter={(v: unknown) => typeof v === 'number' ? fmtDist(v) : ''}
                            style={{ fontSize: '0.72rem', fill: '#555' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>
          )}

          {perfTab === 'table' && (
            <div role="tabpanel" className="rd-tab-panel">
              <p className="rr-field-depth-gender-note">Scroll horizontally to view all event metrics.</p>
              <div className="rr-agp-table-wrap">
                <table className="stats-table">
                  <caption className="sr-only">Performance comparison across events</caption>
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Male %</th><th>Female %</th><th>NB %</th><th>Avg Age</th>
                      {hasFixedDist && hasTimePerfData && <><th>Fastest Time</th><th>Median Time</th><th>Last Finisher</th></>}
                      {hasFixedDist && hasPacePerfData && <><th>Avg Pace</th><th>Median Pace</th></>}
                      {hasFixedTime && hasDistPerfData && <><th>Longest</th><th>Median Dist</th><th>Avg Dist</th><th>Shortest</th><th>Spread</th></>}
                    </tr>
                  </thead>
                  <tbody>
                    {crossEvent.rows.map(row => (
                      <tr key={row.name}>
                        <td style={{ fontWeight: 600 }}>{row.name}</td>
                        <td>{row.maleFinishers > 0 ? fmtPct(row.malePercent) : '—'}</td>
                        <td>{row.femaleFinishers > 0 ? fmtPct(row.femalePercent) : '—'}</td>
                        <td>{row.nonBinaryFinishers > 0 ? fmtPct(row.nonBinaryPercent) : '—'}</td>
                        <td>{row.avgAge != null ? row.avgAge.toFixed(1) : '—'}</td>
                        {hasFixedDist && hasTimePerfData && (
                          <>
                            <td>{row.fastestSeconds != null ? fmtTime(row.fastestSeconds) : '—'}</td>
                            <td>{row.medianSeconds  != null ? fmtTime(row.medianSeconds)  : '—'}</td>
                            <td>{row.lastSeconds    != null ? fmtTime(row.lastSeconds)    : '—'}</td>
                          </>
                        )}
                        {hasFixedDist && hasPacePerfData && (
                          <>
                            <td>{row.avgPaceSecsPerMile    != null ? fmtPace(row.avgPaceSecsPerMile)    : '—'}</td>
                            <td>{row.medianPaceSecsPerMile != null ? fmtPace(row.medianPaceSecsPerMile) : '—'}</td>
                          </>
                        )}
                        {hasFixedTime && hasDistPerfData && (
                          <>
                            <td>{row.farthestMiles != null ? fmtDist(row.farthestMiles) : '—'}</td>
                            <td>{row.medianMiles   != null ? fmtDist(row.medianMiles)   : '—'}</td>
                            <td>{row.meanMiles     != null ? fmtDist(row.meanMiles)     : '—'}</td>
                            <td>{row.shortestMiles != null ? fmtDist(row.shortestMiles) : '—'}</td>
                            <td>{row.spreadMiles   != null ? fmtDist(row.spreadMiles)   : '—'}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
      </div>
    </section>
  );
}

function AgeGroupPerformanceSection({
  agp,
  ageGroupPerformanceByEvent,
  selectedEventName,
  showSelectedEventContext = true,
}: {
  agp: AgeGroupPerformanceStats;
  ageGroupPerformanceByEvent?: AgeGroupPerformanceByEvent[];
  selectedEventName: string | null;
  showSelectedEventContext?: boolean;
}) {
  const [agpTab, setAgpTab]       = useState<'charts' | 'table'>('charts');
  const [agpMetric, setAgpMetric] = useState<'finishers' | 'performance'>('finishers');
  const { theme } = useTheme();
  const gc = genderColors(theme);
  const overallColor = theme.primary;
  const perfGenderColors = {
    M: '#2563eb',
    F: '#15803d',
    NB: '#7c3aed',
  };

  const byEvent = ageGroupPerformanceByEvent ?? [];
  const activeEventIdx = activeByEventIdx(byEvent, selectedEventName);
  const activeEvent = byEvent[activeEventIdx];
  const rows = activeEvent?.rows ?? agp.rows;
  const eventType = activeEvent?.eventType ?? agp.eventType;
  const isFixedDist = eventType === 'fixed-distance';
  const hasPerfData = rows.some(r => isFixedDist ? r.medianPaceSecsPerMile !== null : r.medianMiles !== null);
  const hasSmallGroup = rows.some(r => r.total < 5);

  const eligible = rows.filter(r => r.total >= 5);
  const best  = eligible.length > 0 ? eligible.reduce((a, b) => b.finishRate > a.finishRate ? b : a) : null;
  const worst = eligible.length > 0 ? eligible.reduce((a, b) => b.finishRate < a.finishRate ? b : a) : null;
  const insights: string[] = [];
  if (best && worst && best.ageGroup !== worst.ageGroup) {
    insights.push(
      `${best.ageGroup} had the highest finish rate at ${fmtPct(best.finishRate)} (${best.finishers} finishers), ` +
      `while ${worst.ageGroup} had the lowest at ${fmtPct(worst.finishRate)} (${worst.finishers} finishers).`
    );
  }
  if (hasSmallGroup) {
    insights.push('Small age groups can swing sharply; review counts alongside rates.');
  }

  const metricLabel: Record<'finishers' | 'performance', string> = {
    finishers:   'Finishers',
    performance: isFixedDist ? 'Pace' : 'Distance',
  };

  const activeMetric = agpMetric === 'performance' && !hasPerfData ? 'finishers' : agpMetric;

  // Gender series visibility for Finishers chart — driven by finisher counts
  const showMale   = rows.some(r => r.maleFinishers > 0);
  const showFemale = rows.some(r => r.femaleFinishers > 0);
  const showNb     = rows.some(r => r.nonBinaryFinishers > 0);

  // NB visibility for Pace/Distance chart — show if NB finishers exist anywhere, or if any NB
  // pace/distance value is non-null. Null values produce no bar for that row; they don't
  // suppress the whole series. A gender may appear in Finishers but have no pace bars.
  const showNbPerf = rows.some(r =>
    r.nonBinaryFinishers > 0 ||
    (isFixedDist ? r.nonBinaryPaceSecsPerMile !== null : r.nonBinaryMiles !== null),
  );
  // Whether any NB pace/distance value is non-null — used to decide whether to show a quiet note.
  const nbHasPerfData = rows.some(r => isFixedDist ? r.nonBinaryPaceSecsPerMile !== null : r.nonBinaryMiles !== null);

  // Stacked finisher count data — Total key is used for the end label on the outermost bar
  const finisherData = rows.map(r => ({
    ageGroup:     r.ageGroup,
    Male:         r.maleFinishers,
    Female:       r.femaleFinishers,
    'Non-Binary': r.nonBinaryFinishers,
    Total:        r.maleFinishers + r.femaleFinishers + r.nonBinaryFinishers,
  }));
  // Determines which bar is outermost in the stack (drives the Total label position)
  const finisherLastKey = showNb ? 'Non-Binary' : showFemale ? 'Female' : 'Male';

  // Grouped pace/distance data (null values mean no finishers — Recharts skips null bars)
  const perfGroupedData = isFixedDist
    ? rows.map(r => ({
        ageGroup:     r.ageGroup,
        Overall:      r.medianPaceSecsPerMile,
        Male:         r.malePaceSecsPerMile,
        Female:       r.femalePaceSecsPerMile,
        'Non-Binary': r.nonBinaryPaceSecsPerMile,
      }))
    : rows.map(r => ({
        ageGroup:     r.ageGroup,
        Overall:      r.medianMiles,
        Male:         r.maleMiles,
        Female:       r.femaleMiles,
        'Non-Binary': r.nonBinaryMiles,
      }));

  const perfFmt = isFixedDist ? fmtPace : fmtDist;

  const finisherSeries = (showMale ? 1 : 0) + (showFemale ? 1 : 0) + (showNb ? 1 : 0);
  const perfSeries = 1 + (showMale ? 1 : 0) + (showFemale ? 1 : 0) + (showNbPerf ? 1 : 0);

  // Finisher chart: stacked — one bar slot per category regardless of gender count
  const finisherChartHeight = Math.max(240, rows.length * 44) + 40;
  // Performance chart: grouped — drive height from explicit bar size so bars are visibly thick.
  // barCategoryGap={12} (px, set on BarChart) controls the fixed gap between age-group clusters.
  // perfCluster is the height of one cluster (bars + barGap gaps); adding barCategoryGap gives the
  // full band height per row, so the computed chart height always accommodates the desired barSize.
  const PERF_BAR_SIZE = 16;
  const perfCluster = perfSeries * (PERF_BAR_SIZE + 4) - 4; // bars + barGap(4) between each
  const perfChartHeight = Math.max(280, rows.length * (perfCluster + 12)) + 64;
  const chartHeight = activeMetric === 'finishers' ? finisherChartHeight : perfChartHeight;

  return (
    <section className="chart-section" aria-labelledby="rr-agp-heading">
      <SectionHeader
        title="Age Group Performance"
        contextStrip={showSelectedEventContext ? <SelectedEventContext eventName={activeEvent?.eventName ?? selectedEventName} /> : undefined}
      />

      <div className="rd-tab-strip" role="tablist" aria-label="Age group performance views">
        {(['charts', 'table'] as const).map(id => (
          <button key={id} type="button" role="tab"
            aria-selected={agpTab === id}
            className={`rd-tab${agpTab === id ? ' rd-tab--active' : ''}`}
            onClick={() => setAgpTab(id)}
          >
            {id.charAt(0).toUpperCase() + id.slice(1)}
          </button>
        ))}
      </div>

      {agpTab === 'charts' && (
        <div role="tabpanel" className="rd-tab-panel">
          <div className="metric-pills" role="group" aria-label="Select chart metric">
            {(['finishers', 'performance'] as const).map(m => (
              <button key={m} type="button"
                className={`metric-pill${agpMetric === m ? ' metric-pill--active' : ''}${m === 'performance' && !hasPerfData ? ' metric-pill--disabled' : ''}`}
                onClick={() => { if (m !== 'performance' || hasPerfData) setAgpMetric(m); }}
                aria-pressed={agpMetric === m}
                disabled={m === 'performance' && !hasPerfData}
              >
                {metricLabel[m]}
              </button>
            ))}
          </div>

          {activeMetric === 'finishers' && (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={finisherData} layout="vertical" margin={{ top: 8, right: 56, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="ageGroup" tick={{ fontSize: 12 }} width={68} />
                <Tooltip formatter={(v: number) => v.toLocaleString()} contentStyle={{ fontSize: '0.8rem' }} />
                <Legend verticalAlign="top" iconType="square" wrapperStyle={{ fontSize: '0.8rem', paddingBottom: '0.25rem' }} />
                {showMale && (
                  <Bar dataKey="Male" stackId="f" fill={gc.M} radius={finisherLastKey === 'Male' ? [0, 3, 3, 0] : [0, 0, 0, 0]}>
                    {finisherLastKey === 'Male' && (
                      <LabelList dataKey="Total" position="right" formatter={(v: unknown) => typeof v === 'number' && v > 0 ? v.toLocaleString() : ''} style={{ fontSize: 11 }} />
                    )}
                  </Bar>
                )}
                {showFemale && (
                  <Bar dataKey="Female" stackId="f" fill={gc.F} radius={finisherLastKey === 'Female' ? [0, 3, 3, 0] : [0, 0, 0, 0]}>
                    {finisherLastKey === 'Female' && (
                      <LabelList dataKey="Total" position="right" formatter={(v: unknown) => typeof v === 'number' && v > 0 ? v.toLocaleString() : ''} style={{ fontSize: 11 }} />
                    )}
                  </Bar>
                )}
                {showNb && (
                  <Bar dataKey="Non-Binary" stackId="f" fill={gc.NB} radius={[0, 3, 3, 0]}>
                    <LabelList dataKey="Total" position="right" formatter={(v: unknown) => typeof v === 'number' && v > 0 ? v.toLocaleString() : ''} style={{ fontSize: 11 }} />
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer>
          )}

          {activeMetric === 'performance' && (
            <>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart data={perfGroupedData} layout="vertical" barCategoryGap={12} margin={{ top: 8, right: 96, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={false} />
                  <XAxis type="number" tickFormatter={perfFmt} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="ageGroup" tick={{ fontSize: 12 }} width={68} />
                  <Tooltip formatter={(v: number) => perfFmt(v)} contentStyle={{ fontSize: '0.8rem' }} />
                  <Legend verticalAlign="top" iconType="square" wrapperStyle={{ fontSize: '0.8rem', paddingBottom: '0.25rem' }} />
                  <Bar dataKey="Overall" barSize={PERF_BAR_SIZE} fill={overallColor} radius={[0, 3, 3, 0]}>
                    <LabelList dataKey="Overall" position="right" formatter={(v: unknown) => typeof v === 'number' ? perfFmt(v) : ''} style={{ fontSize: 11 }} />
                  </Bar>
                  {showMale   && <Bar dataKey="Male"       barSize={PERF_BAR_SIZE} fill={perfGenderColors.M}  />}
                  {showFemale && <Bar dataKey="Female"     barSize={PERF_BAR_SIZE} fill={perfGenderColors.F}  />}
                  {showNbPerf && <Bar dataKey="Non-Binary" barSize={PERF_BAR_SIZE} fill={perfGenderColors.NB} />}
                </BarChart>
              </ResponsiveContainer>
              {showNbPerf && !nbHasPerfData && (
                <p className="rr-field-depth-gender-note">Non-Binary pace/distance bars appear where valid finisher data is available.</p>
              )}
            </>
          )}
        </div>
      )}

      {agpTab === 'table' && (
        <div role="tabpanel" className="rd-tab-panel">
          <div className="rr-agp-table-wrap">
            <table className="stats-table rr-gender-time-table">
              <caption className="sr-only">Age group performance breakdown</caption>
              <thead>
                <tr>
                  <th>Age Group</th>
                  <th>Total</th>
                  <th>Finishers</th>
                  <th>Finish %</th>
                  <th>DNF</th>
                  <th>DNF %</th>
                  <th>DNS</th>
                  <th>DNS %</th>
                  {isFixedDist
                    ? <><th>Median Pace</th><th>Fastest</th><th>Last finisher</th></>
                    : <><th>Median Distance</th><th>Longest</th><th>Shortest</th></>
                  }
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.ageGroup}>
                    <td>{r.ageGroup}</td>
                    <td>{r.total}</td>
                    <td>{r.finishers}</td>
                    <td>{fmtPct(r.finishRate)}</td>
                    <td>{r.dnf}</td>
                    <td>{fmtPct(r.dnfRate)}</td>
                    <td>{r.dns}</td>
                    <td>{fmtPct(r.dnsRate)}</td>
                    {isFixedDist ? (
                      <>
                        <td>{r.medianPaceSecsPerMile !== null ? fmtPace(r.medianPaceSecsPerMile) : '—'}</td>
                        <td>{r.fastestPaceSecsPerMile !== null ? fmtPace(r.fastestPaceSecsPerMile) : '—'}</td>
                        <td>{r.slowestPaceSecsPerMile !== null ? fmtPace(r.slowestPaceSecsPerMile) : '—'}</td>
                      </>
                    ) : (
                      <>
                        <td>{r.medianMiles !== null ? fmtDist(r.medianMiles) : '—'}</td>
                        <td>{r.maxMiles !== null ? fmtDist(r.maxMiles) : '—'}</td>
                        <td>{r.minMiles !== null ? fmtDist(r.minMiles) : '—'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {insights.length > 0 && <InsightCallout insights={insights} />}
    </section>
  );
}

function FieldDepthSection({
  pb,
  selectedEventName,
  showSelectedEventContext = true,
}: {
  pb: PerformanceBandStats;
  selectedEventName: string | null;
  showSelectedEventContext?: boolean;
}) {
  const [fdTab, setFdTab]       = useState<'charts' | 'table'>('charts');
  const [fdMetric, setFdMetric] = useState<string>('medianTime');
  const { theme } = useTheme();

  const fieldDepthEvents = pb.events.length > 0
    ? pb.events
    : [{ eventName: 'Event', rows: pb.rows, eventType: pb.eventType, totalFinishers: pb.totalFinishers }];
  const matchedEventIdx = selectedEventName
    ? fieldDepthEvents.findIndex(ev => ev.eventName === selectedEventName)
    : -1;
  const selectedEventMissingBands = !!selectedEventName && matchedEventIdx < 0 && pb.events.length > 0;
  const activeEventIdx = selectedEventMissingBands ? 0 : activeByEventIdx(fieldDepthEvents, selectedEventName);
  const activeEvent = fieldDepthEvents[activeEventIdx];

  if (selectedEventMissingBands) {
    return (
      <section className="chart-section" aria-labelledby="rr-field-depth-heading">
        <SectionHeader
          title="Advanced Field Analysis"
          contextStrip={showSelectedEventContext ? <SelectedEventContext eventName={selectedEventName} /> : undefined}
        />
        <p className="rr-perf-intro">Advanced field analysis is not available for the selected event.</p>
      </section>
    );
  }

  const rows = activeEvent.rows;
  const isFixedDist = activeEvent.eventType === 'fixed-distance';
  const smallField = activeEvent.totalFinishers < 20;
  const activeEventName = activeEvent.eventName;

  const front25 = rows.find(r => r.label === 'Front 25%');
  const back25  = rows.find(r => r.label === 'Back 25%');
  const insights: string[] = [];

  if (front25 && back25) {
    if (isFixedDist && front25.medianSeconds !== null && back25.medianSeconds !== null) {
      const diffSecs = back25.medianSeconds - front25.medianSeconds;
      insights.push(
        `For ${activeEventName}, median finish time differs by ${fmtTime(diffSecs)} between the Front 25% (${fmtTime(front25.medianSeconds)}) and Back 25% (${fmtTime(back25.medianSeconds)}).`
      );
    } else if (!isFixedDist && front25.medianMiles !== null && back25.medianMiles !== null) {
      const diffMi = front25.medianMiles - back25.medianMiles;
      insights.push(
        `For ${activeEventName}, median distance differs by ${fmtDist(diffMi)} between the Front 25% (${fmtDist(front25.medianMiles)}) and Back 25% (${fmtDist(back25.medianMiles)}).`
      );
    }
  }
  if (smallField) {
    insights.push('Field is small (fewer than 20 finishers); band percentages may shift noticeably with a few results.');
  }

  const overlapNote = isFixedDist
    ? 'Advanced Field Analysis compares front, middle, and back-of-pack finisher groups. Use this section to understand field spread and performance depth within the selected event. Front/Back 10% are included within Front/Back 25%, giving both a narrow and broader view of each end of the field.'
    : 'Advanced Field Analysis compares front, middle, and back-of-pack finisher groups by distance achieved. Use this section to understand field spread and performance depth within the selected event. Front/Back 10% are included within Front/Back 25%, giving both a narrow and broader view of each end of the field.';

  // Metric pill definitions
  type FdMetric = 'medianTime' | 'medianPace' | 'medianDistance';
  const allPills: Array<{ key: FdMetric; label: string; show: boolean }> = [
    { key: 'medianTime',     label: 'Median Time',     show: isFixedDist },
    { key: 'medianPace',     label: 'Median Pace',     show: isFixedDist && rows.some(r => r.medianPaceSecsPerMile !== null) },
    { key: 'medianDistance', label: 'Median Distance', show: !isFixedDist },
  ];
  const pills = allPills.filter(p => p.show);

  // Ensure active metric is valid for this event type
  const validKeys = pills.map(p => p.key);
  const defaultMetric: FdMetric = isFixedDist ? 'medianTime' : 'medianDistance';
  const activeMetric: FdMetric = validKeys.includes(fdMetric as FdMetric) ? (fdMetric as FdMetric) : defaultMetric;

  // Single-bar chart config
  let singleBarKey = '';
  let singleFmt: (v: number) => string = v => String(v);
  let singleData: Array<{ label: string; [k: string]: number | string | null }> = [];

  if (activeMetric === 'medianTime') {
    singleBarKey = 'Median Time';
    singleFmt = v => fmtTime(v);
    singleData = rows.filter(r => r.medianSeconds !== null).map(r => ({ label: r.label, [singleBarKey]: r.medianSeconds! }));
  } else if (activeMetric === 'medianPace') {
    singleBarKey = 'Median Pace';
    singleFmt = v => fmtPace(v);
    singleData = rows.filter(r => r.medianPaceSecsPerMile !== null).map(r => ({ label: r.label, [singleBarKey]: r.medianPaceSecsPerMile! }));
  } else if (activeMetric === 'medianDistance') {
    singleBarKey = 'Median Distance';
    singleFmt = v => fmtDist(v);
    singleData = rows.filter(r => r.medianMiles !== null).map(r => ({ label: r.label, [singleBarKey]: r.medianMiles! }));
  }

  const chartHeight = Math.max(200, rows.length * 48) + 40;

  return (
    <section className="chart-section" aria-labelledby="rr-field-depth-heading">
      <SectionHeader
        title="Advanced Field Analysis"
        contextStrip={showSelectedEventContext ? <SelectedEventContext eventName={activeEventName} /> : undefined}
      />
      <p className="rr-perf-intro">{overlapNote}</p>
      {insights.length > 0 && <InsightCallout insights={insights} />}

      <div className="rd-tab-strip" role="tablist" aria-label="Field depth views">
        {(['charts', 'table'] as const).map(id => (
          <button key={id} type="button" role="tab"
            aria-selected={fdTab === id}
            className={`rd-tab${fdTab === id ? ' rd-tab--active' : ''}`}
            onClick={() => setFdTab(id)}
          >
            {id.charAt(0).toUpperCase() + id.slice(1)}
          </button>
        ))}
      </div>

      {fdTab === 'charts' && (
        <div role="tabpanel" className="rd-tab-panel">
          <div className="rr-field-depth-metric-row">
            <span className="rr-field-depth-metric-label">Chart metric:</span>
            <div className="metric-pills" role="group" aria-label="Select chart metric">
              {pills.map(p => (
                <button key={p.key} type="button"
                  className={`metric-pill${activeMetric === p.key ? ' metric-pill--active' : ''}`}
                  onClick={() => setFdMetric(p.key)}
                  aria-pressed={activeMetric === p.key}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={singleData} layout="vertical" margin={{ top: 8, right: 96, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={false} />
              <XAxis type="number" tickFormatter={singleFmt} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={72} />
              <Tooltip formatter={(v: number) => singleFmt(v)} />
              <Bar dataKey={singleBarKey} fill={chartPalette(theme, 1)[0]} radius={[0, 3, 3, 0]}>
                <LabelList dataKey={singleBarKey} position="right"
                  formatter={(v: unknown) => typeof v === 'number' ? singleFmt(v) : ''}
                  style={{ fontSize: 11 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {fdTab === 'table' && (
        <div role="tabpanel" className="rd-tab-panel">
          <div className="rr-agp-table-wrap">
            <table className="stats-table rr-gender-time-table">
              <caption className="sr-only">Field depth performance bands</caption>
              <thead>
                <tr>
                  <th>Band</th>
                  <th>Finishers</th>
                  <th>% of Field</th>
	                  {isFixedDist ? (
	                    <>
	                      <th>Fastest Time</th>
	                      <th>Median Time</th>
	                      <th>Median Pace</th>
	                      <th>Last Finisher</th>
	                    </>
	                  ) : (
	                    <>
	                      <th>Farthest Distance</th>
	                      <th>Median Distance</th>
	                      <th>Shortest Distance</th>
	                    </>
	                  )}
	                  <th>Median Age</th>
	                  <th>Gender Mix (M/F/NB)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    <td>{r.finishers}</td>
                    <td>{r.percentOfFinishers.toFixed(1)}%</td>
                    {isFixedDist ? (
                      <>
                        <td>{r.fastestSeconds !== null ? fmtTime(r.fastestSeconds) : '—'}</td>
                        <td>{r.medianSeconds !== null ? fmtTime(r.medianSeconds) : '—'}</td>
                        <td>{r.medianPaceSecsPerMile !== null ? fmtPace(r.medianPaceSecsPerMile) : '—'}</td>
                        <td>{r.slowestSeconds !== null ? fmtTime(r.slowestSeconds) : '—'}</td>
                      </>
                    ) : (
                      <>
                        <td>{r.farthestMiles !== null ? fmtDist(r.farthestMiles) : '—'}</td>
                        <td>{r.medianMiles !== null ? fmtDist(r.medianMiles) : '—'}</td>
                        <td>{r.shortestMiles !== null ? fmtDist(r.shortestMiles) : '—'}</td>
                      </>
                    )}
                    <td>{r.medianAge !== null ? r.medianAge.toFixed(0) : '—'}</td>
                    <td>{r.maleFinishers} / {r.femaleFinishers} / {r.nonBinaryFinishers}</td>
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

function DivisionPerformanceSection({
  dp,
  divisionPerformanceByEvent,
  selectedEventName,
  showSelectedEventContext = true,
}: {
  dp: DivisionPerformanceStats;
  divisionPerformanceByEvent?: DivisionPerformanceByEvent[];
  selectedEventName: string | null;
  showSelectedEventContext?: boolean;
}) {
  const [dpTab, setDpTab]       = useState<'charts' | 'table'>('charts');
  const [dpMetric, setDpMetric] = useState<'finishRate' | 'performance'>('finishRate');
  const { theme } = useTheme();

  const byEvent = divisionPerformanceByEvent ?? [];
  const activeEventIdx = activeByEventIdx(byEvent, selectedEventName);
  const activeEvent = byEvent[activeEventIdx];
  const rawRows = activeEvent?.rows ?? dp.rows;
  const divisionSortKey = (division: string): [number, number, string] => {
    const normalized = division.toLowerCase();
    const genderRank = normalized.startsWith('male ')
      ? 0
      : normalized.startsWith('female ')
        ? 1
        : normalized.startsWith('non-binary ')
          ? 2
          : 3;
    const ageRank =
      /under\s*20|0[–-]19/.test(normalized) ? 0 :
      /20[–-]29/.test(normalized) ? 1 :
      /30[–-]39/.test(normalized) ? 2 :
      /40[–-]49/.test(normalized) ? 3 :
      /50[–-]59/.test(normalized) ? 4 :
      /60[–-]69/.test(normalized) ? 5 :
      /70\+/.test(normalized) ? 6 :
      7;
    return [genderRank, ageRank, division];
  };
  const rows = [...rawRows].sort((a, b) => {
    const aKey = divisionSortKey(a.division);
    const bKey = divisionSortKey(b.division);
    return aKey[0] - bKey[0] || aKey[1] - bKey[1] || aKey[2].localeCompare(bKey[2]);
  });
  const eventType = activeEvent?.eventType ?? dp.eventType;
  const isFixedDist = eventType === 'fixed-distance';
  const hasPerfData = rows.some(r => isFixedDist ? r.medianPaceSecsPerMile !== null : r.medianMiles !== null);
  const hasSmallGroup = rows.some(r => r.total < 5);

  const eligible = rows.filter(r => r.total >= 5);
  const best  = eligible.length > 0 ? eligible.reduce((a, b) => b.finishRate > a.finishRate ? b : a) : null;
  const worst = eligible.length > 0 ? eligible.reduce((a, b) => b.finishRate < a.finishRate ? b : a) : null;
  const insights: string[] = [];
  if (best && worst && best.division !== worst.division) {
    insights.push(
      `${best.division} had the highest finish rate at ${fmtPct(best.finishRate)} (${best.finishers} finishers), ` +
      `while ${worst.division} had the lowest at ${fmtPct(worst.finishRate)} (${worst.finishers} finishers).`
    );
  }
  if (hasSmallGroup) {
    insights.push('Small divisions (fewer than 5 participants) can swing sharply; review counts alongside rates.');
  }

  type MetricKey = 'finishRate' | 'performance';
  const metricLabel: Record<MetricKey, string> = {
    finishRate:  'Finish Rate',
    performance: isFixedDist ? 'Pace' : 'Distance',
  };

  const activeMetric = dpMetric === 'performance' && !hasPerfData ? 'finishRate' : dpMetric;

  type ChartRow = { division: string; value: number | null };
  let singleData: ChartRow[] = [];
  let singleFmt: (v: number) => string = v => String(v);
  let singleBarKey = '';

  if (activeMetric === 'finishRate') {
    singleData   = rows.map(r => ({ division: r.division, value: r.finishRate }));
    singleFmt    = v => `${v.toFixed(1)}%`;
    singleBarKey = 'Finish Rate';
  } else if (activeMetric === 'performance') {
    if (isFixedDist) {
      singleData   = rows.map(r => ({ division: r.division, value: r.medianPaceSecsPerMile }));
      singleFmt    = v => fmtPace(v);
      singleBarKey = 'Median Pace';
    } else {
      singleData   = rows.map(r => ({ division: r.division, value: r.medianMiles }));
      singleFmt    = v => fmtDist(v);
      singleBarKey = 'Median Distance';
    }
  }

  const singleBarData = singleData
    .filter(d => d.value !== null)
    .map(d => ({ division: d.division, [singleBarKey]: d.value }));

  const chartHeight = Math.max(180, rows.length * 34) + 36;

  return (
    <section className="chart-section rr-division-performance-section" aria-labelledby="rr-div-perf-heading">
      <SectionHeader
        title="Division Performance"
        contextStrip={showSelectedEventContext ? <SelectedEventContext eventName={activeEvent?.eventName ?? selectedEventName} /> : undefined}
      />
      <p className="rr-section-helper">Award-style divisions combine gender and age group for a closer look at category-level performance.</p>

      <div className="rd-tab-strip" role="tablist" aria-label="Division performance views">
        {(['charts', 'table'] as const).map(id => (
          <button key={id} type="button" role="tab"
            aria-selected={dpTab === id}
            className={`rd-tab${dpTab === id ? ' rd-tab--active' : ''}`}
            onClick={() => setDpTab(id)}
          >
            {id.charAt(0).toUpperCase() + id.slice(1)}
          </button>
        ))}
      </div>

      {dpTab === 'charts' && (
        <div role="tabpanel" className="rd-tab-panel">
          <div className="metric-pills" role="group" aria-label="Select chart metric">
            {(['finishRate', 'performance'] as const).map(m => (
              <button key={m} type="button"
                className={`metric-pill${dpMetric === m ? ' metric-pill--active' : ''}${m === 'performance' && !hasPerfData ? ' metric-pill--disabled' : ''}`}
                onClick={() => { if (m !== 'performance' || hasPerfData) setDpMetric(m); }}
                aria-pressed={dpMetric === m}
                disabled={m === 'performance' && !hasPerfData}
              >
                {metricLabel[m]}
              </button>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={singleBarData} layout="vertical" margin={{ top: 4, right: 88, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={false} />
              <XAxis type="number" tickFormatter={singleFmt} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="division" tick={{ fontSize: 12 }} width={90} />
              <Tooltip formatter={(v: number) => singleFmt(v)} />
              <Bar dataKey={singleBarKey} fill={chartPalette(theme, 1)[0]} radius={[0, 3, 3, 0]}>
                <LabelList dataKey={singleBarKey} position="right" formatter={(v: unknown) => typeof v === 'number' ? singleFmt(v) : ''} style={{ fontSize: 11 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {dpTab === 'table' && (
        <div role="tabpanel" className="rd-tab-panel">
          <div className="rr-agp-table-wrap">
            <table className="stats-table rr-gender-time-table">
              <caption className="sr-only">Division performance breakdown</caption>
              <thead>
                <tr>
                  <th>Division</th>
                  <th>Total</th>
                  <th>Finishers</th>
                  <th>Finish %</th>
                  <th>DNF</th>
                  <th>DNF %</th>
                  <th>DNS</th>
                  <th>DNS %</th>
                  {isFixedDist
                    ? <><th>Median Pace</th><th>Fastest</th><th>Last finisher</th></>
                    : <><th>Median Distance</th><th>Longest</th><th>Shortest</th></>
                  }
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.division}>
                    <td>{r.division}</td>
                    <td>{r.total}</td>
                    <td>{r.finishers}</td>
                    <td>{fmtPct(r.finishRate)}</td>
                    <td>{r.dnf}</td>
                    <td>{fmtPct(r.dnfRate)}</td>
                    <td>{r.dns}</td>
                    <td>{fmtPct(r.dnsRate)}</td>
                    {isFixedDist ? (
                      <>
                        <td>{r.medianPaceSecsPerMile !== null ? fmtPace(r.medianPaceSecsPerMile) : '—'}</td>
                        <td>{r.fastestPaceSecsPerMile !== null ? fmtPace(r.fastestPaceSecsPerMile) : '—'}</td>
                        <td>{r.slowestPaceSecsPerMile !== null ? fmtPace(r.slowestPaceSecsPerMile) : '—'}</td>
                      </>
                    ) : (
                      <>
                        <td>{r.medianMiles !== null ? fmtDist(r.medianMiles) : '—'}</td>
                        <td>{r.maxMiles !== null ? fmtDist(r.maxMiles) : '—'}</td>
                        <td>{r.minMiles !== null ? fmtDist(r.minMiles) : '—'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {insights.length > 0 && <InsightCallout insights={insights} />}
    </section>
  );
}

function FullStatsSections({
  stats,
  weather,
  selectedEventName,
  onSelectedEventChange,
}: {
  stats: ResultsStats;
  weather?: WeatherData;
  selectedEventName: string | null;
  onSelectedEventChange: (eventName: string) => void;
}) {
  const demoInsights = demographicsInsights(stats.demographics);
  const isSingleEventReport = stats.performance.events.length <= 1;
  const hasEventBreakdown = stats.crossEvent.rows.length > 1;
  const hasEventPerformanceComparison = hasEventBreakdown && hasCrossEventPerformance(stats.crossEvent);
  const hasAgeGroupPerformance = !!stats.ageGroupPerformance || stats.ageGroupPerformanceByEvent.length > 0;
  const hasDivisionPerformance = !!stats.divisionPerformance || stats.divisionPerformanceByEvent.length > 0;
  // selectedEventName comes from the report-level Selected Event selector.
  // Event-specific sections match by eventName and fall back to the first event
  // when the name is missing or stale. Overall and cross-event sections should
  // not blindly follow this selected-event scope.
  const ageDistributionByEvent = stats.ageDistributionByEvent ?? [];
  const activeAgeEventIdx = activeByEventIdx(ageDistributionByEvent, selectedEventName);
  const activeAgeEvent = ageDistributionByEvent[activeAgeEventIdx];
  const ageDistributionStats = activeAgeEvent?.finisherAge ?? stats.demographics.finisherAge;
  const ageDistributionInsights = activeAgeEvent ? undefined : demoInsights;
  const hasAgeDistribution = ageDistributionStats.mean !== null;
  const geographicDistributionByEvent = stats.geographicDistributionByEvent ?? [];
  const activeGeoEventIdx = activeByEventIdx(geographicDistributionByEvent, selectedEventName);
  const activeGeoEvent = geographicDistributionByEvent[activeGeoEventIdx];
  const geographicStats = activeGeoEvent?.geographic ?? stats.geographic;
  const activePerformanceEvent = stats.performance.events[activeByEventIdx(stats.performance.events, selectedEventName)];
  const performanceLinkLabel = activePerformanceEvent?.eventType === 'fixed-time' ? 'Distance Performance' : 'Finish Performance';
  return (
    <>
      <div id="rr-summary">
        <SummarySection
          summary={stats.summary}
          entrantGender={stats.demographics.gender}
          participantAge={stats.demographics.age}
          attrition={stats.attrition}
        />
      </div>
      {weather && <div id="rr-weather"><WeatherSection weather={weather} variant="summary" /></div>}
      {hasEventBreakdown && (
        <div id="rr-event-breakdown"><EventBreakdownSection attrition={stats.attrition} /></div>
      )}
      <div id="rr-overall-geography">
        <GeographicSection
          stats={stats.geographic}
          title="Overall Geography"
          showUnknownLocation
          basisNote="Geography reflects all race participants."
          insightsPosition="bottom"
          summaryMode="race-results"
        />
      </div>
      {!isSingleEventReport && (
        <div
          id="rr-report-controls"
          className="rr-report-controls no-print"
          aria-label="Report controls"
        >
          <div className="rr-selected-analysis-intro">
            <h2>Selected Event Analysis</h2>
            <p>Choose an event below to control the detailed sections that follow.</p>
          </div>
          <SelectedEventSelector
            events={stats.performance.events}
            selectedEventName={selectedEventName}
            onSelect={onSelectedEventChange}
          />
          <nav className="report-nav rr-report-nav" aria-label="Jump to section">
            <span className="rr-report-nav-label">Jump to:</span>
            <div className="rr-report-nav-links">
              <a href="#rr-event-snapshot" className="report-nav-link">Event Snapshot</a>
              {hasAgeDistribution && <a href="#rr-age" className="report-nav-link">Finisher Age Distribution</a>}
              <a href="#rr-performance" className="report-nav-link">{performanceLinkLabel}</a>
              {hasEventPerformanceComparison && <a href="#rr-cross-event" className="report-nav-link">Cross-Event Performance</a>}
              {hasAgeGroupPerformance && <a href="#rr-age-group-perf" className="report-nav-link">Age Group Performance</a>}
              {hasDivisionPerformance && <a href="#rr-div-perf" className="report-nav-link">Division Performance</a>}
              <a href="#rr-geography" className="report-nav-link">Selected Event Geography</a>
              {stats.performanceBands && <a href="#rr-field-depth" className="report-nav-link">Advanced Field Analysis</a>}
              {weather && <a href="#rr-weather-details" className="report-nav-link">Weather Details</a>}
            </div>
          </nav>
        </div>
      )}
      <div id="rr-event-snapshot">
        <EventSnapshotSection
          summary={stats.summary}
          selectedEventName={selectedEventName}
          showSelectedEventContext={!isSingleEventReport}
        />
      </div>
      {hasAgeDistribution && (
        <div id="rr-age">
          <AgeSection
            stats={ageDistributionStats}
            additionalInsights={ageDistributionInsights}
            title="Finisher Age Distribution"
            contextStrip={!isSingleEventReport ? <SelectedEventContext eventName={activeAgeEvent?.eventName ?? selectedEventName} /> : undefined}
            countLabel="Finishers"
            compact
            compactHighlights
          />
        </div>
      )}
      <div id="rr-performance">
        <PerformanceSection
          events={stats.performance.events}
          selectedEventName={selectedEventName}
          showSelectedEventContext={!isSingleEventReport}
        />
      </div>
      {hasEventPerformanceComparison && (
        <div id="rr-cross-event"><CrossEventSection crossEvent={stats.crossEvent} /></div>
      )}
      {(stats.ageGroupPerformance || stats.ageGroupPerformanceByEvent.length > 0) && (
        <div id="rr-age-group-perf">
          <AgeGroupPerformanceSection
            agp={stats.ageGroupPerformance ?? {
              rows: stats.ageGroupPerformanceByEvent[0]?.rows ?? [],
              eventType: stats.ageGroupPerformanceByEvent[0]?.eventType ?? 'fixed-distance',
            }}
            ageGroupPerformanceByEvent={stats.ageGroupPerformanceByEvent}
            selectedEventName={selectedEventName}
            showSelectedEventContext={!isSingleEventReport}
          />
        </div>
      )}
      {(stats.divisionPerformance || stats.divisionPerformanceByEvent.length > 0) && (
        <div id="rr-div-perf">
          <DivisionPerformanceSection
            dp={stats.divisionPerformance ?? {
              rows: stats.divisionPerformanceByEvent[0]?.rows ?? [],
              eventType: stats.divisionPerformanceByEvent[0]?.eventType ?? 'fixed-distance',
            }}
            divisionPerformanceByEvent={stats.divisionPerformanceByEvent}
            selectedEventName={selectedEventName}
            showSelectedEventContext={!isSingleEventReport}
          />
        </div>
      )}
      {!isSingleEventReport && (
        <div id="rr-geography">
          <GeographicSection
            stats={geographicStats}
            title="Selected Event Geography"
            showUnknownLocation
            basisNote="Geography reflects participants in the selected event."
            contextStrip={<SelectedEventContext eventName={activeGeoEvent?.eventName ?? selectedEventName} />}
            insightsPosition="bottom"
            summaryMode="race-results"
          />
        </div>
      )}
      {stats.performanceBands && (
        <div id="rr-field-depth">
          <FieldDepthSection
            pb={stats.performanceBands}
            selectedEventName={selectedEventName}
            showSelectedEventContext={!isSingleEventReport}
          />
        </div>
      )}
      {weather && <div id="rr-weather-details"><WeatherSection weather={weather} variant="details" /></div>}
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
  const [selectedEventName, setSelectedEventName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(apiUrl(`/api/results/stats/${upload.sessionId}`));
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? 'Failed to load statistics.'); return; }
        const response = json as ResultsStatsResponse;
        setData(response);
        setSelectedEventName(response.stats.performance.events[0]?.eventName ?? null);
      } catch {
        setError('Could not reach the server.');
      } finally {
        setLoading(false);
      }
    })();
  }, [upload.sessionId]);

  useEffect(() => { headingRef.current?.focus(); }, []);

  const weatherData = data?.weatherData as WeatherData | undefined;
  const reportYear = reportYearFromWeatherOrLabel(weatherData, label);
  const reportTitle = reportTitleWithYear(upload.raceName, reportYear);
  const eventCount = data?.stats.performance.events.length ?? 0;
  const eventType = data?.stats.performance.events[0]?.eventType ?? null;
  const eventTypeSummary = eventType
    ? `${eventType === 'fixed-time' ? 'Fixed-time event' : 'Fixed-distance event'}${eventCount > 1 ? ` · ${eventCount} events` : ''}`
    : null;
  const raceDateSummary = weatherData ? (() => {
    const start = formatRaceDatetime(weatherData.raceStartIso);
    const end = formatRaceDatetime(weatherData.raceEndIso);
    const sameDay = start.date === end.date;
    return `${start.date}${!sameDay ? ` – ${end.date}` : ''} · ${start.time}`;
  })() : null;
  const venueSummary = weatherData?.venueAddress?.trim() || null;

  return (
    <div className="rr-dashboard">
      <header className="rr-report-header">
        <div className="rr-report-header-main">
          <button type="button" className="btn-ghost dashboard-back no-print" onClick={onBack}>
            ← New analysis
          </button>
          <h1 ref={headingRef} tabIndex={-1} className="rr-report-title">
            {reportTitle}
          </h1>
          <p className="rr-report-subtitle">Race Results Analysis</p>
          <dl className="rr-report-meta">
            <div className="rr-report-meta-item">
              <dt>Results</dt>
              <dd>{upload.resultCount.toLocaleString()} records</dd>
            </div>
            <div className="rr-report-meta-item">
              <dt>Format</dt>
              <dd>{upload.adapterName}</dd>
            </div>
            {eventTypeSummary && (
              <div className="rr-report-meta-item">
                <dt>Event type</dt>
                <dd>{eventTypeSummary}</dd>
              </div>
            )}
            {raceDateSummary && (
              <div className="rr-report-meta-item rr-report-meta-item--wide">
                <dt>Race date</dt>
                <dd>{raceDateSummary}</dd>
              </div>
            )}
            {venueSummary && (
              <div className="rr-report-meta-item rr-report-meta-item--wide">
                <dt>Venue</dt>
                <dd>{venueSummary}</dd>
              </div>
            )}
          </dl>
        </div>
        <button type="button" className="btn btn-primary no-print"
          onClick={() => window.print()} aria-label="Save analysis as PDF">
          Save as PDF
        </button>
      </header>

      {loading && <div className="dashboard-loading" role="status" aria-live="polite" aria-busy="true">Loading statistics…</div>}
      {error && <div className="dashboard-error" role="alert">{error}</div>}

      {data?.stats && !loading && (
        <>
          <div className="rr-dashboard-sections">
            <FullStatsSections
              stats={data.stats}
              weather={data.weatherData as WeatherData | undefined}
              selectedEventName={selectedEventName}
              onSelectedEventChange={setSelectedEventName}
            />
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
  barColors?: string[];
  showBarLabels?: boolean;
  formatDelta?: (delta: number, firstLabel?: string) => string;
  featuredValue?: number | null;
  featuredSub?: string;
}

function ResultsTrendCard({
  title, data, unit = '', precision = 1, formatValue, deltaInvert = false, barColors, showBarLabels = false, formatDelta,
  featuredValue, featuredSub,
}: ResultsTrendCardProps) {
  if (data.length === 0) return null;

  const current = data[data.length - 1].value;
  const first = data[0].value;
  const delta = current !== null && first !== null ? current - first : null;
  const primaryValue = featuredValue !== undefined ? featuredValue : current;

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
  // Each bar = one year — use the shared year palette so bars match year pills.
  const colors = barColors ?? comparisonPalette(chartData.length);
  const firstLabel = data[0]?.label;
  const deltaUnit = unit === '%' ? ' pts' : unit;

  return (
    <div className={`trend-card card${showBarLabels ? ' trend-card--labeled' : ''}`}>
      <div className="trend-card-header">
        <span className="trend-card-title">{title}</span>
        {featuredSub ? (
          <span className="trend-card-delta trend-card-delta--neutral">{featuredSub}</span>
        ) : delta !== null && (
          <span className={`trend-card-delta ${deltaClass}`}>
            {formatDelta ? formatDelta(delta, firstLabel) : `${deltaSign}${display(delta)}${deltaUnit}${firstLabel ? ` since ${firstLabel}` : ''}`}
          </span>
        )}
      </div>
      <div className="trend-card-value">{display(primaryValue)}{unit}</div>
      <div className="trend-card-chart" role="img" aria-label={`${title} trend`}>
        <ResponsiveContainer width="100%" height={showBarLabels ? 96 : 70}>
          <BarChart data={chartData} margin={{ top: showBarLabels ? 16 : 2, right: 4, bottom: 0, left: 4 }}>
            <XAxis dataKey="label" tick={{ fontSize: showBarLabels ? 10 : 9 }} axisLine={false} tickLine={false} />
            <YAxis hide domain={[0, 'auto']} />
            <Tooltip formatter={(v: number) => [display(v), title]} contentStyle={{ fontSize: '0.8rem' }} />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={colors[i]} />)}
              {showBarLabels && (
                <LabelList dataKey="value" position="top" formatter={(v: number) => `${display(v)}${unit}`}
                  style={{ fontSize: '0.62rem', fill: '#4b5563', fontWeight: 700 }} />
              )}
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

// ─── Race key changes ─────────────────────────────────────────────────────────

interface RaceKeyChangesProps {
  trends: ResultsComparisonTrends;
  intervals: ResultsIntervalStats[];
}

function RaceKeyChanges({ trends, intervals }: RaceKeyChangesProps) {
  if (intervals.length < 2) return <p className="trend-line-empty">Need at least two intervals to show key changes.</p>;

  const firstLabel = intervals[0].label;
  const lastLabel  = intervals[intervals.length - 1].label;

  function derived(fn: (iv: ResultsIntervalStats) => number | null): Array<{ label: string; value: number | null }> {
    return intervals.map(iv => ({ label: iv.label, value: fn(iv) }));
  }

  const dnsRateData   = derived(iv => iv.stats.attrition.overall.dnsRate);
  const femaleParticipantPctData = derived(iv => iv.stats.demographics.gender.femalePercent);
  const maleParticipantPctData = derived(iv => iv.stats.demographics.gender.malePercent);
  const nbParticipantPctData = derived(iv => iv.stats.demographics.gender.nonBinaryPercent);

  const rows: KeyChangeRow[] = [
    {
      label: 'Total Participants',
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
    {
      label: 'Female Participants %',
      formattedDelta: fmtPtsDelta(seriesDelta(femaleParticipantPctData)),
      direction: directionOf(seriesDelta(femaleParticipantPctData), 0.05),
      neutral: true,
    },
    {
      label: 'Male Participants %',
      formattedDelta: fmtPtsDelta(seriesDelta(maleParticipantPctData)),
      direction: directionOf(seriesDelta(maleParticipantPctData), 0.05),
      neutral: true,
    },
    {
      label: 'Non-Binary Participants %',
      formattedDelta: fmtPtsDelta(seriesDelta(nbParticipantPctData)),
      direction: directionOf(seriesDelta(nbParticipantPctData), 0.05),
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
    // ── Total Participants ──────────────────────────────────────────────────────
    { label: 'Total Participants',  values: intervals.map(iv => iv.stats.summary.totalEntrants), fmt: fmtN0 },
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
  const { theme } = useTheme();
  const [data, setData] = useState<ResultsComparisonStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendsTab, setTrendsTab] = useState<'summary' | 'changes'>('summary');
  const [selectedTrendEventName, setSelectedTrendEventName] = useState<string | null>(null);
  const [eventPerfTab, setEventPerfTab] = useState<'charts' | 'table'>('charts');
  const [eventPerfMetric, setEventPerfMetric] = useState<'fastestPace' | 'averagePace' | 'medianPace' | 'lastPace' | 'paceSpread' | 'shortestDistance' | 'averageDistance' | 'medianDistance' | 'farthestDistance' | 'distanceSpread'>('medianPace');
  const [genderTab, setGenderTab] = useState<'charts' | 'table'>('charts');
  const [ageTrendsTab, setAgeTrendsTab] = useState<'summary' | 'table'>('summary');
  const [ageDistTab, setAgeDistTab] = useState<'charts' | 'table'>('charts');
  const [ageDistGender, setAgeDistGender] = useState<'overall' | 'male' | 'female' | 'nonBinary'>('overall');
  const [timesTab, setTimesTab] = useState<'charts' | 'table'>('charts');
  const [finishTrendMetric, setFinishTrendMetric] = useState<'fastest' | 'average' | 'median' | 'last' | 'spread'>('median');
  const [geoTab, setGeoTab] = useState<'summary' | 'table'>('summary');
  const [selectedGeoTab, setSelectedGeoTab] = useState<'summary' | 'table'>('summary');
  const [weatherTab, setWeatherTab] = useState<'charts' | 'table'>('charts');

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
  const intervals = data?.intervals ?? [];
  const lastInterval = intervals[intervals.length - 1];
  const weatherIntervals = intervals.filter(iv => iv.weatherData);
  const hasWeather = weatherIntervals.length > 0;
  const dnsRateTrend    = intervals.map(iv => ({ label: iv.label, value: iv.stats.attrition.overall.dnsRate }));
  const maleFinPctTrend = intervals.map(iv => ({ label: iv.label, value: iv.stats.demographics.finisherGender.malePercent }));
  const nbFinPctTrend   = intervals.map(iv => ({ label: iv.label, value: iv.stats.demographics.finisherGender.nonBinaryPercent }));
  const usTrend         = intervals.map(iv => ({ label: iv.label, value: iv.stats.geographic.usParticipants }));
  const intlTrend       = intervals.map(iv => ({ label: iv.label, value: iv.stats.geographic.internationalParticipants }));
  const usStatesTrend   = intervals.map(iv => ({
    label: iv.label,
    value: Object.keys(iv.stats.geographic.byState).filter(state => US_STATE_CODES.has(state.toUpperCase())).length,
  }));
  const nonUsStateProvinceTrend = intervals.map(iv => ({
    label: iv.label,
    value: Object.keys(iv.stats.geographic.byState).filter(state => !US_STATE_CODES.has(state.toUpperCase())).length,
  }));
  const totalParticipantsTrend = intervals.map(iv => ({ label: iv.label, value: iv.stats.summary.totalEntrants }));
  const dnsCountTrend    = intervals.map(iv => ({ label: iv.label, value: iv.stats.summary.dns }));
  const startersTrend    = intervals.map(iv => ({ label: iv.label, value: iv.stats.attrition.overall.starters }));
  const dnfTrend        = intervals.map(iv => ({ label: iv.label, value: iv.stats.summary.dnf }));
  const participationEventNames = sortEventNames(Array.from(new Set(intervals.flatMap(iv => iv.stats.attrition.byEvent.map(r => r.name)))));
  const hasEventPerformanceTrends = participationEventNames.length > 0;
  // Stable year-indexed colors shared by all bar charts and year pills in this report.
  const colorCount      = Math.max(intervals.length, sessions.length);
  const baseYearColors  = comparisonPalette(colorCount);
  const trendYearPalette = [theme.primary, '#2563EB', '#16A34A', '#7C3AED', '#0891B2'];
  const trendYearColorNames = ['orange', 'blue', 'green', 'purple', 'teal'];
  const yearColors      = Array.from({ length: colorCount }, (_, i) => trendYearPalette[i] ?? baseYearColors[i]);
  const yearColorName   = (index: number) => trendYearColorNames[index] ?? comparisonPaletteName(index);
  const totalRecords    = intervals.reduce((sum, iv) => sum + iv.resultCount, 0);
  const eventCount      = lastInterval?.stats.performance.events.length ?? 0;
  const eventTypeSummary = data
    ? `${data.primaryEventType === 'fixed-time' ? 'Fixed-time event' : 'Fixed-distance event'}${eventCount > 1 ? ` · ${eventCount} events` : ''}`
    : null;
  const raceDateItems = intervals
    .map(iv => iv.weatherData ? {
      label: iv.label,
      date: formatRaceDatetime(iv.weatherData.raceStartIso).date,
    } : null)
    .filter((value): value is { label: string; date: string } => value != null)
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const venueSummary = intervals
    .map(iv => iv.weatherData?.venueAddress?.trim())
    .find((value): value is string => !!value) ?? null;
  // Age trend flat-line check: spread < 1 year across all intervals.
  const ageFlat = intervals.length > 1 && (() => {
    const vals = (trends?.medianFinisherAge ?? []).map(d => d.value).filter((v): v is number => v != null);
    return vals.length >= 2 && Math.max(...vals) - Math.min(...vals) < 1.0;
  })();
  const firstInterval = intervals[0];
  const participationEventKey = participationEventNames.join('|');
  useEffect(() => {
    if (participationEventNames.length === 0) return;
    if (!selectedTrendEventName || !participationEventNames.includes(selectedTrendEventName)) {
      setSelectedTrendEventName(participationEventNames[0]);
    }
  }, [participationEventKey, selectedTrendEventName]);
  const activeTrendEventName = selectedTrendEventName && participationEventNames.includes(selectedTrendEventName)
    ? selectedTrendEventName
    : participationEventNames[0] ?? null;
  const selectedTrendContextStrip = activeTrendEventName ? (
    <p className="rr-selected-event-context rr-selected-event-context--section-header">
      <span>Selected event: <strong>{activeTrendEventName}</strong></span>
      {participationEventNames.length > 1 && (
        <>
          <span className="rr-selected-event-context-separator" aria-hidden="true">·</span>
          <a href="#rr-selected-event-trends">Change event ↑</a>
        </>
      )}
    </p>
  ) : undefined;
  const selectedTrendEventRows = intervals.map((iv, index) => ({
    interval: iv,
    yearColor: yearColors[index],
    row: activeTrendEventName
      ? iv.stats.attrition.byEvent.find(event => event.name === activeTrendEventName) ?? null
      : null,
  }));
  const hasSelectedTrendEventRows = selectedTrendEventRows.some(item => item.row != null);
  const demographicInsights = firstInterval && lastInterval ? (() => {
    const firstLabel = firstInterval.label;
    const lastLabel = lastInterval.label;
    const gender = {
      female: lastInterval.stats.demographics.finisherGender.femalePercent - firstInterval.stats.demographics.finisherGender.femalePercent,
      male: lastInterval.stats.demographics.finisherGender.malePercent - firstInterval.stats.demographics.finisherGender.malePercent,
      nonBinary: lastInterval.stats.demographics.finisherGender.nonBinaryPercent - firstInterval.stats.demographics.finisherGender.nonBinaryPercent,
    };
    const genderInsights = [
      Math.abs(gender.female) < 0.5
        ? `Female finishers remained relatively stable from ${firstLabel} to ${lastLabel}.`
        : `Female finishers ${gender.female > 0 ? 'increased' : 'decreased'} by ${Math.abs(gender.female).toFixed(1)} pts from ${firstLabel} to ${lastLabel}.`,
      Math.abs(gender.male) < 0.5
        ? `Male finishers remained relatively stable from ${firstLabel} to ${lastLabel}.`
        : `Male finishers ${gender.male > 0 ? 'increased' : 'decreased'} by ${Math.abs(gender.male).toFixed(1)} pts from ${firstLabel} to ${lastLabel}.`,
      Math.abs(gender.nonBinary) < 0.5
        ? `Non-Binary finishers remained relatively stable across the comparison period.`
        : `Non-Binary finishers ${gender.nonBinary > 0 ? 'increased' : 'decreased'} by ${Math.abs(gender.nonBinary).toFixed(1)} pts from ${firstLabel} to ${lastLabel}.`,
    ].slice(0, 3);

    const firstAge = firstInterval.stats.demographics.finisherAge;
    const lastAge = lastInterval.stats.demographics.finisherAge;
    const medianDelta = firstAge.median != null && lastAge.median != null ? lastAge.median - firstAge.median : null;
    const averageDelta = firstAge.mean != null && lastAge.mean != null ? lastAge.mean - firstAge.mean : null;
    const ageInsights: string[] = [];
    if (medianDelta != null) {
      ageInsights.push(Math.abs(medianDelta) < 1
        ? `Median finisher age remained stable from ${firstLabel} to ${lastLabel}.`
        : `Median finisher age ${medianDelta > 0 ? 'increased' : 'decreased'} by ${Math.abs(medianDelta).toFixed(1)} years from ${firstLabel} to ${lastLabel}.`);
    }
    if (averageDelta != null) {
      ageInsights.push(Math.abs(averageDelta) < 1
        ? `Average age changed by less than 1 year across the comparison period.`
        : `Average age ${averageDelta > 0 ? 'increased' : 'decreased'} by ${Math.abs(averageDelta).toFixed(1)} years from ${firstLabel} to ${lastLabel}.`);
    }
    if (firstAge.max != null && lastAge.max != null && firstAge.max !== lastAge.max) {
      ageInsights.push(`The oldest finisher changed from ${firstAge.max} to ${lastAge.max}.`);
    }

    const latestBuckets = lastAge.buckets;
    const firstBuckets = firstAge.buckets;
    const bucketChanges = latestBuckets.map(bucket => {
      const firstBucket = firstBuckets.find(item => item.label === bucket.label);
      return {
        label: bucket.label,
        first: firstBucket?.count ?? 0,
        latest: bucket.count,
        delta: bucket.count - (firstBucket?.count ?? 0),
      };
    });
    const largestBucketIncrease = bucketChanges.reduce<typeof bucketChanges[number] | null>((best, bucket) => {
      if (bucket.delta <= 0) return best;
      return !best || bucket.delta > best.delta ? bucket : best;
    }, null);
    const largestLatestBucket = latestBuckets.reduce<typeof latestBuckets[number] | null>((best, bucket) => {
      return !best || bucket.count > best.count ? bucket : best;
    }, null);
    const stableBucket = bucketChanges.find(bucket => bucket.latest > 0 && Math.abs(bucket.delta) < 3);
    const ageDistributionInsights: string[] = [];
    if (largestBucketIncrease) {
      ageDistributionInsights.push(`${largestBucketIncrease.label} finishers increased from ${largestBucketIncrease.first.toLocaleString()} to ${largestBucketIncrease.latest.toLocaleString()}.`);
    }
    if (largestLatestBucket) {
      ageDistributionInsights.push(`${largestLatestBucket.label} was the largest finisher age group in ${lastLabel}.`);
    }
    if (stableBucket) {
      ageDistributionInsights.push(`${stableBucket.label} finishers were relatively stable across the comparison period.`);
    }

    return {
      gender: genderInsights,
      age: ageInsights.slice(0, 3),
      ageDistribution: ageDistributionInsights.slice(0, 3),
    };
  })() : { gender: [], age: [], ageDistribution: [] };
  const latestGender = lastInterval?.stats.demographics.gender;
  const firstGender = firstInterval?.stats.demographics.gender;
  const trendGenderColors = genderColors(theme);
  const genderTrendSummary = latestGender && firstGender ? [
    {
      label: 'Male',
      count: latestGender.male,
      firstCount: firstGender.male,
      value: latestGender.malePercent,
      delta: latestGender.malePercent - firstGender.malePercent,
      color: trendGenderColors.M,
    },
    {
      label: 'Female',
      count: latestGender.female,
      firstCount: firstGender.female,
      value: latestGender.femalePercent,
      delta: latestGender.femalePercent - firstGender.femalePercent,
      color: trendGenderColors.F,
    },
    {
      label: 'Non-Binary',
      count: latestGender.nonBinary,
      firstCount: firstGender.nonBinary,
      value: latestGender.nonBinaryPercent,
      delta: latestGender.nonBinaryPercent - firstGender.nonBinaryPercent,
      color: trendGenderColors.NB,
    },
  ].filter(item => item.count > 0 || item.firstCount > 0 || Math.abs(item.delta) >= 0.05) : [];

  return (
    <div className="rr-dashboard">
      <header className="rr-report-header">
        <div className="rr-report-header-main">
          <button type="button" className="btn-ghost dashboard-back no-print" onClick={onBack}>
            ← New analysis
          </button>
          <h1 ref={headingRef} tabIndex={-1} className="rr-report-title">
            <span className="rr-report-title-main">{raceName}</span>
            <span className="rr-report-title-subline">{sessions.length}-Year Comparison</span>
          </h1>
          <p className="rr-report-subtitle">Race Results Trend Analysis</p>
          <dl className="rr-report-meta">
            {totalRecords > 0 && (
              <div className="rr-report-meta-item">
                <dt>Results</dt>
                <dd>{totalRecords.toLocaleString()} records</dd>
              </div>
            )}
            <div className="rr-report-meta-item">
              <dt>Format</dt>
              <dd>Race Results</dd>
            </div>
            {eventTypeSummary && (
              <div className="rr-report-meta-item">
                <dt>Event type</dt>
                <dd>{eventTypeSummary}</dd>
              </div>
            )}
            {raceDateItems.length > 0 && (
              <div className="rr-report-meta-item rr-report-meta-item--wide">
                <dt>Race dates</dt>
                <dd>
                  <span className="rr-report-date-list">
                    {raceDateItems.map(item => (
                      <span key={item.label} className="rr-report-date-row">
                        <span className="rr-report-date-year">{item.label}:</span>
                        <span>{item.date}</span>
                      </span>
                    ))}
                  </span>
                </dd>
              </div>
            )}
            {venueSummary && (
              <div className="rr-report-meta-item rr-report-meta-item--wide">
                <dt>Venue</dt>
                <dd>{venueSummary}</dd>
              </div>
            )}
          </dl>
          <div className="comparison-intervals" aria-label="Years being compared">
            {sessions.map((s, i) => (
              <span
                key={s.sessionId}
                className="comparison-interval-pill"
                aria-label={`${s.label}, shown in ${yearColorName(i)} throughout report`}
              >
                <span
                  className="comparison-interval-pill-swatch"
                  style={{ background: yearColors[i] }}
                  aria-hidden="true"
                />
                {s.label}
              </span>
            ))}
          </div>
        </div>
        <button type="button" className="btn btn-primary no-print"
          onClick={() => window.print()} aria-label="Save as PDF">
          Save as PDF
        </button>
      </header>

      {loading && <div className="dashboard-loading" role="status" aria-live="polite" aria-busy="true">Loading comparison…</div>}
      {error && <div className="dashboard-error" role="alert">{error}</div>}

      {data && trends && !loading && lastInterval && (
        <>
          <div className="rr-dashboard-sections">

            {/* ── 1. Overall Trends ── */}
            <section id="rr-trends" className="chart-section">
              <SectionHeader title="Overall Trends" />
              <div className="rd-tab-strip" role="tablist" aria-label="Overall trends views">
                {(['summary', 'changes'] as const).map(id => (
                  <button key={id} type="button" role="tab"
                    aria-selected={trendsTab === id}
                    className={`rd-tab${trendsTab === id ? ' rd-tab--active' : ''}`}
                    onClick={() => setTrendsTab(id)}
                  >
                    {id === 'summary' ? 'Summary' : 'Key Changes'}
                  </button>
                ))}
              </div>
              {trendsTab === 'summary' && (
                <div role="tabpanel" className="rd-tab-panel">
                  <div className="trend-card-group">
                    <div className="trend-cards-grid trend-cards-grid--primary">
                      <ResultsTrendCard title="Total Participants" data={totalParticipantsTrend} precision={0} barColors={yearColors} showBarLabels />
                      <ResultsTrendCard title="DNS" data={dnsCountTrend} precision={0} deltaInvert barColors={yearColors} showBarLabels />
                      <ResultsTrendCard title="Starters" data={startersTrend} precision={0} barColors={yearColors} showBarLabels />
                      <ResultsTrendCard title="Finishers" data={trends.finishers} precision={0} barColors={yearColors} showBarLabels />
                      <ResultsTrendCard title="DNF" data={dnfTrend} precision={0} deltaInvert barColors={yearColors} showBarLabels />
                      <ResultsTrendCard title="Finish Rate" data={trends.finishRate} unit="%" barColors={yearColors} showBarLabels />
                    </div>
                    <div className="trend-card-secondary">
                      <div className="trend-gender-mix" aria-label="Participant gender mix trend">
                        <span className="trend-card-secondary-label trend-gender-mix-label">Participant Gender Mix:</span>
                        <div className="trend-gender-row rr-gender-summary" role="list">
                          {genderTrendSummary.map(item => (
                            <div key={item.label} className="trend-gender-item rr-gender-summary-item" role="listitem">
                              <span className="trend-gender-name">
                                <span className="rr-gender-summary-chip" style={{ background: item.color }} aria-hidden="true" />
                                <span className="rr-gender-summary-label">{item.label}</span>
                              </span>
                              <span className="trend-gender-latest">{item.count.toLocaleString()} · {fmtPct(item.value)}</span>
                              <span className="trend-gender-delta">
                                {Math.abs(item.delta) < 0.05 ? 'stable' : `${item.delta > 0 ? '+' : ''}${item.delta.toFixed(1)} pts since ${firstInterval?.label}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {trendsTab === 'changes' && (
                <div role="tabpanel" className="rd-tab-panel">
                  <div className="rr-trend-key-changes">
                    <RaceKeyChanges trends={data.trends} intervals={intervals} />
                  </div>
                </div>
              )}
            </section>

            {/* ── 2. Race Weather ── */}
            {(() => {
              if (!hasWeather) {
                return (
                  <section id="rr-weather" className="chart-section">
                    <SectionHeader title="Race Weather" />
                    <p className="rd-empty-group">Race weather trends will appear here when comparable weather data is available across years.</p>
                  </section>
                );
              }
              const weatherRows = weatherIntervals.map(iv => {
                const snaps = (iv.weatherData as WeatherData).snapshots;
                const first = snaps[0];
                const last = snaps[snaps.length - 1];
                const peakTemp = snaps.length > 0 ? Math.max(...snaps.map(s => s.tempF)) : null;
                const peakWind = snaps.length > 0 ? Math.max(...snaps.map(s => s.windMph)) : null;
                const startDate = new Date((iv.weatherData as WeatherData).raceStartIso)
                  .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const raceStartMs = new Date((iv.weatherData as WeatherData).raceStartIso).getTime();
                const raceEndMs = new Date((iv.weatherData as WeatherData).raceEndIso).getTime();
                const colorIndex = intervals.findIndex(interval => interval.label === iv.label);
                return {
                  label: iv.label,
                  colorIndex,
                  startDate,
                  startTemp: first?.tempF ?? null,
                  endTemp: last?.tempF ?? null,
                  startFeelsLike: first?.feelsLikeF ?? null,
                  startCondition: first?.weatherDesc ?? '—',
                  peakTemp,
                  peakWind,
                  peakGust: snaps.length > 0 ? Math.max(...snaps.map(s => s.windGustMph)) : null,
                  cloudCover: snaps.length > 0 ? Math.round(snaps.reduce((sum, s) => sum + s.cloudCoverPct, 0) / snaps.length) : null,
                  tempPoints: snaps.map((snapshot, index) => {
                    const snapshotMs = new Date(snapshot.timeIso).getTime();
                    const offsetHours = Math.max(0, Math.round((snapshotMs - raceStartMs) / 3600000));
                    const isEnd = index === snaps.length - 1 || Math.abs(snapshotMs - raceEndMs) <= 30 * 60000;
                    return {
                      key: isEnd && offsetHours > 0 ? 'end' : String(offsetHours),
                      sort: isEnd && offsetHours > 0 ? offsetHours + 0.01 : offsetHours,
                      label: isEnd && offsetHours > 0
                        ? 'Race End'
                        : offsetHours === 0
                          ? 'Race Start'
                          : `+${offsetHours}h`,
                      value: snapshot.tempF,
                      condition: snapshot.weatherDesc || 'Unknown',
                    };
                  }),
                };
              });
              const fmtTemp = (value: number): string => Math.abs(value - Math.round(value)) < 0.05 ? `${Math.round(value)}°F` : `${value.toFixed(1)}°F`;
              const conditionIcon = (condition: string): string => {
                const lower = condition.toLowerCase();
                if (/storm|thunder|lightning/.test(lower)) return '⛈️';
                if (/hail|sleet|ice/.test(lower)) return '🌨️';
                if (/fog|mist|haze/.test(lower)) return '🌫️';
                if (/snow|flurr/.test(lower)) return '❄️';
                if (/rain|drizzle|shower/.test(lower)) return '🌧️';
                if (/overcast|cloudy/.test(lower)) return '☁️';
                if (/partly|mostly clear|mainly clear/.test(lower)) return '⛅';
                if (/clear|sunny/.test(lower)) return '☀️';
                if (!condition || condition === '—' || /unknown/i.test(condition)) return '—';
                return '🌤️';
              };
              const tempPointDefs = Array.from(
                new Map(weatherRows.flatMap(row => row.tempPoints.map(point => [point.key, { key: point.key, label: point.label, sort: point.sort }]))).values(),
              ).sort((a, b) => a.sort - b.sort);
              const tempChartData = tempPointDefs.map(pointDef => {
                const row: Record<string, string | number | null> = { label: pointDef.label };
                weatherRows.forEach(weatherRow => {
                  row[weatherRow.label] = weatherRow.tempPoints.find(point => point.key === pointDef.key)?.value ?? null;
                });
                return row;
              });
              const numericRange = (values: Array<number | null>) => {
                const nums = values.filter((v): v is number => v != null);
                return nums.length > 0 ? { min: Math.min(...nums), max: Math.max(...nums) } : null;
              };
              const startTempRange = numericRange(weatherRows.map(row => row.startTemp));
              const windRangeValues = numericRange(weatherRows.map(row => row.peakWind));
              const gusts = weatherRows.map(row => row.peakGust).filter((v): v is number => v != null);
              const peakGust = gusts.length > 0 ? Math.max(...gusts) : null;
              const peakGustYear = peakGust != null ? weatherRows.find(row => row.peakGust === peakGust)?.label : null;
              const weatherInsights = (() => {
                const insights: string[] = [];
                if (startTempRange) {
                  const spread = startTempRange.max - startTempRange.min;
                  insights.push(spread <= 3
                    ? `Race-start temperature stayed within a ${Math.round(spread)}°F band across the comparison period.`
                    : `Race-start temperature ranged from ${fmtTemp(startTempRange.min)} to ${fmtTemp(startTempRange.max)}.`);
                }
                if (peakGust != null) {
                  insights.push(`Gusts peaked at ${peakGust.toFixed(1)} mph${peakGustYear ? ` in ${peakGustYear}` : ''}.`);
                } else if (windRangeValues) {
                  insights.push(`Peak wind ranged from ${windRangeValues.min.toFixed(1)} mph to ${windRangeValues.max.toFixed(1)} mph.`);
                }
                return insights.slice(0, 2);
              })();
              return (
                <section id="rr-weather" className="chart-section">
                  <SectionHeader title="Race Weather" />
                  <div className="trend-weather-summary" aria-label="Weather by compared year">
                    {weatherRows.map(row => (
                      <div
                        key={row.label}
                        className="trend-weather-card trend-weather-card--year"
                        style={{ borderLeftColor: yearColors[row.colorIndex] ?? yearColors[0] }}
                      >
                        <div className="trend-weather-year-row">
                          <span
                            className="trend-weather-year-dot"
                            style={{ background: yearColors[row.colorIndex] ?? yearColors[0] }}
                            aria-hidden="true"
                          />
                          <span className="trend-weather-year">{row.label}</span>
                        </div>
                        <div className="trend-weather-condition">
                          <span className="trend-weather-icon" aria-hidden="true">{conditionIcon(row.startCondition)}</span>
                          <span>{row.startCondition}</span>
                        </div>
                        <p className="trend-weather-line">
                          {row.startTemp != null ? `${fmtTemp(row.startTemp)} start` : 'Start —'}
                          {row.peakTemp != null ? ` · ${fmtTemp(row.peakTemp)} peak` : ''}
                          {row.endTemp != null ? ` · ${fmtTemp(row.endTemp)} end` : ''}
                        </p>
                        <p className="trend-weather-line">
                          {row.peakWind != null ? `Wind ${row.peakWind.toFixed(1)} mph` : 'Wind —'}
                          {row.peakGust != null ? ` · Gust ${row.peakGust.toFixed(1)} mph` : ''}
                        </p>
                      </div>
                    ))}
                    {weatherRows.length === 0 && (
                      <div className="trend-weather-card-body">
                        <span className="trend-weather-sub">No weather rows are available for the compared years.</span>
                      </div>
                    )}
                  </div>
                  <div className="rd-tab-strip" role="tablist" aria-label="Weather trends views">
                    {(['charts', 'table'] as const).map(id => (
                      <button key={id} type="button" role="tab"
                        aria-selected={weatherTab === id}
                        className={`rd-tab${weatherTab === id ? ' rd-tab--active' : ''}`}
                        onClick={() => setWeatherTab(id)}
                      >
                        {id === 'charts' ? 'Charts' : 'Table'}
                      </button>
                    ))}
                  </div>
                  {weatherTab === 'charts' && (
                    <div role="tabpanel" className="rd-tab-panel">
                      <div className="chart-subsection chart-subsection--compact">
                        <p className="chart-subsection-title">Race-Window Temperature</p>
                        {tempChartData.length > 0 ? (
                          <div className="trend-weather-chart" aria-hidden="true">
                            <ResponsiveContainer width="100%" height={190}>
                              <LineChart data={tempChartData} margin={{ top: 8, right: 24, bottom: 4, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                                <YAxis
                                  tick={{ fontSize: 11 }}
                                  tickFormatter={(value: number) => `${Math.round(value)}°F`}
                                  width={52}
                                />
                                <Tooltip
                                  formatter={(value: number, name: string) => [`${value.toFixed(1)}°F`, name]}
                                  labelFormatter={(label: string) => label}
                                />
                                <Legend verticalAlign="top" iconType="plainline" wrapperStyle={{ fontSize: '0.75rem', paddingBottom: 6 }} />
                                {weatherRows.map(row => (
                                  <Line
                                    key={row.label}
                                    type="monotone"
                                    dataKey={row.label}
                                    stroke={yearColors[row.colorIndex] ?? yearColors[0]}
                                    strokeWidth={2.5}
                                    dot={{ r: 3.5, strokeWidth: 0 }}
                                    activeDot={{ r: 5 }}
                                    connectNulls={false}
                                  />
                                ))}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <p className="trend-line-empty">No chartable race-window temperature data is available for this comparison.</p>
                        )}
                        {tempPointDefs.length > 0 && (
                          <div className="trend-weather-condition-timeline" aria-label="Race-window conditions by year">
                            <p className="trend-weather-condition-title">Race-window conditions</p>
                            <div
                              className="trend-weather-condition-grid"
                              style={{ gridTemplateColumns: `minmax(3.4rem, max-content) repeat(${tempPointDefs.length}, minmax(0, 1fr))` }}
                            >
                              <span className="trend-weather-condition-cell trend-weather-condition-cell--empty" aria-hidden="true" />
                              {tempPointDefs.map(pointDef => (
                                <span key={pointDef.key} className="trend-weather-condition-cell trend-weather-condition-heading">
                                  {pointDef.label}
                                </span>
                              ))}
                              {weatherRows.map(row => (
                                <Fragment key={row.label}>
                                  <span className="trend-weather-condition-cell trend-weather-condition-year">
                                    <span
                                      className="trend-weather-year-dot"
                                      style={{ background: yearColors[row.colorIndex] ?? yearColors[0] }}
                                      aria-hidden="true"
                                    />
                                    {row.label}
                                  </span>
                                  {tempPointDefs.map(pointDef => {
                                    const point = row.tempPoints.find(item => item.key === pointDef.key);
                                    const condition = point?.condition ?? 'Unknown';
                                    return (
                                      <span
                                        key={`${row.label}-${pointDef.key}`}
                                        className="trend-weather-condition-cell trend-weather-condition-icon"
                                        title={condition}
                                        aria-label={`${row.label} ${pointDef.label}: ${condition}`}
                                      >
                                        {point ? conditionIcon(condition) : '—'}
                                      </span>
                                    );
                                  })}
                                </Fragment>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {weatherTab === 'table' && (
                    <div role="tabpanel" className="rd-tab-panel">
                      <div className="cmp-table-scroll">
                        <table className="stats-table cmp-table">
                          <caption className="sr-only">Race weather trends by year</caption>
                          <thead>
                            <tr>
                              <th scope="col">Year</th>
                              <th scope="col">Race Date</th>
                              <th scope="col">Start Condition</th>
                              <th scope="col">Start Temp</th>
                              <th scope="col">Peak Temp</th>
                              <th scope="col">End Temp</th>
                              <th scope="col">Feels Like</th>
                              <th scope="col">Cloud Cover</th>
                              <th scope="col">Peak Wind</th>
                              <th scope="col">Peak Gusts</th>
                            </tr>
                          </thead>
                          <tbody>
                            {weatherRows.map(row => (
                              <tr key={row.label}>
                                <td>{row.label}</td>
                                <td>{row.startDate}</td>
                                <td>{row.startCondition}</td>
                                <td>{row.startTemp != null ? fmtTemp(row.startTemp) : '—'}</td>
                                <td>{row.peakTemp != null ? fmtTemp(row.peakTemp) : '—'}</td>
                                <td>{row.endTemp != null ? fmtTemp(row.endTemp) : '—'}</td>
                                <td>{row.startFeelsLike != null ? fmtTemp(row.startFeelsLike) : '—'}</td>
                                <td>{row.cloudCover != null ? `${row.cloudCover}%` : '—'}</td>
                                <td>{row.peakWind != null ? `${row.peakWind.toFixed(1)} mph` : '—'}</td>
                                <td>{row.peakGust != null ? `${row.peakGust.toFixed(1)} mph` : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {weatherInsights.length > 0 && (
                    <div className="insight-callout">
                      <ul className="insight-callout-list">
                        {weatherInsights.map(item => (
                          <li key={item} className="insight-callout-item">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              );
            })()}

            {participationEventNames.length > 0 && (
              <section id="rr-selected-event-trends" className="chart-section" style={{ order: 5 }}>
                <div className="rr-selected-analysis-intro">
                  <h2>Select Event</h2>
                  {participationEventNames.length > 1 && (
                    <p>Choose an event to view event-specific year-over-year details.</p>
                  )}
                </div>
                {participationEventNames.length > 1 ? (
                  <div className="rr-selected-event-control rr-trend-event-control no-print" aria-label="Selected event trend selector">
                    <div className="rr-selected-event-copy">
                      <span className="rr-selected-event-label">Selected Event</span>
                    </div>
                    <div className="rr-perf-tabs rr-selected-event-tabs" role="tablist" aria-label="Selected event trend">
                      {participationEventNames.map(eventName => (
                        <button
                          key={eventName}
                          type="button"
                          role="tab"
                          aria-selected={activeTrendEventName === eventName}
                          className={`rr-perf-tab${activeTrendEventName === eventName ? ' rr-perf-tab--active' : ''}`}
                          onClick={() => setSelectedTrendEventName(eventName)}
                        >
                          {eventName}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="rr-selected-event-context">
                    <span>Selected event: <strong>{activeTrendEventName}</strong></span>
                  </p>
                )}
                <nav className="report-nav rr-report-nav no-print" aria-label="Selected event trend sections">
                  <span className="rr-report-nav-label">Jump To:</span>
                  <div className="rr-report-nav-links">
                    <a href="#rr-event-snapshot-trends" className="report-nav-link">Event Snapshot</a>
                    <a href="#rr-age-trends" className="report-nav-link">Finisher Age</a>
                    <a href="#rr-age-dist" className="report-nav-link">Finisher Age Distribution</a>
                    <a href="#rr-gender" className="report-nav-link">Finisher Gender</a>
                    <a href="#rr-times" className="report-nav-link">Finish Times</a>
                    {hasEventPerformanceTrends && <a href="#rr-event-performance" className="report-nav-link">{isFixedDist ? 'Pace Trends' : 'Distance Trends'}</a>}
                    <a href="#rr-selected-geography" className="report-nav-link">Selected Event Geography</a>
                  </div>
                </nav>
              </section>
            )}

            {(() => {
              if (!activeTrendEventName || !hasSelectedTrendEventRows) return null;
              const first = selectedTrendEventRows.find(item => item.row != null);
              const latest = [...selectedTrendEventRows].reverse().find(item => item.row != null);
              const trendFor = (value: (row: AttritionStats['overall']) => number) =>
                selectedTrendEventRows.map(item => ({
                  label: item.interval.label,
                  value: item.row ? value(item.row) : null,
                }));
              const snapshotInsights = (() => {
                if (!first?.row || !latest?.row) return [];
                const finisherDelta = latest.row.finished - first.row.finished;
                const participantDelta = latest.row.total - first.row.total;
                const finishRateDelta = latest.row.finishRate - first.row.finishRate;
                const insights = [
                  Math.abs(participantDelta) < 3
                    ? `${activeTrendEventName} participation was relatively stable from ${first.interval.label} to ${latest.interval.label}.`
                    : `${activeTrendEventName} participants ${participantDelta > 0 ? 'increased' : 'decreased'} from ${first.row.total.toLocaleString()} in ${first.interval.label} to ${latest.row.total.toLocaleString()} in ${latest.interval.label}.`,
                ];
                if (Math.abs(finisherDelta) >= 3) {
                  insights.push(`Finishers ${finisherDelta > 0 ? 'increased' : 'decreased'} from ${first.row.finished.toLocaleString()} to ${latest.row.finished.toLocaleString()} over the comparison period.`);
                } else if (Math.abs(finishRateDelta) >= 0.5) {
                  insights.push(`Finish rate changed by ${finishRateDelta > 0 ? '+' : ''}${finishRateDelta.toFixed(1)} pts from ${first.interval.label} to ${latest.interval.label}.`);
                }
                return insights.slice(0, 2);
              })();

              return (
                <section id="rr-event-snapshot-trends" className="chart-section" style={{ order: 6 }}>
                  <SectionHeader title="Event Snapshot" contextStrip={selectedTrendContextStrip} />
                  <div className="trend-cards-grid trend-cards-grid--primary">
                    <ResultsTrendCard title="Total Participants" data={trendFor(row => row.total)} precision={0} barColors={yearColors} showBarLabels />
                    <ResultsTrendCard title="DNS" data={trendFor(row => row.dns)} precision={0} deltaInvert barColors={yearColors} showBarLabels />
                    <ResultsTrendCard title="Starters" data={trendFor(row => row.starters)} precision={0} barColors={yearColors} showBarLabels />
                    <ResultsTrendCard title="Finishers" data={trendFor(row => row.finished)} precision={0} barColors={yearColors} showBarLabels />
                    <ResultsTrendCard title="DNF" data={trendFor(row => row.dnf)} precision={0} deltaInvert barColors={yearColors} showBarLabels />
                    <ResultsTrendCard title="Finish Rate" data={trendFor(row => row.finishRate)} unit="%" barColors={yearColors} showBarLabels />
                  </div>
                  {snapshotInsights.length > 0 && (
                    <div className="insight-callout">
                      <ul className="insight-callout-list">
                        {snapshotInsights.map(item => (
                          <li key={item} className="insight-callout-item">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              );
            })()}

            {/* ── 9. Finish Times ── */}
            {(() => {
              if (!isFixedDist || !activeTrendEventName) {
                return (
                  <section id="rr-times" className="chart-section" style={{ order: 10 }}>
                    <SectionHeader title="Finish Times" contextStrip={selectedTrendContextStrip} />
                    <p className="rd-empty-group">Finish time trends are shown when a selected fixed-distance event has comparable results across years.</p>
                  </section>
                );
              }
              const ftByYear = intervals.map(iv => {
                const ft = iv.stats.performance.events.find(event => event.eventName === activeTrendEventName)?.finishTime;
                const fastest = ft?.fastestSeconds ?? null;
                const average = ft?.meanSeconds ?? null;
                const median = ft?.medianSeconds ?? null;
                const last    = ft?.slowestSeconds ?? null;
                return {
                  label:   iv.label,
                  fastest,
                  average,
                  median,
                  last,
                  spread:  fastest != null && last != null ? last - fastest : null,
                };
              });
              const ftRowsWithData = ftByYear.filter(row => row.fastest != null || row.average != null || row.median != null || row.last != null || row.spread != null);
              const formatTimeDelta = (delta: number, firstLabel?: string, spread = false): string => {
                const since = firstLabel ? ` since ${firstLabel}` : '';
                if (Math.abs(delta) < 30) return `stable${since}`;
                if (spread) return `${delta < 0 ? 'narrower' : 'wider'}${since}`;
                return `${delta < 0 ? 'faster' : 'slower'}${since}`;
              };
              const trendForTime = (field: 'fastest' | 'average' | 'median' | 'last' | 'spread') =>
                ftByYear.map(row => ({ label: row.label, value: row[field] }));
              const bestRowFor = (field: 'fastest' | 'median' | 'last' | 'spread', direction: 'min' | 'max') => {
                const rows = ftByYear.filter((row): row is typeof row & Record<typeof field, number> => row[field] != null);
                if (rows.length === 0) return null;
                return rows.reduce((best, row) => direction === 'min'
                  ? row[field] < best[field] ? row : best
                  : row[field] > best[field] ? row : best, rows[0]);
              };
              const averageRows = ftByYear.filter((row): row is typeof row & { average: number } => row.average != null);
              const averageRow = averageRows.length > 0
                ? averageRows.reduce((best, row) => row.average < best.average ? row : best, averageRows[0])
                : null;
              const fastestRow = bestRowFor('fastest', 'min');
              const medianRow = bestRowFor('median', 'min');
              const lastRow = bestRowFor('last', 'max');
              const spreadRow = bestRowFor('spread', 'max');
              const finishMetricOptions = [
                { id: 'fastest' as const, label: 'Fastest', field: 'fastest' as const },
                { id: 'average' as const, label: 'Average', field: 'average' as const },
                { id: 'median' as const, label: 'Median', field: 'median' as const },
                { id: 'last' as const, label: 'Last Finisher', field: 'last' as const },
                { id: 'spread' as const, label: 'Finish Spread', field: 'spread' as const },
              ];
              const selectedFinishMetric = finishMetricOptions.find(option => option.id === finishTrendMetric) ?? finishMetricOptions[2];
              const finishChartData = ftByYear.map((row, index) => ({
                label: row.label,
                value: row[selectedFinishMetric.field],
                yearColor: yearColors[index],
              }));
              const selectedMetricValues = finishChartData.map(point => point.value).filter((value): value is number => value != null);
              const selectedMetricMin = selectedMetricValues.length > 0 ? Math.min(...selectedMetricValues) : 0;
              const selectedMetricMax = selectedMetricValues.length > 0 ? Math.max(...selectedMetricValues) : 0;
              const selectedMetricRange = selectedMetricMax - selectedMetricMin;
              const selectedMetricPadding = Math.max(60, selectedMetricRange * 0.2);
              const selectedMetricDomain: [number, number] = [
                Math.max(0, selectedMetricMin - selectedMetricPadding),
                selectedMetricMax + selectedMetricPadding,
              ];
              const performanceInsights = (() => {
                if (ftRowsWithData.length < 2) return [];
                const first = ftRowsWithData[0];
                const latest = ftRowsWithData[ftRowsWithData.length - 1];
                const insights: string[] = [];
                if (first.median != null && latest.median != null) {
                  const delta = latest.median - first.median;
                  insights.push(Math.abs(delta) < 60
                    ? `${activeTrendEventName} median finish time was broadly stable from ${first.label} to ${latest.label}.`
                    : `${activeTrendEventName} median finish time ${delta < 0 ? 'improved' : 'slowed'} from ${fmtTime(Math.round(first.median))} in ${first.label} to ${fmtTime(Math.round(latest.median))} in ${latest.label}.`);
                }
                if (first.spread != null && latest.spread != null) {
                  const delta = latest.spread - first.spread;
                  insights.push(Math.abs(delta) < 300
                    ? `Finish spread was broadly similar across the comparison period.`
                    : `Finish spread ${delta < 0 ? 'narrowed' : 'widened'} from ${fmtTime(Math.round(first.spread))} to ${fmtTime(Math.round(latest.spread))}.`);
                }
                if (first.last != null && latest.last != null) {
                  const delta = latest.last - first.last;
                  if (Math.abs(delta) >= 300) {
                    insights.push(`Last finisher moved ${delta < 0 ? 'earlier' : 'later'} from ${fmtTime(Math.round(first.last))} to ${fmtTime(Math.round(latest.last))}.`);
                  }
                }
                return insights.slice(0, 3);
              })();

              if (ftRowsWithData.length === 0) {
                return (
                  <section id="rr-times" className="chart-section" style={{ order: 10 }}>
                    <SectionHeader title="Finish Times" contextStrip={selectedTrendContextStrip} />
                    <p className="rd-empty-group">Finish time trends are not available for the selected event.</p>
                  </section>
                );
              }

              const timeDeltaFormatter = (spread = false) => (delta: number, firstLabel?: string) => formatTimeDelta(delta, firstLabel, spread);

              return (
                <section id="rr-times" className="chart-section rr-finish-performance-section" style={{ order: 10 }}>
                  <SectionHeader title="Finish Times" contextStrip={selectedTrendContextStrip} />
                  <div className="rd-tab-strip" role="tablist" aria-label="Finish times views">
                    {(['charts', 'table'] as const).map(id => (
                      <button key={id} type="button" role="tab"
                        aria-selected={timesTab === id}
                        className={`rd-tab${timesTab === id ? ' rd-tab--active' : ''}`}
                        onClick={() => setTimesTab(id)}
                      >
                        {id === 'charts' ? 'Charts' : 'Table'}
                      </button>
                    ))}
                  </div>
                  {timesTab === 'charts' && (
                    <div role="tabpanel" className="rd-tab-panel">
                      <div className="rr-finish-performance-panel">
                        <div className="rr-finish-panel-heading">
                          <span aria-hidden="true">⏱</span>
                          <span>Performance summary</span>
                        </div>
                        <div className="trend-cards-grid trend-cards-grid--five rr-finish-trend-cards">
                          <ResultsTrendCard title="Fastest Time" data={trendForTime('fastest')} formatValue={(v) => fmtTime(Math.round(v))} deltaInvert barColors={yearColors} showBarLabels formatDelta={timeDeltaFormatter()} featuredValue={fastestRow?.fastest ?? null} featuredSub={fastestRow ? `Best year: ${fastestRow.label}` : undefined} />
                          <ResultsTrendCard title="Average Time" data={trendForTime('average')} formatValue={(v) => fmtTime(Math.round(v))} deltaInvert barColors={yearColors} showBarLabels formatDelta={timeDeltaFormatter()} featuredValue={averageRow?.average ?? null} featuredSub={averageRow ? `Best year: ${averageRow.label}` : undefined} />
                          <ResultsTrendCard title="Median Time" data={trendForTime('median')} formatValue={(v) => fmtTime(Math.round(v))} deltaInvert barColors={yearColors} showBarLabels formatDelta={timeDeltaFormatter()} featuredValue={medianRow?.median ?? null} featuredSub={medianRow ? `Best year: ${medianRow.label}` : undefined} />
                          <ResultsTrendCard title="Last Finisher" data={trendForTime('last')} formatValue={(v) => fmtTime(Math.round(v))} deltaInvert barColors={yearColors} showBarLabels formatDelta={timeDeltaFormatter()} featuredValue={lastRow?.last ?? null} featuredSub={lastRow ? `Slowest year: ${lastRow.label}` : undefined} />
                          <ResultsTrendCard title="Finish Spread" data={trendForTime('spread')} formatValue={(v) => fmtTime(Math.round(v))} deltaInvert barColors={yearColors} showBarLabels formatDelta={timeDeltaFormatter(true)} featuredValue={spreadRow?.spread ?? null} featuredSub={spreadRow ? `Largest spread: ${spreadRow.label}` : undefined} />
                        </div>
                        <div className="rr-finish-chart-toolbar">
                          <div className="metric-pills" role="group" aria-label="Select finish times chart">
                            {finishMetricOptions.map(option => (
                              <button key={option.id} type="button"
                                className={`metric-pill${selectedFinishMetric.id === option.id ? ' metric-pill--active' : ''}`}
                                aria-pressed={selectedFinishMetric.id === option.id}
                                onClick={() => setFinishTrendMetric(option.id)}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="rr-finish-line-chart" aria-hidden="true">
                          <ResponsiveContainer width="100%" height={230}>
                            <LineChart
                              data={finishChartData}
                              margin={{ top: 10, right: 24, bottom: 4, left: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                              <YAxis
                                tick={{ fontSize: 11 }}
                                tickFormatter={(value: number) => fmtTime(Math.round(value))}
                                width={70}
                                domain={selectedMetricDomain}
                              />
                              <Tooltip
                                formatter={(value: number) => [fmtTime(Math.round(value)), selectedFinishMetric.label]}
                                labelFormatter={(label: string) => label}
                                contentStyle={{ fontSize: '0.8rem' }}
                              />
                              <Line
                                type="monotone"
                                dataKey="value"
                                name={selectedFinishMetric.label}
                                stroke={theme.primary}
                                strokeWidth={2.75}
                                dot={({ cx, cy, payload }) => (
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={4}
                                    fill={payload.yearColor}
                                    stroke="#fff"
                                    strokeWidth={1.5}
                                  />
                                )}
                                activeDot={{ r: 5.5, stroke: '#fff', strokeWidth: 1.5 }}
                                connectNulls={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="chart-note">Y-axis is scaled to highlight year-over-year change. Times are shown as race-clock values.</p>
                      </div>
                    </div>
                  )}
                  {timesTab === 'table' && (
                    <div role="tabpanel" className="rd-tab-panel">
                      <div className="cmp-table-scroll">
                        <table className="stats-table cmp-table">
                          <caption className="sr-only">Finish time statistics by year</caption>
                          <thead>
                            <tr>
                              <th scope="col">Year</th>
                              <th scope="col">Fastest Time</th>
                              <th scope="col">Average Time</th>
                              <th scope="col">Median Time</th>
                              <th scope="col">Last Finisher</th>
                              <th scope="col">Finish Spread</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ftByYear.map(d => (
                              <tr key={d.label}>
                                <td>{d.label}</td>
                                <td>{d.fastest != null ? fmtTime(Math.round(d.fastest)) : '—'}</td>
                                <td>{d.average != null ? fmtTime(Math.round(d.average)) : '—'}</td>
                                <td>{d.median != null ? fmtTime(Math.round(d.median)) : '—'}</td>
                                <td>{d.last != null ? fmtTime(Math.round(d.last)) : '—'}</td>
                                <td>{d.spread != null ? fmtTime(Math.round(d.spread)) : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {performanceInsights.length > 0 && (
                    <div className="insight-callout">
                      <ul className="insight-callout-list">
                        {performanceInsights.map(item => (
                          <li key={item} className="insight-callout-item">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              );
            })()}

            {/* ── 10. Pace / Distance Trends ── */}
            {hasEventPerformanceTrends && (() => {
              if (!activeTrendEventName) return null;
              const fixedDistanceMetrics = [
                { id: 'fastestPace' as const, label: 'Fastest Pace', field: 'fastestPace' as const },
                { id: 'averagePace' as const, label: 'Average Pace', field: 'averagePace' as const },
                { id: 'medianPace' as const, label: 'Median Pace', field: 'medianPace' as const },
                { id: 'lastPace' as const, label: 'Last Finisher Pace', field: 'lastPace' as const },
                { id: 'paceSpread' as const, label: 'Pace Spread', field: 'paceSpread' as const },
              ];
              const fixedTimeMetrics = [
                { id: 'shortestDistance' as const, label: 'Shortest Distance', field: 'shortestDistance' as const },
                { id: 'averageDistance' as const, label: 'Average Distance', field: 'averageDistance' as const },
                { id: 'medianDistance' as const, label: 'Median Distance', field: 'medianDistance' as const },
                { id: 'farthestDistance' as const, label: 'Farthest Distance', field: 'farthestDistance' as const },
                { id: 'distanceSpread' as const, label: 'Distance Spread', field: 'distanceSpread' as const },
              ];
              const metricOptions = isFixedDist ? fixedDistanceMetrics : fixedTimeMetrics;
              const selectedMetric = metricOptions.find(option => option.id === eventPerfMetric) ?? metricOptions[2];
              const eventPerformanceRows = intervals.map((iv, index) => {
                const event = iv.stats.performance.events.find(item => item.eventName === activeTrendEventName);
                const pace = event?.paceStats ?? null;
                const distance = event?.distanceAchieved ?? null;
                return {
                  label: iv.label,
                  yearColor: yearColors[index],
                  fastestPace: pace?.fastestSecsPerMile ?? null,
                  averagePace: pace?.meanSecsPerMile ?? null,
                  medianPace: pace?.medianSecsPerMile ?? null,
                  lastPace: pace?.slowestSecsPerMile ?? null,
                  paceSpread: pace?.spreadSecsPerMile ?? null,
                  shortestDistance: distance?.minMiles ?? null,
                  averageDistance: distance?.meanMiles ?? null,
                  medianDistance: distance?.medianMiles ?? null,
                  farthestDistance: distance?.maxMiles ?? null,
                  distanceSpread: distance?.spreadMiles ?? null,
                };
              });
              const hasSelectedEventPerformanceData = eventPerformanceRows.some(row => metricOptions.some(option => row[option.field] != null));
              const formatPerformanceValue = (value: number | null): string => {
                if (value == null) return '—';
                return isFixedDist ? fmtPace(value) : fmtDist(value);
              };
              const trendForPerformance = (field: typeof metricOptions[number]['field']) =>
                eventPerformanceRows.map(row => ({ label: row.label, value: row[field] }));
              const bestRowFor = (field: typeof metricOptions[number]['field'], direction: 'min' | 'max') => {
                const rows = eventPerformanceRows.filter((row): row is typeof row & Record<typeof field, number> => row[field] != null);
                if (rows.length === 0) return null;
                return rows.reduce((best, row) => direction === 'min'
                  ? row[field] < best[field] ? row : best
                  : row[field] > best[field] ? row : best, rows[0]);
              };
              const selectedMetricChartData = eventPerformanceRows.map(row => ({
                label: row.label,
                value: row[selectedMetric.field],
                yearColor: row.yearColor,
              }));
              const selectedMetricValues = selectedMetricChartData.map(point => point.value).filter((value): value is number => value != null);
              const selectedMetricMin = selectedMetricValues.length > 0 ? Math.min(...selectedMetricValues) : 0;
              const selectedMetricMax = selectedMetricValues.length > 0 ? Math.max(...selectedMetricValues) : 0;
              const selectedMetricRange = selectedMetricMax - selectedMetricMin;
              const selectedMetricPadding = Math.max(isFixedDist ? 5 : 0.25, selectedMetricRange * 0.2);
              const selectedMetricDomain: [number, number] = [
                Math.max(0, selectedMetricMin - selectedMetricPadding),
                selectedMetricMax + selectedMetricPadding,
              ];
              const performanceDeltaFormatter = (lowerIsBetter = true, spread = false) => (delta: number, firstLabel?: string) => {
                const since = firstLabel ? ` since ${firstLabel}` : '';
                const stableThreshold = isFixedDist ? 5 : 0.25;
                if (Math.abs(delta) < stableThreshold) return `stable${since}`;
                if (spread) return `${delta < 0 ? 'narrower' : 'wider'}${since}`;
                if (isFixedDist) return `${delta < 0 ? 'faster' : 'slower'}${since}`;
                return `${delta > 0 ? 'farther' : 'shorter'}${since}`;
              };
              const firstPerf = eventPerformanceRows.find(row => metricOptions.some(option => row[option.field] != null));
              const latestPerf = [...eventPerformanceRows].reverse().find(row => metricOptions.some(option => row[option.field] != null));
              const eventPerformanceInsights = (() => {
                if (!firstPerf || !latestPerf) return [];
                const insights: string[] = [];
                if (isFixedDist) {
                  if (firstPerf.medianPace != null && latestPerf.medianPace != null) {
                    const delta = latestPerf.medianPace - firstPerf.medianPace;
                    insights.push(Math.abs(delta) < 5
                      ? `${activeTrendEventName} median pace was broadly stable from ${firstPerf.label} to ${latestPerf.label}.`
                      : `${activeTrendEventName} median pace ${delta < 0 ? 'improved' : 'slowed'} from ${fmtPace(firstPerf.medianPace)} in ${firstPerf.label} to ${fmtPace(latestPerf.medianPace)} in ${latestPerf.label}.`);
                  }
                  if (firstPerf.paceSpread != null && latestPerf.paceSpread != null) {
                    const delta = latestPerf.paceSpread - firstPerf.paceSpread;
                    if (Math.abs(delta) >= 5) {
                      insights.push(`Pace spread ${delta < 0 ? 'narrowed' : 'widened'} from ${fmtPace(firstPerf.paceSpread)} to ${fmtPace(latestPerf.paceSpread)}.`);
                    }
                  }
                } else {
                  if (firstPerf.medianDistance != null && latestPerf.medianDistance != null) {
                    const delta = latestPerf.medianDistance - firstPerf.medianDistance;
                    insights.push(Math.abs(delta) < 0.25
                      ? `${activeTrendEventName} median distance was broadly stable from ${firstPerf.label} to ${latestPerf.label}.`
                      : `${activeTrendEventName} median distance ${delta > 0 ? 'increased' : 'decreased'} from ${fmtDist(firstPerf.medianDistance)} in ${firstPerf.label} to ${fmtDist(latestPerf.medianDistance)} in ${latestPerf.label}.`);
                  }
                  if (firstPerf.distanceSpread != null && latestPerf.distanceSpread != null) {
                    const delta = latestPerf.distanceSpread - firstPerf.distanceSpread;
                    if (Math.abs(delta) >= 0.25) {
                      insights.push(`Distance spread ${delta > 0 ? 'widened' : 'narrowed'} from ${fmtDist(firstPerf.distanceSpread)} to ${fmtDist(latestPerf.distanceSpread)}.`);
                    }
                  }
                }
                return insights.slice(0, 3);
              })();

              return (
                <section id="rr-event-performance" className="chart-section rr-event-performance-section" style={{ order: 11 }}>
                  <SectionHeader title={isFixedDist ? 'Pace Trends' : 'Distance Trends'} contextStrip={selectedTrendContextStrip} />
                  <p className="rr-event-performance-helper">
                    {isFixedDist
                      ? 'Pace normalizes finish times for the selected event, making year-over-year changes easier to compare.'
                      : 'Distance achieved normalizes performance for the selected event, making year-over-year changes easier to compare.'}
                  </p>
                  <div className="rd-tab-strip" role="tablist" aria-label={isFixedDist ? 'Pace trends views' : 'Distance trends views'}>
                    {(['charts', 'table'] as const).map(id => (
                      <button key={id} type="button" role="tab"
                        aria-selected={eventPerfTab === id}
                        className={`rd-tab${eventPerfTab === id ? ' rd-tab--active' : ''}`}
                        onClick={() => setEventPerfTab(id)}
                      >
                        {id === 'charts' ? 'Charts' : 'Table'}
                      </button>
                    ))}
                  </div>
                  {eventPerfTab === 'charts' && (
                    <div role="tabpanel" className="rd-tab-panel">
                      {!hasSelectedEventPerformanceData ? (
                        <p className="rd-empty-group">Event performance trend data is not available for the selected event.</p>
                      ) : (
                        <div className="rr-finish-performance-panel">
                          <div className="rr-finish-panel-heading">
                            <span aria-hidden="true">{isFixedDist ? '↗' : '↔'}</span>
                            <span>{isFixedDist ? 'Pace Trend Summary' : 'Distance Trend Summary'}</span>
                          </div>
                          <div className="trend-cards-grid trend-cards-grid--five rr-finish-trend-cards">
                            {isFixedDist ? (
                              <>
                                <ResultsTrendCard title="Fastest Pace" data={trendForPerformance('fastestPace')} formatValue={formatPerformanceValue} deltaInvert barColors={yearColors} showBarLabels formatDelta={performanceDeltaFormatter(true)} featuredValue={bestRowFor('fastestPace', 'min')?.fastestPace ?? null} featuredSub={bestRowFor('fastestPace', 'min') ? `Best year: ${bestRowFor('fastestPace', 'min')!.label}` : undefined} />
                                <ResultsTrendCard title="Average Pace" data={trendForPerformance('averagePace')} formatValue={formatPerformanceValue} deltaInvert barColors={yearColors} showBarLabels formatDelta={performanceDeltaFormatter(true)} featuredValue={bestRowFor('averagePace', 'min')?.averagePace ?? null} featuredSub={bestRowFor('averagePace', 'min') ? `Best year: ${bestRowFor('averagePace', 'min')!.label}` : undefined} />
                                <ResultsTrendCard title="Median Pace" data={trendForPerformance('medianPace')} formatValue={formatPerformanceValue} deltaInvert barColors={yearColors} showBarLabels formatDelta={performanceDeltaFormatter(true)} featuredValue={bestRowFor('medianPace', 'min')?.medianPace ?? null} featuredSub={bestRowFor('medianPace', 'min') ? `Best year: ${bestRowFor('medianPace', 'min')!.label}` : undefined} />
                                <ResultsTrendCard title="Last Finisher Pace" data={trendForPerformance('lastPace')} formatValue={formatPerformanceValue} deltaInvert barColors={yearColors} showBarLabels formatDelta={performanceDeltaFormatter(true)} featuredValue={bestRowFor('lastPace', 'max')?.lastPace ?? null} featuredSub={bestRowFor('lastPace', 'max') ? `Slowest year: ${bestRowFor('lastPace', 'max')!.label}` : undefined} />
                                <ResultsTrendCard title="Pace Spread" data={trendForPerformance('paceSpread')} formatValue={formatPerformanceValue} deltaInvert barColors={yearColors} showBarLabels formatDelta={performanceDeltaFormatter(true, true)} featuredValue={bestRowFor('paceSpread', 'max')?.paceSpread ?? null} featuredSub={bestRowFor('paceSpread', 'max') ? `Largest spread: ${bestRowFor('paceSpread', 'max')!.label}` : undefined} />
                              </>
                            ) : (
                              <>
                                <ResultsTrendCard title="Shortest Distance" data={trendForPerformance('shortestDistance')} formatValue={formatPerformanceValue} barColors={yearColors} showBarLabels formatDelta={performanceDeltaFormatter(false)} featuredValue={bestRowFor('shortestDistance', 'min')?.shortestDistance ?? null} featuredSub={bestRowFor('shortestDistance', 'min') ? `Shortest year: ${bestRowFor('shortestDistance', 'min')!.label}` : undefined} />
                                <ResultsTrendCard title="Average Distance" data={trendForPerformance('averageDistance')} formatValue={formatPerformanceValue} barColors={yearColors} showBarLabels formatDelta={performanceDeltaFormatter(false)} featuredValue={bestRowFor('averageDistance', 'max')?.averageDistance ?? null} featuredSub={bestRowFor('averageDistance', 'max') ? `Best year: ${bestRowFor('averageDistance', 'max')!.label}` : undefined} />
                                <ResultsTrendCard title="Median Distance" data={trendForPerformance('medianDistance')} formatValue={formatPerformanceValue} barColors={yearColors} showBarLabels formatDelta={performanceDeltaFormatter(false)} featuredValue={bestRowFor('medianDistance', 'max')?.medianDistance ?? null} featuredSub={bestRowFor('medianDistance', 'max') ? `Best year: ${bestRowFor('medianDistance', 'max')!.label}` : undefined} />
                                <ResultsTrendCard title="Farthest Distance" data={trendForPerformance('farthestDistance')} formatValue={formatPerformanceValue} barColors={yearColors} showBarLabels formatDelta={performanceDeltaFormatter(false)} featuredValue={bestRowFor('farthestDistance', 'max')?.farthestDistance ?? null} featuredSub={bestRowFor('farthestDistance', 'max') ? `Best year: ${bestRowFor('farthestDistance', 'max')!.label}` : undefined} />
                                <ResultsTrendCard title="Distance Spread" data={trendForPerformance('distanceSpread')} formatValue={formatPerformanceValue} barColors={yearColors} showBarLabels formatDelta={performanceDeltaFormatter(false, true)} featuredValue={bestRowFor('distanceSpread', 'max')?.distanceSpread ?? null} featuredSub={bestRowFor('distanceSpread', 'max') ? `Largest spread: ${bestRowFor('distanceSpread', 'max')!.label}` : undefined} />
                              </>
                            )}
                          </div>
                          <div className="rr-finish-chart-toolbar">
                            <div className="metric-pills" role="group" aria-label={isFixedDist ? 'Select pace metric' : 'Select distance metric'}>
                              {metricOptions.map(option => (
                                <button key={option.id} type="button"
                                  className={`metric-pill${selectedMetric.id === option.id ? ' metric-pill--active' : ''}`}
                                  aria-pressed={selectedMetric.id === option.id}
                                  onClick={() => setEventPerfMetric(option.id)}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <p className="rr-event-perf-chart-label">
                            {isFixedDist ? 'Selected Pace Metric by Year' : 'Selected Distance Metric by Year'}
                          </p>
                          <div className="rr-finish-line-chart" aria-hidden="true">
                            <ResponsiveContainer width="100%" height={230}>
                              <LineChart data={selectedMetricChartData} margin={{ top: 10, right: 24, bottom: 4, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                                <YAxis
                                  tick={{ fontSize: 11 }}
                                  tickFormatter={(value: number) => formatPerformanceValue(value)}
                                  width={isFixedDist ? 76 : 58}
                                  domain={selectedMetricDomain}
                                />
                                <Tooltip
                                  formatter={(value: number) => [formatPerformanceValue(value), selectedMetric.label]}
                                  labelFormatter={(label: string) => label}
                                  contentStyle={{ fontSize: '0.8rem' }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="value"
                                  name={selectedMetric.label}
                                  stroke="#3b82f6"
                                  strokeWidth={2.75}
                                  dot={({ cx, cy, payload }) => (
                                    <circle cx={cx} cy={cy} r={4} fill={payload.yearColor} stroke="#fff" strokeWidth={1.5} />
                                  )}
                                  activeDot={{ r: 5.5, stroke: '#fff', strokeWidth: 1.5 }}
                                  connectNulls={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                          <p className="chart-note">Y-axis is scaled to highlight year-over-year change.</p>
                        </div>
                      )}
                    </div>
                  )}
                  {eventPerfTab === 'table' && (
                    <div role="tabpanel" className="rd-tab-panel">
                      <div className="cmp-table-scroll">
                        <table className="stats-table cmp-table">
                          <caption className="sr-only">{isFixedDist ? 'Pace trends by year' : 'Distance trends by year'}</caption>
                          <thead>
                            <tr>
                              <th scope="col">Year</th>
                              {metricOptions.map(option => <th scope="col" key={option.id}>{option.label}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {eventPerformanceRows.map(row => (
                              <tr key={row.label}>
                                <td>{row.label}</td>
                                {metricOptions.map(option => (
                                  <td key={option.id}>{formatPerformanceValue(row[option.field])}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {eventPerformanceInsights.length > 0 && (
                    <div className="insight-callout">
                      <ul className="insight-callout-list">
                        {eventPerformanceInsights.map(item => (
                          <li key={item} className="insight-callout-item">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              );
            })()}

            {/* ── 6. Finisher Gender ── */}
            {hasEventPerformanceTrends && (() => {
              if (!activeTrendEventName) return null;
              const gc = genderColors(theme);

              // Per-event finisher counts by gender for each interval
              const genderRows = intervals.map((iv, index) => {
                const event = iv.stats.performance.events.find(e => e.eventName === activeTrendEventName);
                const byGender = isFixedDist
                  ? event?.finishTime?.byGender ?? null
                  : event?.distanceAchieved?.byGender ?? null;
                const female    = byGender?.find(g => g.gender === 'F')?.finishers  ?? 0;
                const male      = byGender?.find(g => g.gender === 'M')?.finishers  ?? 0;
                const nonBinary = byGender?.find(g => g.gender === 'NB')?.finishers ?? 0;
                const total = female + male + nonBinary;
                return {
                  label: iv.label,
                  yearColor: yearColors[index],
                  female, male, nonBinary, total,
                  femalePct:  total > 0 ? (female    / total) * 100 : 0,
                  malePct:    total > 0 ? (male      / total) * 100 : 0,
                  nbPct:      total > 0 ? (nonBinary / total) * 100 : 0,
                };
              });
              const hasNonBinary   = genderRows.some(row => row.nonBinary > 0);
              const rowsWithData   = genderRows.filter(row => row.total > 0);

              // Chart data: years on X-axis, F/M/NB as bar groups
              const chartData = genderRows.map(row => ({
                label:          row.label,
                'Female':       parseFloat(row.femalePct.toFixed(1)),
                'Male':         parseFloat(row.malePct.toFixed(1)),
                ...(hasNonBinary ? { 'Non-Binary': parseFloat(row.nbPct.toFixed(1)) } : {}),
              }));

              // Insights: earliest-to-latest for this event
              const firstRow  = rowsWithData[0];
              const lastRow   = rowsWithData[rowsWithData.length - 1];
              const genderInsights: string[] = [];
              if (firstRow && lastRow && firstRow.label !== lastRow.label) {
                const fDelta  = lastRow.femalePct  - firstRow.femalePct;
                const mDelta  = lastRow.malePct    - firstRow.malePct;
                genderInsights.push(Math.abs(fDelta) < 0.5
                  ? `Female finishers in ${activeTrendEventName} remained stable from ${firstRow.label} to ${lastRow.label}.`
                  : `Female finishers ${fDelta > 0 ? 'increased' : 'decreased'} by ${Math.abs(fDelta).toFixed(1)} pts from ${firstRow.label} to ${lastRow.label}.`);
                genderInsights.push(Math.abs(mDelta) < 0.5
                  ? `Male finishers in ${activeTrendEventName} remained stable from ${firstRow.label} to ${lastRow.label}.`
                  : `Male finishers ${mDelta > 0 ? 'increased' : 'decreased'} by ${Math.abs(mDelta).toFixed(1)} pts from ${firstRow.label} to ${lastRow.label}.`);
                if (hasNonBinary) {
                  const nbDelta = lastRow.nbPct - firstRow.nbPct;
                  if (Math.abs(nbDelta) >= 0.5) {
                    genderInsights.push(`Non-Binary finishers ${nbDelta > 0 ? 'increased' : 'decreased'} by ${Math.abs(nbDelta).toFixed(1)} pts from ${firstRow.label} to ${lastRow.label}.`);
                  }
                }
              }

              return (
                <section id="rr-gender" className="chart-section" style={{ order: 9 }}>
                  <SectionHeader title="Finisher Gender" contextStrip={selectedTrendContextStrip} />
                  <div className="rd-tab-strip" role="tablist" aria-label="Finisher gender trends views">
                    {(['charts', 'table'] as const).map(id => (
                      <button key={id} type="button" role="tab"
                        aria-selected={genderTab === id}
                        className={`rd-tab${genderTab === id ? ' rd-tab--active' : ''}`}
                        onClick={() => setGenderTab(id)}
                      >
                        {id === 'charts' ? 'Charts' : 'Table'}
                      </button>
                    ))}
                  </div>
                  {genderTab === 'charts' && (
                    <div role="tabpanel" className="rd-tab-panel">
                      {rowsWithData.length === 0 ? (
                        <p className="rd-empty-group">Gender trend data is not available for the selected event.</p>
                      ) : (
                        <div className="chart-wrap chart-wrap--full" aria-hidden="true">
                          <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={chartData} barGap={4} barCategoryGap="32%"
                              margin={{ top: 20, right: 16, bottom: 4, left: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} domain={[0, 100]} />
                              <Tooltip contentStyle={{ fontSize: '0.8rem' }} formatter={(v: number, name: string) => [fmtPct(v), name]} />
                              <Legend verticalAlign="top" iconType="square" iconSize={10} wrapperStyle={{ fontSize: '0.75rem', paddingBottom: 6 }} />
                              <Bar dataKey="Female" fill={gc.F} radius={[3, 3, 0, 0]}>
                                <LabelList dataKey="Female" position="top" formatter={(v: number) => v > 0 ? `${v.toFixed(0)}%` : ''} style={{ fontSize: '0.7rem', fill: '#555' }} />
                              </Bar>
                              <Bar dataKey="Male" fill={gc.M} radius={[3, 3, 0, 0]}>
                                <LabelList dataKey="Male" position="top" formatter={(v: number) => v > 0 ? `${v.toFixed(0)}%` : ''} style={{ fontSize: '0.7rem', fill: '#555' }} />
                              </Bar>
                              {hasNonBinary && (
                                <Bar dataKey="Non-Binary" fill={gc.NB} radius={[3, 3, 0, 0]}>
                                  <LabelList dataKey="Non-Binary" position="top" formatter={(v: number) => v > 0 ? `${v.toFixed(1)}%` : ''} style={{ fontSize: '0.7rem', fill: '#555' }} />
                                </Bar>
                              )}
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  )}
                  {genderTab === 'table' && (
                    <div role="tabpanel" className="rd-tab-panel">
                      <div className="cmp-table-scroll">
                        <table className="stats-table cmp-table">
                          <caption className="sr-only">Finisher gender trends by year for {activeTrendEventName}</caption>
                          <thead>
                            <tr>
                              <th scope="col">Year</th>
                              <th scope="col">Female</th>
                              <th scope="col">Female %</th>
                              <th scope="col">Male</th>
                              <th scope="col">Male %</th>
                              {hasNonBinary && <th scope="col">Non-Binary</th>}
                              {hasNonBinary && <th scope="col">Non-Binary %</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {genderRows.map(row => (
                              <tr key={row.label}>
                                <td>{row.label}</td>
                                <td>{row.female.toLocaleString()}</td>
                                <td>{row.total > 0 ? fmtPct(row.femalePct) : '—'}</td>
                                <td>{row.male.toLocaleString()}</td>
                                <td>{row.total > 0 ? fmtPct(row.malePct) : '—'}</td>
                                {hasNonBinary && <td>{row.nonBinary.toLocaleString()}</td>}
                                {hasNonBinary && <td>{row.total > 0 ? fmtPct(row.nbPct) : '—'}</td>}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {genderInsights.length > 0 && (
                    <div className="insight-callout">
                      <ul className="insight-callout-list">
                        {genderInsights.map(item => (
                          <li key={item} className="insight-callout-item">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              );
            })()}

            {/* ── 7. Finisher Age ── */}
            {hasEventPerformanceTrends && (() => {
              if (!activeTrendEventName) return null;

              // Per-event finisher age for each interval
              const ageRows = intervals.map((iv, i) => {
                const eventAge = iv.stats.ageDistributionByEvent.find(e => e.eventName === activeTrendEventName)?.finisherAge ?? null;
                return {
                  label:     iv.label,
                  yearColor: yearColors[i],
                  median:    eventAge?.median ?? null,
                  mean:      eventAge?.mean   ?? null,
                  min:       eventAge?.min    ?? null,
                  max:       eventAge?.max    ?? null,
                };
              });
              const firstAgeRow  = ageRows.find(r => r.median != null || r.mean != null);
              const lastAgeRow   = [...ageRows].reverse().find(r => r.median != null || r.mean != null);

              // TrendPoint arrays for ResultsTrendCard
              const youngestTrend: TrendPoint[] = ageRows.map(r => ({ label: r.label, value: r.min }));
              const oldestTrend:   TrendPoint[] = ageRows.map(r => ({ label: r.label, value: r.max }));
              const medianTrend:  TrendPoint[] = ageRows.map(r => ({ label: r.label, value: r.median }));
              const averageTrend: TrendPoint[] = ageRows.map(r => ({ label: r.label, value: r.mean   }));
              const youngestAllYears = ageRows.reduce<typeof ageRows[number] | null>((best, row) => {
                if (row.min == null) return best;
                if (!best || best.min == null || row.min < best.min || row.min === best.min) return row;
                return best;
              }, null);
              const oldestAllYears = ageRows.reduce<typeof ageRows[number] | null>((best, row) => {
                if (row.max == null) return best;
                if (!best || best.max == null || row.max > best.max || row.max === best.max) return row;
                return best;
              }, null);
              const fmtAgeValue = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);
              const fmtAgeDelta = (delta: number, firstLabel?: string) => {
                if (Math.abs(delta) < 0.05) return firstLabel ? `stable since ${firstLabel}` : 'stable';
                return `${delta > 0 ? '+' : ''}${delta.toFixed(1)} yrs${firstLabel ? ` since ${firstLabel}` : ''}`;
              };

              // Insights
              const ageInsights: string[] = [];
              if (firstAgeRow && lastAgeRow && firstAgeRow.label !== lastAgeRow.label) {
                if (firstAgeRow.median != null && lastAgeRow.median != null) {
                  const d = lastAgeRow.median - firstAgeRow.median;
                  ageInsights.push(Math.abs(d) < 1
                    ? `Median finisher age in ${activeTrendEventName} remained stable from ${firstAgeRow.label} to ${lastAgeRow.label}.`
                    : `Median finisher age ${d > 0 ? 'increased' : 'decreased'} by ${Math.abs(d).toFixed(1)} yrs from ${firstAgeRow.label} to ${lastAgeRow.label}.`);
                }
                if (firstAgeRow.mean != null && lastAgeRow.mean != null) {
                  const d = lastAgeRow.mean - firstAgeRow.mean;
                  if (Math.abs(d) >= 1) {
                    ageInsights.push(`Average age ${d > 0 ? 'increased' : 'decreased'} by ${Math.abs(d).toFixed(1)} yrs from ${firstAgeRow.label} to ${lastAgeRow.label}.`);
                  }
                }
                if (firstAgeRow.max != null && lastAgeRow.max != null && firstAgeRow.max !== lastAgeRow.max) {
                  ageInsights.push(`The oldest finisher changed from age ${firstAgeRow.max} to ${lastAgeRow.max}.`);
                }
              }

              return (
                <section id="rr-age-trends" className="chart-section" style={{ order: 7 }}>
                  <SectionHeader title="Finisher Age" contextStrip={selectedTrendContextStrip} />
                  <p className="chart-note">Track how the selected event's finisher age profile changed across years.</p>

                  <div className="rd-tab-strip" role="tablist" aria-label="Finisher age trends views">
                    {(['summary', 'table'] as const).map(id => (
                      <button key={id} type="button" role="tab"
                        aria-selected={ageTrendsTab === id}
                        className={`rd-tab${ageTrendsTab === id ? ' rd-tab--active' : ''}`}
                        onClick={() => setAgeTrendsTab(id)}
                      >
                        {id === 'summary' ? 'Summary' : 'Table'}
                      </button>
                    ))}
                  </div>

                  {ageTrendsTab === 'summary' && (
                    <div role="tabpanel" className="rd-tab-panel">
                      <div className="trend-cards-grid trend-cards-grid--secondary">
                        <ResultsTrendCard
                          title="Youngest (All Years)"
                          data={youngestTrend}
                          precision={0}
                          formatValue={fmtAgeValue}
                          featuredValue={youngestAllYears?.min ?? null}
                          featuredSub={youngestAllYears ? `Year: ${youngestAllYears.label}` : undefined}
                          barColors={yearColors}
                          showBarLabels
                        />
                        <ResultsTrendCard
                          title="Oldest (All Years)"
                          data={oldestTrend}
                          precision={0}
                          formatValue={fmtAgeValue}
                          featuredValue={oldestAllYears?.max ?? null}
                          featuredSub={oldestAllYears ? `Year: ${oldestAllYears.label}` : undefined}
                          barColors={yearColors}
                          showBarLabels
                        />
                        <ResultsTrendCard
                          title="Average Age by Year"
                          data={averageTrend}
                          precision={1}
                          formatValue={fmtAgeValue}
                          unit=" yrs"
                          barColors={yearColors}
                          showBarLabels
                          formatDelta={fmtAgeDelta}
                        />
                        <ResultsTrendCard
                          title="Median Age by Year"
                          data={medianTrend}
                          precision={1}
                          formatValue={fmtAgeValue}
                          unit=" yrs"
                          barColors={yearColors}
                          showBarLabels
                          formatDelta={fmtAgeDelta}
                        />
                      </div>
                    </div>
                  )}

                  {ageTrendsTab === 'table' && (
                    <div role="tabpanel" className="rd-tab-panel">
                      <div className="cmp-table-scroll">
                        <table className="stats-table cmp-table">
                          <caption className="sr-only">Finisher age trends by year for {activeTrendEventName}</caption>
                          <thead>
                            <tr>
                              <th scope="col">Year</th>
                              <th scope="col">Average Age</th>
                              <th scope="col">Median Age</th>
                              <th scope="col">Youngest</th>
                              <th scope="col">Oldest</th>
                              <th scope="col">Age Range</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ageRows.map(row => (
                              <tr key={row.label}>
                                <td>{row.label}</td>
                                <td>{row.mean   != null ? row.mean.toFixed(1)   : '—'}</td>
                                <td>{row.median != null ? row.median.toFixed(1) : '—'}</td>
                                <td>{row.min ?? '—'}</td>
                                <td>{row.max ?? '—'}</td>
                                <td>{row.min != null && row.max != null ? `${row.min}–${row.max}` : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {ageInsights.length > 0 && (
                    <div className="insight-callout">
                      <ul className="insight-callout-list">
                        {ageInsights.map(item => (
                          <li key={item} className="insight-callout-item">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              );
            })()}

            {/* ── 9. Selected Event Geography ── */}
            {(() => {
              if (!activeTrendEventName) return null;

              const selectedGeoRows = intervals.map(iv => {
                const geographic = iv.stats.geographicDistributionByEvent.find(event => event.eventName === activeTrendEventName)?.geographic ?? null;
                const usStates = geographic
                  ? Object.keys(geographic.byState).filter(state => US_STATE_CODES.has(state.toUpperCase())).length
                  : 0;
                const nonUsStates = geographic
                  ? Object.keys(geographic.byState).filter(state => !US_STATE_CODES.has(state.toUpperCase())).length
                  : 0;
                const countries = geographic ? Object.keys(geographic.byCountry).length : 0;
                return {
                  label: iv.label,
                  geographic,
                  usStates,
                  nonUsStates,
                  countries,
                };
              });
              const firstSelectedGeo = selectedGeoRows.find(row => row.geographic != null);
              const latestSelectedGeo = [...selectedGeoRows].reverse().find(row => row.geographic != null);
              const hasSelectedGeo = selectedGeoRows.some(row => row.geographic != null);
              const selectedGeoUnknownPresent = selectedGeoRows.some(row => (row.geographic?.unknownLocationParticipants ?? 0) > 0);
              const selectedGeoTrendSub = (latest: number, first: number, firstLabel?: string): string => {
                const delta = latest - first;
                if (!firstLabel) return 'comparison period';
                if (delta === 0) return `stable since ${firstLabel}`;
                return `${delta > 0 ? '+' : ''}${delta.toLocaleString()} since ${firstLabel}`;
              };
              const selectedGeoInsights = (() => {
                if (!firstSelectedGeo?.geographic || !latestSelectedGeo?.geographic) return [];
                const usDelta = latestSelectedGeo.geographic.usParticipants - firstSelectedGeo.geographic.usParticipants;
                const intlDelta = latestSelectedGeo.geographic.internationalParticipants - firstSelectedGeo.geographic.internationalParticipants;
                const stateDelta = latestSelectedGeo.usStates - firstSelectedGeo.usStates;
                const insights: string[] = [];
                insights.push(Math.abs(usDelta) < 5
                  ? `${activeTrendEventName} US participation was relatively stable from ${firstSelectedGeo.label} to ${latestSelectedGeo.label}.`
                  : `${activeTrendEventName} US participation ${usDelta > 0 ? 'increased' : 'decreased'} by ${Math.abs(usDelta).toLocaleString()} from ${firstSelectedGeo.label} to ${latestSelectedGeo.label}.`);
                if (Math.abs(intlDelta) >= 2) {
                  insights.push(`International participation changed from ${firstSelectedGeo.geographic.internationalParticipants.toLocaleString()} to ${latestSelectedGeo.geographic.internationalParticipants.toLocaleString()}.`);
                }
                if (stateDelta !== 0) {
                  insights.push(`US state reach ${stateDelta > 0 ? 'expanded' : 'narrowed'} from ${firstSelectedGeo.usStates} to ${latestSelectedGeo.usStates} states.`);
                }
                return insights.slice(0, 3);
              })();
              return (
                <section id="rr-selected-geography" className="chart-section rr-geography-compact rr-selected-geography-compact" style={{ order: 12 }}>
                  <SectionHeader title="Selected Event Geography" contextStrip={selectedTrendContextStrip} />
                  {!hasSelectedGeo ? (
                    <p className="rd-empty-group">Selected-event geography trends need event-level geography data for each compared year.</p>
                  ) : (
                    <>
                      <p className="chart-note rr-selected-geography-note">Geography reflects participants in the selected event across compared years.</p>
                      <div className="rd-tab-strip" role="tablist" aria-label="Selected event geography views">
                        {(['summary', 'table'] as const).map(id => (
                          <button key={id} type="button" role="tab"
                            aria-selected={selectedGeoTab === id}
                            className={`rd-tab${selectedGeoTab === id ? ' rd-tab--active' : ''}`}
                            onClick={() => setSelectedGeoTab(id)}
                          >
                            {id === 'summary' ? 'Summary' : 'Table'}
                          </button>
                        ))}
                      </div>
                      {selectedGeoTab === 'summary' && latestSelectedGeo?.geographic && firstSelectedGeo?.geographic && (
                        <div role="tabpanel" className="rd-tab-panel">
                          <div className="stat-cards-row">
                            <StatCard label="US Participants" value={latestSelectedGeo.geographic.usParticipants.toLocaleString()} sub={selectedGeoTrendSub(latestSelectedGeo.geographic.usParticipants, firstSelectedGeo.geographic.usParticipants, firstSelectedGeo.label)} />
                            <StatCard label="US States" value={latestSelectedGeo.usStates.toLocaleString()} sub={selectedGeoTrendSub(latestSelectedGeo.usStates, firstSelectedGeo.usStates, firstSelectedGeo.label)} />
                            <StatCard label="International Participants" value={latestSelectedGeo.geographic.internationalParticipants.toLocaleString()} sub={selectedGeoTrendSub(latestSelectedGeo.geographic.internationalParticipants, firstSelectedGeo.geographic.internationalParticipants, firstSelectedGeo.label)} />
                            <StatCard label="Total Countries" value={latestSelectedGeo.countries.toLocaleString()} sub={selectedGeoTrendSub(latestSelectedGeo.countries, firstSelectedGeo.countries, firstSelectedGeo.label)} />
                            <StatCard label="Non-US States / Provinces" value={latestSelectedGeo.nonUsStates.toLocaleString()} sub={selectedGeoTrendSub(latestSelectedGeo.nonUsStates, firstSelectedGeo.nonUsStates, firstSelectedGeo.label)} />
                          </div>
                          {selectedGeoInsights.length > 0 && (
                            <div className="insight-callout rr-selected-geography-insight">
                              <ul className="insight-callout-list">
                                {selectedGeoInsights.map(item => (
                                  <li key={item} className="insight-callout-item">{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                      {selectedGeoTab === 'table' && (
                        <div role="tabpanel" className="rd-tab-panel">
                          <div className="cmp-table-scroll">
                            <table className="stats-table cmp-table">
                              <caption className="sr-only">Selected event geography summary by year for {activeTrendEventName}</caption>
                              <thead>
                                <tr>
                                  <th scope="col">Year</th>
                                  <th scope="col">US Participants</th>
                                  <th scope="col">US States</th>
                                  <th scope="col">International Participants</th>
                                  <th scope="col">Total Countries</th>
                                  <th scope="col">Non-US States / Provinces</th>
                                  {selectedGeoUnknownPresent && <th scope="col">Unknown Location</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {selectedGeoRows.map(row => (
                                  <tr key={row.label}>
                                    <td>{row.label}</td>
                                    <td>{row.geographic?.usParticipants.toLocaleString() ?? '—'}</td>
                                    <td>{row.geographic ? row.usStates.toLocaleString() : '—'}</td>
                                    <td>{row.geographic?.internationalParticipants.toLocaleString() ?? '—'}</td>
                                    <td>{row.geographic ? row.countries.toLocaleString() : '—'}</td>
                                    <td>{row.geographic ? row.nonUsStates.toLocaleString() : '—'}</td>
                                    {selectedGeoUnknownPresent && <td>{row.geographic ? (row.geographic.unknownLocationParticipants ?? 0).toLocaleString() : '—'}</td>}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </section>
              );
            })()}

            {/* ── 8. Finisher Age Distribution ── */}
            {(() => {
              if (!activeTrendEventName) return null;
              const distColors = yearColors;
              type AgeDistGender = 'overall' | 'male' | 'female' | 'nonBinary';
              const selectedAgeRows = intervals.map(iv => {
                const eventAge = iv.stats.ageDistributionByEvent.find(e => e.eventName === activeTrendEventName)?.finisherAge ?? null;
                const ageGroupRows = iv.stats.ageGroupPerformanceByEvent.find(e => e.eventName === activeTrendEventName)?.rows ?? [];
                return {
                  label: iv.label,
                  eventAge,
                  ageGroupRows,
                };
              });
              const latestSelectedAgeRow = [...selectedAgeRows].reverse().find(row =>
                row.ageGroupRows.length > 0 || (row.eventAge?.buckets?.length ?? 0) > 0
              );
              const bucketLabels = (() => {
                const labels: string[] = [];
                const addLabel = (label: string) => {
                  if (!labels.includes(label)) labels.push(label);
                };
                latestSelectedAgeRow?.ageGroupRows.forEach(row => addLabel(row.ageGroup));
                latestSelectedAgeRow?.eventAge?.buckets.forEach(bucket => addLabel(bucket.label));
                selectedAgeRows.forEach(row => {
                  row.ageGroupRows.forEach(item => addLabel(item.ageGroup));
                  row.eventAge?.buckets.forEach(bucket => addLabel(bucket.label));
                });
                return labels;
              })();
              const getBucketCount = (row: typeof selectedAgeRows[number], bucketLabel: string, gender: AgeDistGender) => {
                const ageGroupRow = row.ageGroupRows.find(item => item.ageGroup === bucketLabel);
                if (ageGroupRow) {
                  if (gender === 'male') return ageGroupRow.maleFinishers;
                  if (gender === 'female') return ageGroupRow.femaleFinishers;
                  if (gender === 'nonBinary') return ageGroupRow.nonBinaryFinishers;
                  return ageGroupRow.finishers;
                }
                if (gender !== 'overall') return 0;
                return row.eventAge?.buckets.find(bucket => bucket.label === bucketLabel)?.count ?? 0;
              };
              const genderOptions: Array<{ id: AgeDistGender; label: string; hasData: boolean }> = [
                { id: 'overall', label: 'Overall', hasData: bucketLabels.some(bucket => selectedAgeRows.some(row => getBucketCount(row, bucket, 'overall') > 0)) },
                { id: 'male', label: 'Male', hasData: bucketLabels.some(bucket => selectedAgeRows.some(row => getBucketCount(row, bucket, 'male') > 0)) },
                { id: 'female', label: 'Female', hasData: bucketLabels.some(bucket => selectedAgeRows.some(row => getBucketCount(row, bucket, 'female') > 0)) },
                { id: 'nonBinary', label: 'Non-Binary', hasData: bucketLabels.some(bucket => selectedAgeRows.some(row => getBucketCount(row, bucket, 'nonBinary') > 0)) },
              ];
              const visibleGenderOptions = genderOptions.filter(option => option.hasData || option.id === 'overall');
              const activeAgeDistGender: AgeDistGender = visibleGenderOptions.some(option => option.id === ageDistGender)
                ? ageDistGender
                : 'overall';
              const activeGenderLabel = genderOptions.find(option => option.id === activeAgeDistGender)?.label ?? 'Overall';
              const distChartData = bucketLabels.map(bucketLabel => {
                const row: Record<string, number | string> = { label: bucketLabel };
                selectedAgeRows.forEach(ageRow => {
                  row[ageRow.label] = getBucketCount(ageRow, bucketLabel, activeAgeDistGender);
                });
                return row;
              });
              const distInsights = (() => {
                const firstRow = selectedAgeRows.find(row => bucketLabels.some(bucket => getBucketCount(row, bucket, activeAgeDistGender) > 0));
                const latestRow = [...selectedAgeRows].reverse().find(row => bucketLabels.some(bucket => getBucketCount(row, bucket, activeAgeDistGender) > 0));
                if (!firstRow || !latestRow) return [];
                const bucketChanges = bucketLabels.map(label => {
                  const first = getBucketCount(firstRow, label, activeAgeDistGender);
                  const latest = getBucketCount(latestRow, label, activeAgeDistGender);
                  return { label, first, latest, delta: latest - first };
                });
                const largestIncrease = bucketChanges.reduce<typeof bucketChanges[number] | null>((best, bucket) => {
                  if (bucket.delta <= 0) return best;
                  return !best || bucket.delta > best.delta ? bucket : best;
                }, null);
                const largestLatest = bucketChanges.reduce<typeof bucketChanges[number] | null>((best, bucket) => {
                  if (bucket.latest <= 0) return best;
                  return !best || bucket.latest > best.latest ? bucket : best;
                }, null);
                const insights: string[] = [];
                const prefix = activeAgeDistGender === 'overall' ? 'Finishers' : `${activeGenderLabel} finishers`;
                if (largestIncrease && firstRow.label !== latestRow.label) {
                  insights.push(`${activeTrendEventName} ${prefix.toLowerCase()} ages ${largestIncrease.label} increased from ${largestIncrease.first.toLocaleString()} in ${firstRow.label} to ${largestIncrease.latest.toLocaleString()} in ${latestRow.label}.`);
                }
                if (largestLatest) {
                  insights.push(`${largestLatest.label} was the largest ${activeAgeDistGender === 'overall' ? 'finisher' : activeGenderLabel.toLowerCase()} age group for ${activeTrendEventName} in ${latestRow.label}.`);
                }
                return insights.slice(0, 2);
              })();
              const hasDistributionData = distChartData.some(row =>
                selectedAgeRows.some(ageRow => Number(row[ageRow.label] ?? 0) > 0)
              );
              return (
                <section id="rr-age-dist" className="chart-section" style={{ order: 8 }}>
                  <SectionHeader title="Finisher Age Distribution" contextStrip={selectedTrendContextStrip} />
                  <p className="chart-note">Compare how finisher age bands grew or shrank across years for the selected event.</p>
                  <div className="ce-control-row rr-age-distribution-controls">
                    <div className="rd-tab-strip" role="tablist" aria-label="Finisher age distribution trends views">
                      {(['charts', 'table'] as const).map(id => (
                        <button key={id} type="button" role="tab"
                          aria-selected={ageDistTab === id}
                          className={`rd-tab${ageDistTab === id ? ' rd-tab--active' : ''}`}
                          onClick={() => setAgeDistTab(id)}
                        >
                          {id === 'charts' ? 'Charts' : 'Table'}
                        </button>
                      ))}
                    </div>
                    <div className="metric-pills" role="group" aria-label="Filter age distribution by gender">
                      {visibleGenderOptions.map(option => (
                        <button
                          key={option.id}
                          type="button"
                          className={`metric-pill${activeAgeDistGender === option.id ? ' metric-pill--active' : ''}`}
                          onClick={() => setAgeDistGender(option.id)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {ageDistTab === 'charts' && (
                    <div role="tabpanel" className="rd-tab-panel">
                      {hasDistributionData ? (
                        <div className="chart-wrap chart-wrap--full" aria-hidden="true">
                          <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={distChartData} margin={{ top: 22, right: 8, bottom: 36, left: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" interval={0} />
                              <YAxis tick={{ fontSize: 11 }} allowDecimals={false}
                                label={{ value: 'Finishers', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: '0.72rem', fill: '#888' } }} />
                              <Tooltip contentStyle={{ fontSize: '0.8rem' }} />
                              <Legend verticalAlign="top" iconType="square" iconSize={10} wrapperStyle={{ fontSize: '0.75rem', paddingBottom: 6 }} />
                              {selectedAgeRows.map((ageRow, i) => (
                                <Bar key={ageRow.label} dataKey={ageRow.label} fill={distColors[i]} maxBarSize={24}>
                                  <LabelList dataKey={ageRow.label} position="top"
                                    formatter={fmtBarCount}
                                    style={{ fontSize: '0.58rem', fill: '#888' }} />
                                </Bar>
                              ))}
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <p className="rd-empty-group">No {activeGenderLabel.toLowerCase()} finisher age data is available for {activeTrendEventName} across the compared years.</p>
                      )}
                    </div>
                  )}
                  {ageDistTab === 'table' && (
                    <div role="tabpanel" className="rd-tab-panel">
                      <div className="cmp-table-scroll">
                        <table className="stats-table cmp-table">
                          <caption className="sr-only">Age distribution by year</caption>
                          <thead>
                            <tr>
                              <th scope="col">Age Group</th>
                              {selectedAgeRows.map(row => <th scope="col" key={row.label}>{row.label}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {bucketLabels.map(bucketLabel => (
                              <tr key={bucketLabel}>
                                <td>{bucketLabel}</td>
                                {selectedAgeRows.map(row => {
                                  const count = getBucketCount(row, bucketLabel, activeAgeDistGender);
                                  return <td key={row.label}>{count.toLocaleString()}</td>;
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {distInsights.length > 0 && (
                    <div className="insight-callout">
                      <ul className="insight-callout-list">
                        {distInsights.map(item => (
                          <li key={item} className="insight-callout-item">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              );
            })()}

            {/* ── 3. Overall Geography ── */}
            {(() => {
              const latestGeo = intervals[intervals.length - 1].stats.geographic;
              const latestLabel = intervals[intervals.length - 1].label;
              const firstGeo = intervals[0].stats.geographic;
              const firstLabel = intervals[0].label;
              const latestUsStates = usStatesTrend[usStatesTrend.length - 1]?.value ?? 0;
              const firstUsStates = usStatesTrend[0]?.value ?? 0;
              const latestNonUsStates = nonUsStateProvinceTrend[nonUsStateProvinceTrend.length - 1]?.value ?? 0;
              const firstNonUsStates = nonUsStateProvinceTrend[0]?.value ?? 0;
              const latestCountries = Object.keys(latestGeo.byCountry).length;
              const firstCountries = Object.keys(firstGeo.byCountry).length;
              const hasUnknownLocation = intervals.some(iv => (iv.stats.geographic.unknownLocationParticipants ?? 0) > 0);
              const trendSub = (latest: number, first: number): string => {
                const delta = latest - first;
                if (delta === 0) return `stable since ${firstLabel}`;
                return `${delta > 0 ? '+' : ''}${delta.toLocaleString()} since ${firstLabel}`;
              };
              const geographyInsights = (() => {
                const usDelta = latestGeo.usParticipants - firstGeo.usParticipants;
                const intlDelta = latestGeo.internationalParticipants - firstGeo.internationalParticipants;
                const usStateDelta = latestUsStates - firstUsStates;
                const countryDelta = latestCountries - firstCountries;
                const insights: string[] = [];
                insights.push(Math.abs(usDelta) < 5
                  ? `US participation was relatively stable from ${firstLabel} to ${latestLabel}.`
                  : `US participation ${usDelta > 0 ? 'increased' : 'decreased'} by ${Math.abs(usDelta).toLocaleString()} from ${firstLabel} to ${latestLabel}.`);
                if (Math.abs(intlDelta) >= 2) {
                  insights.push(`International participation changed from ${firstGeo.internationalParticipants.toLocaleString()} to ${latestGeo.internationalParticipants.toLocaleString()}.`);
                }
                if (countryDelta === 0 && usStateDelta === 0) {
                  insights.push(`Geographic reach stayed flat at ${latestUsStates.toLocaleString()} US states and ${latestCountries.toLocaleString()} total countries.`);
                } else if (usStateDelta !== 0) {
                  insights.push(`US state reach ${usStateDelta > 0 ? 'expanded' : 'narrowed'} from ${firstUsStates} to ${latestUsStates} states.`);
                } else if (countryDelta !== 0) {
                  insights.push(`Total country reach changed from ${firstCountries} to ${latestCountries}.`);
                }
                return insights.slice(0, 3);
              })();

              const compactGeographySummary = geographyInsights
                .map(item => item.replace(/\.$/, ''))
                .join(' · ');

              return (
                <section id="rr-overall-geography" className="chart-section rr-geography-compact" style={{ order: 4 }}>
                  <SectionHeader title="Overall Geography" />
                  <div className="rd-tab-strip" role="tablist" aria-label="Overall geography views">
                    {(['summary', 'table'] as const).map(id => (
                      <button key={id} type="button" role="tab"
                        aria-selected={geoTab === id}
                        className={`rd-tab${geoTab === id ? ' rd-tab--active' : ''}`}
                        onClick={() => setGeoTab(id)}
                      >
                        {id === 'summary' ? 'Summary' : 'Table'}
                      </button>
                    ))}
                  </div>
                  {geoTab === 'summary' && (
                    <div role="tabpanel" className="rd-tab-panel">
                      <div className="stat-cards-row rr-overall-geography-cards">
                        <StatCard label="US Participants" value={latestGeo.usParticipants.toLocaleString()} sub={trendSub(latestGeo.usParticipants, firstGeo.usParticipants)} />
                        <StatCard label="US States" value={latestUsStates.toLocaleString()} sub={trendSub(latestUsStates, firstUsStates)} />
                        <StatCard label="International Participants" value={latestGeo.internationalParticipants.toLocaleString()} sub={trendSub(latestGeo.internationalParticipants, firstGeo.internationalParticipants)} />
                        <StatCard label="Total Countries" value={latestCountries.toLocaleString()} sub={trendSub(latestCountries, firstCountries)} />
                        <StatCard label="Non-US States / Provinces" value={latestNonUsStates.toLocaleString()} sub={trendSub(latestNonUsStates, firstNonUsStates)} />
                      </div>
                      {compactGeographySummary && (
                        <p className="rr-geography-summary-line">{compactGeographySummary}.</p>
                      )}
                    </div>
                  )}
                  {geoTab === 'table' && (
                    <div role="tabpanel" className="rd-tab-panel">
                      <div className="cmp-table-scroll">
                        <table className="stats-table cmp-table">
                          <caption className="sr-only">Geography summary by year</caption>
                          <thead>
                            <tr>
                              <th scope="col">Year</th>
                              <th scope="col">US Participants</th>
                              <th scope="col">US States</th>
                              <th scope="col">International Participants</th>
                              <th scope="col">Total Countries</th>
                              <th scope="col">Non-US States / Provinces</th>
                              {hasUnknownLocation && <th scope="col">Unknown Location</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {intervals.map(iv => {
                              const usStates = Object.keys(iv.stats.geographic.byState).filter(state => US_STATE_CODES.has(state.toUpperCase())).length;
                              const nonUsStates = Object.keys(iv.stats.geographic.byState).filter(state => !US_STATE_CODES.has(state.toUpperCase())).length;
                              return (
                                <tr key={iv.label}>
                                  <td>{iv.label}</td>
                                  <td>{iv.stats.geographic.usParticipants.toLocaleString()}</td>
                                  <td>{usStates.toLocaleString()}</td>
                                  <td>{iv.stats.geographic.internationalParticipants.toLocaleString()}</td>
                                  <td>{Object.keys(iv.stats.geographic.byCountry).length.toLocaleString()}</td>
                                  <td>{nonUsStates.toLocaleString()}</td>
                                  {hasUnknownLocation && <td>{(iv.stats.geographic.unknownLocationParticipants ?? 0).toLocaleString()}</td>}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </section>
              );
            })()}

          </div>
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
