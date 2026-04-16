import { useEffect, useState, useRef, type DragEvent, type ChangeEvent, type FormEvent } from 'react';
import { apiUrl } from '../api.ts';
import type { UploadResponse } from '../types.ts';
import './UploadPage.css';

interface Props {
  onUploadComplete: (data: UploadResponse) => void;
}

// Common timezones for race directors.
const TIMEZONES = [
  { value: 'America/New_York',     label: 'Eastern (ET)' },
  { value: 'UTC',                  label: 'UTC' },
  { value: 'America/Chicago',      label: 'Central (CT)' },
  { value: 'America/Denver',       label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles',  label: 'Pacific (PT)' },
  { value: 'America/Anchorage',    label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu',     label: 'Hawaii (HST)' },
  { value: 'Europe/London',        label: 'London (GMT/BST)' },
  { value: 'Europe/Paris',         label: 'Central Europe (CET)' },
  { value: 'Australia/Sydney',     label: 'Sydney (AEST)' },
];

export default function UploadPage({ onUploadComplete }: Props) {
  const pageHeadingRef = useRef<HTMLHeadingElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [raceName, setRaceName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    pageHeadingRef.current?.focus();
  }, []);

  function handleFileSelect(f: File) {
    setError(null);
    setFile(f);
  }

  function onFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }

  async function handleSubmit(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    if (raceName.trim()) formData.append('raceName', raceName.trim());
    formData.append('timezone', timezone);
    if (venueAddress.trim()) {
      formData.append('venueAddress', venueAddress.trim());
    }

    try {
      const res = await fetch(apiUrl('/api/upload'), { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Upload failed. Please try again.');
        return;
      }
      onUploadComplete(data as UploadResponse);
    } catch {
      setError('Could not reach the server. Make sure it is running.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="upload-page">
      <div className="upload-intro">
        <h1 ref={pageHeadingRef} tabIndex={-1}>Race Participant Analytics</h1>
        <p>
          Upload a participant export from your race registration platform. Names, email
          and physical addresses, and phone numbers are stripped immediately on upload —
          only aggregate statistics are retained and displayed.
        </p>
        <p className="upload-supported">
          Supported platforms: <strong>UltraSignup</strong> &nbsp;·&nbsp; More coming soon
        </p>
        <p className="upload-supported">
          Accepted formats: <strong>CSV</strong> &nbsp;·&nbsp; <strong>Excel (.xlsx, .xls)</strong>
        </p>
      </div>

      <form className="card upload-card" onSubmit={handleSubmit} noValidate>
        {/* Drop zone */}
        <div
          className={`drop-zone${dragging ? ' drop-zone--active' : ''}${file ? ' drop-zone--has-file' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          aria-label="Upload area. Drag and drop a file here, or use the browse button."
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={onFileInputChange}
            style={{ display: 'none' }}
          />
          {file ? (
            <div className="drop-zone-file">
              <span className="drop-zone-icon">✓</span>
              <span className="drop-zone-filename">{file.name}</span>
              <span className="drop-zone-size">({(file.size / 1024).toFixed(0)} KB)</span>
              <button
                type="button"
                className="drop-zone-browse"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              >
                Replace
              </button>
              <button
                type="button"
                className="drop-zone-clear"
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="drop-zone-prompt">
              <span className="drop-zone-icon">↑</span>
              <span>Drop your CSV here, or browse from your computer</span>
              <button
                type="button"
                className="drop-zone-browse"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose File
              </button>
              <span className="drop-zone-limit">CSV or Excel · Up to 5,000 participants · 5 MB</span>
            </div>
          )}
        </div>

        {/* Race name (optional) */}
        <div className="upload-venue">
          <label htmlFor="race-name">
            Race name <span className="optional">(optional)</span>
          </label>
          <input
            id="race-name"
            type="text"
            placeholder="e.g. Ghost Train Trail Races 2026"
            value={raceName}
            onChange={(e) => setRaceName(e.target.value)}
          />
        </div>

        {/* Venue address (optional) */}
        <div className="upload-venue">
          <label htmlFor="venue-address">
            Venue address <span className="optional">(optional)</span>
          </label>
          <input
            id="venue-address"
            type="text"
            placeholder="e.g. 123 Trail Head Rd, Franconia, NH 03580"
            value={venueAddress}
            onChange={(e) => setVenueAddress(e.target.value)}
          />
          <p className="upload-venue-hint">
            Providing an address enables distance-traveled statistics. The address is
            geocoded once and never stored alongside participant data.
          </p>
        </div>

        {/* Timestamp timezone */}
        <div className="upload-venue">
          <label htmlFor="timezone">
            Registration timestamp timezone
          </label>
          <select
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="upload-select"
          >
            {TIMEZONES.map(tz => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
          <p className="upload-venue-hint">
            Used for hour-of-day and day-of-week registration charts. UltraSignup
            timestamps are in Eastern time — Eastern (ET) is the correct default for
            UltraSignup exports.
          </p>
        </div>

        {error && <p className="upload-error" role="alert">{error}</p>}

        <button
          type="submit"
          className="btn btn-primary upload-submit"
          disabled={!file || uploading}
        >
          {uploading ? 'Analyzing…' : 'Analyze Race Data'}
        </button>
      </form>
    </div>
  );
}
