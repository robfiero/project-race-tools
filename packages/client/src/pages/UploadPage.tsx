import {
  useEffect, useState, useRef,
  type DragEvent, type ChangeEvent, type FormEvent,
} from 'react';
import { apiUrl } from '../api.ts';
import type { UploadResponse } from '../types.ts';
import './UploadPage.css';

export type UploadResult =
  | { mode: 'single'; session: UploadResponse; label: string }
  | { mode: 'comparison'; sessions: Array<{ response: UploadResponse; label: string }> };

interface Props {
  onUploadComplete: (result: UploadResult) => void;
}

const MAX_ROWS = 5;

const TIMEZONES = [
  { value: 'America/New_York',    label: 'Eastern (ET)' },
  { value: 'UTC',                 label: 'UTC' },
  { value: 'America/Chicago',     label: 'Central (CT)' },
  { value: 'America/Denver',      label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Anchorage',   label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu',    label: 'Hawaii (HST)' },
  { value: 'Europe/London',       label: 'London (GMT/BST)' },
  { value: 'Europe/Paris',        label: 'Central Europe (CET)' },
  { value: 'Australia/Sydney',    label: 'Sydney (AEST)' },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 16 }, (_, i) => String(CURRENT_YEAR + 1 - i));

function detectYear(filename: string): string {
  // Match first 4-digit year like "2017" — no word-boundary required since
  // filenames like "GhostTrain2017.csv" have no separator before the digits.
  const m = filename.match(/(?<!\d)(20\d{2})(?!\d)/);
  return m ? m[1] : '';
}

interface UploadRow {
  id: string;
  file: File | null;
  year: string;
}

function makeRow(): UploadRow {
  return { id: crypto.randomUUID(), file: null, year: '' };
}

// ─── Info icon ────────────────────────────────────────────────────────────────

function InfoIcon() {
  return <span className="info-icon" aria-hidden="true">i</span>;
}

// ─── File row ─────────────────────────────────────────────────────────────────

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
}

