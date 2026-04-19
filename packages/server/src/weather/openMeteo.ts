import type { WeatherData, WeatherSnapshot } from '../types.js';

// WMO weather interpretation codes → human-readable descriptions
const WMO_DESCRIPTIONS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Icy fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  56: 'Light freezing drizzle', 57: 'Heavy freezing drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  66: 'Light freezing rain', 67: 'Heavy freezing rain',
  71: 'Slight snowfall', 73: 'Moderate snowfall', 75: 'Heavy snowfall',
  77: 'Snow grains',
  80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
  85: 'Slight snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail',
};

function wmoDesc(code: number): string {
  return WMO_DESCRIPTIONS[code] ?? `Weather code ${code}`;
}

function windCompass(degrees: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(degrees / 22.5) % 16];
}

function precipType(wmoCode: number, snowfall: number, rain: number): string {
  // Snow codes
  if ([71, 73, 75, 77, 85, 86].includes(wmoCode)) return 'snow';
  // Freezing rain/drizzle → wintry mix
  if ([56, 57, 66, 67].includes(wmoCode)) return 'wintry mix';
  if (snowfall > 0 && rain > 0) return 'wintry mix';
  if (snowfall > 0) return 'snow';
  if (rain > 0) return 'rain';
  return '';
}

function precipIntensity(totalInch: number): string {
  if (totalInch <= 0) return '';
  if (totalInch < 0.1) return 'light';
  if (totalInch < 0.3) return 'moderate';
  return 'heavy';
}

// Parse a datetime-local string ("2024-08-10T09:00") to a Date in UTC using
// the offset from the Open-Meteo utc_offset_seconds field.
function localStringToUtcMs(localIso: string, utcOffsetSec: number): number {
  // localIso has no timezone info — treat as wall-clock time at the venue.
  // Open-Meteo returns times in local time, so we subtract the offset to get UTC ms.
  const base = new Date(localIso + 'Z').getTime(); // parse as-if UTC
  return base - utcOffsetSec * 1000;               // shift to actual UTC
}

function formatLocalIso(utcMs: number, utcOffsetSec: number): string {
  const localMs = utcMs + utcOffsetSec * 1000;
  return new Date(localMs).toISOString().replace('Z', '').slice(0, 16);
}

interface OpenMeteoResponse {
  hourly: {
    time: string[];
    temperature_2m: number[];
    apparent_temperature: number[];
    precipitation: number[];
    rain: number[];
    snowfall: number[];
    cloud_cover: number[];
    wind_speed_10m: number[];
    wind_gusts_10m: number[];
    wind_direction_10m: number[];
    weather_code: number[];
  };
  utc_offset_seconds: number;
}

export async function fetchRaceWeather(
  lat: number,
  lng: number,
  venueAddress: string,
  raceStart: string,  // "YYYY-MM-DDTHH:MM" local datetime-local value
  raceEnd: string,
): Promise<WeatherData | null> {
  try {
    const startDate = raceStart.slice(0, 10);
    const endDate = raceEnd.slice(0, 10);

    const url = new URL('https://archive-api.open-meteo.com/v1/archive');
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lng));
    url.searchParams.set('start_date', startDate);
    url.searchParams.set('end_date', endDate);
    url.searchParams.set(
      'hourly',
      'temperature_2m,apparent_temperature,precipitation,rain,snowfall,cloud_cover,wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code',
    );
    url.searchParams.set('temperature_unit', 'fahrenheit');
    url.searchParams.set('wind_speed_unit', 'mph');
    url.searchParams.set('precipitation_unit', 'inch');
    url.searchParams.set('timezone', 'auto');

    const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) {
      console.warn(`[weather] Open-Meteo returned ${resp.status} for ${venueAddress}`);
      return null;
    }

    const data = (await resp.json()) as OpenMeteoResponse;
    const h = data.hourly;
    const offsetSec = data.utc_offset_seconds;

    // Build a map from local-time prefix (YYYY-MM-DDTHH) → array index
    const timeIndex = new Map<string, number>(
      h.time.map((t, i) => [t.slice(0, 13), i]),
    );

    const startUtcMs = localStringToUtcMs(raceStart, offsetSec);
    const endUtcMs = localStringToUtcMs(raceEnd, offsetSec);
    const durationMs = endUtcMs - startUtcMs;

    // Collect snapshot UTC timestamps: start, every 2h, end
    const candidateMs: number[] = [startUtcMs];
    if (durationMs >= 2 * 3600 * 1000) {
      for (let offset = 2 * 3600 * 1000; offset < durationMs; offset += 2 * 3600 * 1000) {
        candidateMs.push(startUtcMs + offset);
      }
    }
    // Always add race end unless it already coincides with the last 2h snapshot
    const lastCandidate = candidateMs[candidateMs.length - 1];
    if (endUtcMs > lastCandidate) {
      candidateMs.push(endUtcMs);
    }

    // Label each candidate
    const snapshots: WeatherSnapshot[] = [];
    for (let si = 0; si < candidateMs.length; si++) {
      const utcMs = candidateMs[si];
      const localIso = formatLocalIso(utcMs, offsetSec);
      const hourKey = localIso.slice(0, 13); // "YYYY-MM-DDTHH"

      const idx = timeIndex.get(hourKey);
      if (idx === undefined) continue; // hour not in API response range

      let label: string;
      if (si === 0) {
        label = 'Race Start';
      } else if (si === candidateMs.length - 1 && utcMs === endUtcMs) {
        label = 'Race End';
      } else {
        const hoursFromStart = Math.round((utcMs - startUtcMs) / (3600 * 1000));
        label = `+${hoursFromStart}h`;
      }

      const snow = h.snowfall[idx];
      const rain = h.rain[idx];
      const precip = h.precipitation[idx];
      const wmoCode = h.weather_code[idx];

      snapshots.push({
        timeIso: localIso,
        label,
        tempF: Math.round(h.temperature_2m[idx] * 10) / 10,
        feelsLikeF: Math.round(h.apparent_temperature[idx] * 10) / 10,
        weatherCode: wmoCode,
        weatherDesc: wmoDesc(wmoCode),
        cloudCoverPct: Math.round(h.cloud_cover[idx]),
        windMph: Math.round(h.wind_speed_10m[idx] * 10) / 10,
        windGustMph: Math.round(h.wind_gusts_10m[idx] * 10) / 10,
        windDir: windCompass(h.wind_direction_10m[idx]),
        precipInch: Math.round(precip * 100) / 100,
        precipType: precipType(wmoCode, snow, rain),
        precipIntensity: precipIntensity(precip),
      });
    }

    return {
      venueAddress,
      raceStartIso: raceStart,
      raceEndIso: raceEnd,
      snapshots,
    };
  } catch (err) {
    console.warn('[weather] Failed to fetch weather data:', err);
    return null;
  }
}
