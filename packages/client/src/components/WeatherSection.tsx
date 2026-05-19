import type { WeatherData, WeatherSnapshot } from '../types.ts';
import SectionHeader from './SectionHeader.tsx';
import './WeatherSection.css';

// ─── WMO code helpers ─────────────────────────────────────────────────────────

function weatherIcon(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 57) return '🌦️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '🌨️';
  return '⛈️';
}

// ─── Date/time helpers ────────────────────────────────────────────────────────

function parseDate(iso: string): string {
  const [datePart] = iso.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function parseTimeOfDay(iso: string): string {
  const timePart = iso.split('T')[1] ?? '00:00';
  const [hour, minute] = timePart.split(':').map(Number);
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `${h12}:${String(minute).padStart(2, '0')} ${ampm}`;
}

// ─── Grid row definitions ─────────────────────────────────────────────────────

interface WxRow {
  label: string;
  icon: string;
  render: (s: WeatherSnapshot) => string;
  className?: string;
}

const WX_ROWS: WxRow[] = [
  { label: 'Race Time',   icon: '🏁', render: s => s.label },
  { label: 'Date',        icon: '📅', render: s => parseDate(s.timeIso) },
  { label: 'Time of Day', icon: '🕒', render: s => parseTimeOfDay(s.timeIso) },
  { label: 'Condition',   icon: '🌤️', render: s => `${weatherIcon(s.weatherCode)} ${s.weatherDesc}`, className: 'wx-condition-cell' },
  { label: 'Temp',        icon: '🌡️', render: s => `${s.tempF}°F` },
  { label: 'Feels Like',  icon: '🌡️', render: s => `${s.feelsLikeF}°F` },
  { label: 'Cloud Cover', icon: '☁️', render: s => `${s.cloudCoverPct}%` },
  { label: 'Wind',        icon: '💨', render: s => `${s.windMph} mph ${s.windDir}` },
  { label: 'Gusts',       icon: '💨', render: s => `${s.windGustMph} mph` },
];

// ─── Compact summary ──────────────────────────────────────────────────────────

function localTimeMs(iso: string): number {
  const [datePart, timePart = '00:00'] = iso.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute).getTime();
}

function nearestSnapshot(snaps: WeatherSnapshot[], targetMs: number): WeatherSnapshot {
  return snaps.reduce((closest, snap) => {
    const closestDiff = Math.abs(localTimeMs(closest.timeIso) - targetMs);
    const snapDiff = Math.abs(localTimeMs(snap.timeIso) - targetMs);
    return snapDiff < closestDiff ? snap : closest;
  }, snaps[0]);
}

function summarySnapshots(weather: WeatherData): Array<{ label: string; snap: WeatherSnapshot }> {
  const { snapshots } = weather;
  const startMs = localTimeMs(weather.raceStartIso);
  const endMs = localTimeMs(weather.raceEndIso);
  const durationHours = Math.max(0, (endMs - startMs) / 36e5);

  if (durationHours < 2) {
    return [{ label: 'Race Start', snap: nearestSnapshot(snapshots, startMs) }];
  }

  if (durationHours <= 12) {
    return [
      { label: 'Race Start', snap: nearestSnapshot(snapshots, startMs) },
      { label: 'Race End', snap: nearestSnapshot(snapshots, endMs) },
    ];
  }

  return [
    { label: 'Race Start', snap: nearestSnapshot(snapshots, startMs) },
    { label: 'Mid-Race', snap: nearestSnapshot(snapshots, startMs + (endMs - startMs) / 2) },
    { label: 'Race End', snap: nearestSnapshot(snapshots, endMs) },
  ];
}

function WeatherSummary({ weather }: { weather: WeatherData }) {
  const items = summarySnapshots(weather);
  const isSingleSnapshot = items.length === 1;

  return (
    <div className={`wx-summary${isSingleSnapshot ? ' wx-summary--single' : ''}`} aria-label="Weather summary">
      {items.map(({ label, snap }) => (
        <div className="wx-summary-card" key={label}>
          <span className="wx-summary-label">{label}</span>
          <span className="wx-summary-condition">
            <span className="wx-summary-icon" aria-hidden="true">{weatherIcon(snap.weatherCode)}</span>
            {snap.weatherDesc}
          </span>
          <span className="wx-summary-value"><span aria-hidden="true">🌡️</span> {snap.tempF}°F</span>
          <span className="wx-summary-detail"><span aria-hidden="true">🌡️</span> Feels like {snap.feelsLikeF}°F</span>
          <span className="wx-summary-detail"><span aria-hidden="true">💨</span> Wind {snap.windMph} mph {snap.windDir}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface WeatherSectionProps {
  weather: WeatherData;
  variant?: 'summary' | 'details';
}

export default function WeatherSection({ weather, variant = 'summary' }: WeatherSectionProps) {
  if (weather.snapshots.length === 0) return null;

  const snaps = weather.snapshots;
  const isDetails = variant === 'details';

  return (
    <section className="chart-section">
      <SectionHeader title={isDetails ? 'Weather Details' : 'Race Weather'} />
      {!isDetails && (
        <WeatherSummary weather={weather} />
      )}
      {isDetails && (
        <p className="wx-details-intro">
          Hourly weather conditions for the race window at {weather.venueAddress}.
        </p>
      )}
      {isDetails && (
        <>
          <div className="wx-grid-scroll">
            <table className="wx-grid" aria-label="Race weather conditions">
              <tbody>
                {WX_ROWS.map(row => (
                  <tr key={row.label}>
                    <th scope="row" className="wx-row-label">
                      <span className="wx-row-label-inner">
                        <span className="wx-row-label-icon" aria-hidden="true">{row.icon}</span>
                        <span>{row.label}</span>
                      </span>
                    </th>
                    {snaps.map(snap => (
                      <td key={snap.timeIso} className={`wx-grid-cell${row.className ? ` ${row.className}` : ''}`}>
                        {row.render(snap)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="wx-source">
            Weather data: <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo<span className="sr-only"> (opens in new tab)</span></a>
            {' '}historical archive · hourly resolution
          </p>
        </>
      )}
    </section>
  );
}