function FileRow({
  row, index, required, dragging,
  fileInputRef, onFileChange,
  onDragEnter, onDragLeave, onDrop, onClear, onYearChange,
}: FileRowProps) {
  const inputId = `file-input-${row.id}`;
  const yearId = `year-${row.id}`;

  return (
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
          accept=".csv,.xlsx"
          onChange={onFileChange}
          style={{ display: 'none' }}
          aria-label={`${required ? 'Required: ' : ''}File for row ${index + 1}`}
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
        aria-label={`Year for row ${index + 1} file`}
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
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function UploadPage({ onUploadComplete }: Props) {
  const pageHeadingRef = useRef<HTMLHeadingElement>(null);
  const [rows, setRows] = useState<UploadRow[]>(() => [makeRow()]);
  const [raceName, setRaceName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  useEffect(() => { pageHeadingRef.current?.focus(); }, []);

  const filledRows = rows.filter(r => r.file !== null);
  const firstRowFilled = rows[0].file !== null;
  const canSubmit = firstRowFilled && !uploading;

  function handleFileSelect(rowId: string, file: File) {
    setError(null);
    const detectedYear = detectYear(file.name);
    setRows(prev => prev.map(r =>
      r.id === rowId
        ? { ...r, file, year: r.year || detectedYear }
        : r
    ));
  }

  function onFileChange(rowId: string, e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.[0]) handleFileSelect(rowId, e.target.files[0]);
  }

  function onDrop(rowId: string, e: DragEvent<HTMLLabelElement>) {
    setDraggingRowId(null);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(rowId, f);
  }

  function clearRow(rowId: string) {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, file: null, year: '' } : r));
    // Reset the file input so the same file can be re-selected later
    const input = fileInputRefs.current.get(rowId);
    if (input) input.value = '';
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!firstRowFilled) return;
    setUploading(true);
    setError(null);

    const results: Array<{ response: UploadResponse; label: string }> = [];
    const toUpload = filledRows;

    for (let i = 0; i < toUpload.length; i++) {
      const row = toUpload[i];
      const formData = new FormData();
      formData.append('file', row.file!);
      if (raceName.trim()) formData.append('raceName', raceName.trim());
      formData.append('timezone', timezone);
      if (venueAddress.trim()) formData.append('venueAddress', venueAddress.trim());

      try {
        const res = await fetch(apiUrl('/api/upload'), { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) {
          const rowLabel = toUpload.length > 1
            ? ` (${row.year || row.file!.name.replace(/\.(csv|xlsx)$/i, '')})`
            : '';
          setError((data.error ?? 'Upload failed.') + rowLabel);
          setUploading(false);
          return;
        }
        // Use year as label; fall back to filename without extension
        const label = row.year || row.file!.name.replace(/\.(csv|xlsx)$/i, '');
        results.push({ response: data as UploadResponse, label });
      } catch {
        setError('Could not reach the server. Make sure it is running.');
        setUploading(false);
        return;
      }
    }

    if (results.length === 1) {
      onUploadComplete({ mode: 'single', session: results[0].response, label: results[0].label });
    } else {
      onUploadComplete({ mode: 'comparison', sessions: results });
    }
  }

  const submitLabel = uploading
    ? (filledRows.length > 1 ? `Uploading ${filledRows.length} files…` : 'Analyzing…')
    : (filledRows.length >= 2 ? `Compare ${filledRows.length} years` : 'Analyze race data');

  return (
    <div className="upload-page">
      <div className="upload-intro">
        <h1 ref={pageHeadingRef} tabIndex={-1}>Race Registration Analytics</h1>
        <p>
          Upload participant exports from your race registration platform. Personal
          information in uploaded files is never read or analyzed — only aggregate
          statistics are computed and displayed.
        </p>
        <p className="upload-supported">
          Supported platforms: <strong>UltraSignup</strong> &nbsp;·&nbsp; More coming soon
          &nbsp;·&nbsp; Formats: <strong>CSV</strong>, <strong>Excel (.xlsx)</strong>
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* ── Shared fields ── */}
        <div className="upload-shared card">
          <div className="upload-field">
            <label htmlFor="race-name">
              Race name <span className="optional">(optional)</span>
            </label>
            <input
              id="race-name"
              type="text"
              placeholder="e.g. Ridgeline Trail Races"
              value={raceName}
              onChange={e => setRaceName(e.target.value)}
            />
          </div>

          <div className="upload-field">
            <label htmlFor="venue-address">
              Venue address <span className="optional">(optional)</span>
            </label>
            <input
              id="venue-address"
              type="text"
              placeholder="e.g. 1 Mason Road, Brookline, NH 03033"
              value={venueAddress}
              onChange={e => setVenueAddress(e.target.value)}
            />
            <p className="upload-hint">
              <InfoIcon />
              Enables distance-traveled statistics. Geocoded once at upload and never
              stored with participant data.
            </p>
          </div>

          <div className="upload-field">
            <label htmlFor="timezone">Registration timezone</label>
            <select
              id="timezone"
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className="upload-select"
            >
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
            <p className="upload-hint">
              <InfoIcon />
              Used to group registrations by hour and day of week.
            </p>
          </div>
        </div>

        {/* ── File rows ── */}
        <div className="upload-files card">
          <div className="upload-files-col-header" aria-hidden="true">
            <span />
            <span>File <span className="upload-files-hint-inline">· up to 5,000 participants · 5 MB each</span></span>
            <span>Year</span>
            <span />
          </div>

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
              onFileChange={e => onFileChange(row.id, e)}
              onDragEnter={() => setDraggingRowId(row.id)}
              onDragLeave={() => setDraggingRowId(null)}
              onDrop={e => onDrop(row.id, e)}
              onClear={() => clearRow(row.id)}
              onYearChange={year => setRows(prev =>
                prev.map(r => r.id === row.id ? { ...r, year } : r)
              )}
            />
          ))}

          <div className="upload-files-add-row">
            {rows.length < MAX_ROWS ? (
              <button
                type="button"
                className="btn upload-add-year-btn"
                onClick={() => setRows(prev => [...prev, makeRow()])}
                disabled={!firstRowFilled}
                title={!firstRowFilled ? 'Add at least one participant file to analyze race data.' : undefined}
              >
                + Add another year
              </button>
            ) : null}
          </div>

          <p className="upload-files-footer-hint">
            Upload one file for a single race analysis, or multiple files (same race,
            different years) for year-over-year comparison. Year is auto-detected from
            the filename when available.
          </p>
        </div>

        {error && <p className="upload-error" role="alert">{error}</p>}

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
