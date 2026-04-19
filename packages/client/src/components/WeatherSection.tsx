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
  render: (s: WeatherSnapshot) => string;
  className?: string;
}

const WX_ROWS: WxRow[] = [
  { label: 'Race Time',   render: s => s.label },
  { label: 'Date',        render: s => parseDate(s.timeIso) },
  { label: 'Time of Day', render: s => parseTimeOfDay(s.timeIso) },
  { label: 'Condition',   render: s => `${weatherIcon(s.weatherCode)} ${s.weatherDesc}`, className: 'wx-condition-cell' },
  { label: 'Temp',        render: s => `${s.tempF}°F` },
  { label: 'Feels Like',  render: s => `${s.feelsLikeF}°F` },
  { label: 'Cloud Cover', render: s => `${s.cloudCoverPct}%` },
  { label: 'Wind',        render: s => `${s.windMph} mph ${s.windDir}` },
  { label: 'Gusts',       render: s => `${s.windGustMph} mph` },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface WeatherSectionProps {
  weather: WeatherData;
}

export default function WeatherSection({ weather }: WeatherSectionProps) {
  if (weather.snapshots.length === 0) return null;

  const snaps = weather.snapshots;

  return (
    <section className="chart-section" aria-labelledby="wx-heading">
      <SectionHeader title="Race Weather" />
      <p className="wx-venue">
        <span className="wx-venue-label">Venue:</span> {weather.venueAddress}
      </p>
      <div className="wx-grid-scroll">
        <table className="wx-grid" aria-label="Race weather conditions">
          <tbody>
            {WX_ROWS.map(row => (
              <tr key={row.label}>
                <th scope="row" className="wx-row-label">{row.label}</th>
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
    </section>
  );
}
