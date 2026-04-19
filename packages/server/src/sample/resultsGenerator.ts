// Synthetic UltraSignup results CSV generator for Race Analytics demos.
// Uses a seeded LCG PRNG so output is deterministic per sampleId.

import type { WeatherData, WeatherSnapshot } from '../types.js';

class Prng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0; }

  next(): number {
    this.s = (Math.imul(this.s, 1664525) + 1013904223) >>> 0;
    return this.s / 0x100000000;
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  bool(p: number): boolean { return this.next() < p; }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  pickWeighted<T>(items: Array<{ value: T; weight: number }>): T {
    const total = items.reduce((s, x) => s + x.weight, 0);
    let r = this.next() * total;
    for (const { value, weight } of items) {
      r -= weight;
      if (r <= 0) return value;
    }
    return items[items.length - 1].value;
  }

  normal(mean: number, std: number): number {
    const u1 = Math.max(1e-10, this.next());
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * std;
  }
}

function seedFor(id: string): number {
  return id.split('').reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 0) >>> 0;
}

const CITIES_BY_STATE: Record<string, string[]> = {
  NH: ['Concord', 'Manchester', 'Nashua', 'Portsmouth', 'Laconia', 'Keene', 'Lebanon'],
  ME: ['Portland', 'Bangor', 'Augusta', 'Lewiston', 'Biddeford', 'Saco'],
  VT: ['Burlington', 'Montpelier', 'Rutland', 'Barre', 'St Johnsbury'],
  MA: ['Boston', 'Worcester', 'Springfield', 'Lowell', 'Cambridge', 'Northampton'],
  CT: ['Hartford', 'New Haven', 'Stamford', 'Bridgeport', 'Waterbury'],
  NY: ['New York', 'Buffalo', 'Albany', 'Syracuse', 'Saratoga Springs'],
  NJ: ['Newark', 'Jersey City', 'Trenton', 'Hoboken', 'Morristown'],
  PA: ['Philadelphia', 'Pittsburgh', 'Allentown', 'State College'],
  FL: ['Miami', 'Orlando', 'Tampa', 'Jacksonville'],
  CO: ['Denver', 'Boulder', 'Fort Collins', 'Colorado Springs'],
  CA: ['Los Angeles', 'San Francisco', 'San Diego', 'Sacramento'],
  TX: ['Austin', 'Dallas', 'Houston', 'San Antonio'],
  WA: ['Seattle', 'Spokane', 'Olympia', 'Bellevue'],
  OR: ['Portland', 'Eugene', 'Salem', 'Bend'],
  MI: ['Detroit', 'Grand Rapids', 'Lansing', 'Ann Arbor'],
  NC: ['Charlotte', 'Raleigh', 'Asheville', 'Durham'],
  GA: ['Atlanta', 'Savannah', 'Athens', 'Columbus'],
  CAN: ['Toronto', 'Montreal', 'Vancouver', 'Ottawa', 'Calgary'],
};

interface StateWeight { state: string; weight: number; }

interface EventConfig {
  distanceMiles: number;    // exact distance (e.g. 31.07 for 50K)
  count: number;            // starters for this event
  dnfRate: number;          // fraction of starters who DNF
  dnsRate: number;          // fraction of starters who DNS
  medianSecs: number;       // median finish time in seconds
  timeStdSecs: number;      // standard deviation in seconds
}

// Hardcoded synthetic weather for each sample
interface SampleWeather {
  venueAddress: string;
  raceStart: string;   // "YYYY-MM-DDTHH:MM" local
  raceEnd: string;
  snapshots: WeatherSnapshot[];
}

interface ResultsSampleConfig {
  raceName: string;
  events: EventConfig[];
  stateWeights: StateWeight[];
  genderM: number;    // fraction male
  ageMean: number;
  ageStd: number;
  weather: SampleWeather;
}

// ─── Sample definitions ───────────────────────────────────────────────────────

const NE_ULTRA_STATES: StateWeight[] = [
  { state: 'NH', weight: 26 }, { state: 'MA', weight: 22 }, { state: 'ME', weight: 10 },
  { state: 'VT', weight: 9 },  { state: 'NY', weight: 12 }, { state: 'CT', weight: 7 },
  { state: 'NJ', weight: 5 },  { state: 'PA', weight: 4 },  { state: 'CO', weight: 2 },
  { state: 'CA', weight: 2 },  { state: 'CAN', weight: 1 },
];

const LARGE_ULTRA_STATES: StateWeight[] = [
  { state: 'NH', weight: 18 }, { state: 'MA', weight: 17 }, { state: 'NY', weight: 14 },
  { state: 'ME', weight: 9 },  { state: 'CT', weight: 8 },  { state: 'VT', weight: 6 },
  { state: 'NJ', weight: 6 },  { state: 'PA', weight: 5 },  { state: 'FL', weight: 3 },
  { state: 'CO', weight: 4 },  { state: 'CA', weight: 4 },  { state: 'TX', weight: 2 },
  { state: 'WA', weight: 2 },  { state: 'OR', weight: 1 },  { state: 'CAN', weight: 1 },
];

function nhAugustWeather(startIso: string, endIso: string): SampleWeather {
  const d = startIso.slice(0, 11); // 'YYYY-MM-DDT'
  return {
    venueAddress: '1 Mason Road, Brookline, NH 03033',
    raceStart: startIso,
    raceEnd: endIso,
    snapshots: [
      {
        timeIso: startIso, label: 'Race Start',
        tempF: 64, feelsLikeF: 63, weatherCode: 1, weatherDesc: 'Mainly clear',
        cloudCoverPct: 12, windMph: 4.2, windGustMph: 7.1, windDir: 'SW',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: d + '09:00', label: '+2h',
        tempF: 70, feelsLikeF: 69, weatherCode: 1, weatherDesc: 'Mainly clear',
        cloudCoverPct: 15, windMph: 4.8, windGustMph: 8.2, windDir: 'SW',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: d + '11:00', label: '+4h',
        tempF: 75, feelsLikeF: 75, weatherCode: 2, weatherDesc: 'Partly cloudy',
        cloudCoverPct: 28, windMph: 5.9, windGustMph: 10.6, windDir: 'SSW',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: d + '13:00', label: '+6h',
        tempF: 79, feelsLikeF: 80, weatherCode: 2, weatherDesc: 'Partly cloudy',
        cloudCoverPct: 38, windMph: 6.8, windGustMph: 12.4, windDir: 'SSW',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: d + '15:00', label: '+8h',
        tempF: 80, feelsLikeF: 81, weatherCode: 2, weatherDesc: 'Partly cloudy',
        cloudCoverPct: 42, windMph: 7.2, windGustMph: 13.1, windDir: 'S',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: d + '17:00', label: '+10h',
        tempF: 76, feelsLikeF: 76, weatherCode: 1, weatherDesc: 'Mainly clear',
        cloudCoverPct: 24, windMph: 5.1, windGustMph: 9.4, windDir: 'SW',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: d + '19:00', label: '+12h',
        tempF: 72, feelsLikeF: 71, weatherCode: 1, weatherDesc: 'Mainly clear',
        cloudCoverPct: 18, windMph: 3.1, windGustMph: 5.5, windDir: 'W',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
    ],
  };
}

function nhSeptemberWeather(startIso: string, endIso: string): SampleWeather {
  const d = startIso.slice(0, 11);
  return {
    venueAddress: '1 Mason Road, Brookline, NH 03033',
    raceStart: startIso,
    raceEnd: endIso,
    snapshots: [
      {
        timeIso: startIso, label: 'Race Start',
        tempF: 52, feelsLikeF: 49, weatherCode: 2, weatherDesc: 'Partly cloudy',
        cloudCoverPct: 35, windMph: 5.8, windGustMph: 10.2, windDir: 'NW',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: d + '09:00', label: '+2h',
        tempF: 56, feelsLikeF: 54, weatherCode: 2, weatherDesc: 'Partly cloudy',
        cloudCoverPct: 28, windMph: 6.2, windGustMph: 11.4, windDir: 'NW',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: d + '11:00', label: '+4h',
        tempF: 60, feelsLikeF: 58, weatherCode: 1, weatherDesc: 'Mainly clear',
        cloudCoverPct: 20, windMph: 7.0, windGustMph: 12.8, windDir: 'NNW',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: d + '13:00', label: '+6h',
        tempF: 62, feelsLikeF: 60, weatherCode: 1, weatherDesc: 'Mainly clear',
        cloudCoverPct: 22, windMph: 7.4, windGustMph: 13.6, windDir: 'NNW',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: d + '15:00', label: '+8h',
        tempF: 61, feelsLikeF: 59, weatherCode: 2, weatherDesc: 'Partly cloudy',
        cloudCoverPct: 35, windMph: 6.5, windGustMph: 11.8, windDir: 'N',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: d + '17:00', label: '+10h',
        tempF: 58, feelsLikeF: 55, weatherCode: 2, weatherDesc: 'Partly cloudy',
        cloudCoverPct: 45, windMph: 5.1, windGustMph: 9.3, windDir: 'N',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
    ],
  };
}

function nhOctoberWeather(startIso: string, endIso: string, rainy: boolean): SampleWeather {
  const d = startIso.slice(0, 11); // day 1 prefix
  const nd = (h: number) => nextDayHour(startIso, h); // day 2 helper
  return {
    venueAddress: '1 Mason Road, Brookline, NH 03033',
    raceStart: startIso,
    raceEnd: endIso,
    snapshots: [
      // ── Day 1 ─────────────────────────────────────────────────────────────
      {
        timeIso: startIso, label: 'Race Start',
        tempF: rainy ? 44 : 41, feelsLikeF: rainy ? 40 : 36,
        weatherCode: rainy ? 61 : 3, weatherDesc: rainy ? 'Slight rain' : 'Overcast',
        cloudCoverPct: rainy ? 95 : 88,
        windMph: rainy ? 9.2 : 6.4, windGustMph: rainy ? 18.7 : 11.8, windDir: 'NE',
        precipInch: rainy ? 0.04 : 0, precipType: rainy ? 'rain' : '', precipIntensity: rainy ? 'light' : '',
      },
      {
        timeIso: d + '07:00', label: '+2h',
        tempF: rainy ? 45 : 42, feelsLikeF: rainy ? 41 : 37,
        weatherCode: rainy ? 63 : 3, weatherDesc: rainy ? 'Moderate rain' : 'Overcast',
        cloudCoverPct: rainy ? 97 : 82,
        windMph: rainy ? 10.4 : 7.1, windGustMph: rainy ? 20.8 : 13.4, windDir: 'NE',
        precipInch: rainy ? 0.12 : 0, precipType: rainy ? 'rain' : '', precipIntensity: rainy ? 'moderate' : '',
      },
      {
        timeIso: d + '09:00', label: '+4h',
        tempF: rainy ? 46 : 46, feelsLikeF: rainy ? 42 : 42,
        weatherCode: rainy ? 63 : 2, weatherDesc: rainy ? 'Moderate rain' : 'Partly cloudy',
        cloudCoverPct: rainy ? 98 : 65,
        windMph: rainy ? 11.0 : 8.2, windGustMph: rainy ? 21.6 : 15.7, windDir: 'E',
        precipInch: rainy ? 0.15 : 0, precipType: rainy ? 'rain' : '', precipIntensity: rainy ? 'moderate' : '',
      },
      {
        timeIso: d + '11:00', label: '+6h',
        tempF: rainy ? 47 : 51, feelsLikeF: rainy ? 43 : 47,
        weatherCode: rainy ? 63 : 2, weatherDesc: rainy ? 'Moderate rain' : 'Partly cloudy',
        cloudCoverPct: rainy ? 98 : 50,
        windMph: rainy ? 11.3 : 7.8, windGustMph: rainy ? 22.4 : 14.9, windDir: rainy ? 'E' : 'ENE',
        precipInch: rainy ? 0.18 : 0, precipType: rainy ? 'rain' : '', precipIntensity: rainy ? 'moderate' : '',
      },
      {
        timeIso: d + '13:00', label: '+8h',
        tempF: rainy ? 48 : 55, feelsLikeF: rainy ? 44 : 51,
        weatherCode: rainy ? 61 : 1, weatherDesc: rainy ? 'Slight rain' : 'Mainly clear',
        cloudCoverPct: rainy ? 96 : 35,
        windMph: rainy ? 10.8 : 6.9, windGustMph: rainy ? 21.0 : 13.2, windDir: 'E',
        precipInch: rainy ? 0.09 : 0, precipType: rainy ? 'rain' : '', precipIntensity: rainy ? 'light' : '',
      },
      {
        timeIso: d + '15:00', label: '+10h',
        tempF: rainy ? 47 : 54, feelsLikeF: rainy ? 43 : 50,
        weatherCode: rainy ? 61 : 1, weatherDesc: rainy ? 'Slight rain' : 'Mainly clear',
        cloudCoverPct: rainy ? 94 : 28,
        windMph: rainy ? 9.9 : 6.1, windGustMph: rainy ? 18.5 : 11.5, windDir: rainy ? 'NE' : 'SE',
        precipInch: rainy ? 0.07 : 0, precipType: rainy ? 'rain' : '', precipIntensity: rainy ? 'light' : '',
      },
      {
        timeIso: d + '17:00', label: '+12h',
        tempF: rainy ? 45 : 50, feelsLikeF: rainy ? 41 : 46,
        weatherCode: rainy ? 61 : 2, weatherDesc: rainy ? 'Slight rain' : 'Partly cloudy',
        cloudCoverPct: rainy ? 90 : 40,
        windMph: rainy ? 8.6 : 5.4, windGustMph: rainy ? 17.1 : 10.2, windDir: rainy ? 'NE' : 'S',
        precipInch: rainy ? 0.07 : 0, precipType: rainy ? 'rain' : '', precipIntensity: rainy ? 'light' : '',
      },
      {
        timeIso: d + '19:00', label: '+14h',
        tempF: rainy ? 43 : 45, feelsLikeF: rainy ? 39 : 41,
        weatherCode: rainy ? 3 : 2, weatherDesc: rainy ? 'Overcast' : 'Partly cloudy',
        cloudCoverPct: rainy ? 88 : 55,
        windMph: rainy ? 7.4 : 4.8, windGustMph: rainy ? 13.8 : 8.6, windDir: 'N',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: d + '21:00', label: '+16h',
        tempF: rainy ? 42 : 40, feelsLikeF: rainy ? 38 : 36,
        weatherCode: rainy ? 3 : 0, weatherDesc: rainy ? 'Overcast' : 'Clear sky',
        cloudCoverPct: rainy ? 85 : 12,
        windMph: rainy ? 6.8 : 3.6, windGustMph: rainy ? 12.1 : 6.4, windDir: rainy ? 'N' : 'W',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: d + '23:00', label: '+18h',
        tempF: rainy ? 41 : 37, feelsLikeF: rainy ? 37 : 33,
        weatherCode: rainy ? 3 : 0, weatherDesc: rainy ? 'Overcast' : 'Clear sky',
        cloudCoverPct: rainy ? 82 : 6,
        windMph: rainy ? 6.1 : 2.9, windGustMph: rainy ? 11.4 : 5.2, windDir: 'N',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      // ── Day 2 ─────────────────────────────────────────────────────────────
      {
        timeIso: nd(1), label: '+20h',
        tempF: rainy ? 39 : 34, feelsLikeF: rainy ? 35 : 30,
        weatherCode: rainy ? 2 : 0, weatherDesc: rainy ? 'Partly cloudy' : 'Clear sky',
        cloudCoverPct: rainy ? 65 : 4,
        windMph: rainy ? 5.2 : 2.4, windGustMph: rainy ? 9.4 : 4.1, windDir: 'NW',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: nd(3), label: '+22h',
        tempF: rainy ? 37 : 32, feelsLikeF: rainy ? 32 : 27,
        weatherCode: rainy ? 2 : 0, weatherDesc: rainy ? 'Partly cloudy' : 'Clear sky',
        cloudCoverPct: rainy ? 52 : 3,
        windMph: rainy ? 4.6 : 2.1, windGustMph: rainy ? 8.1 : 3.6, windDir: 'NW',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: nd(5), label: '+24h',
        tempF: 38, feelsLikeF: rainy ? 33 : 34,
        weatherCode: rainy ? 1 : 0, weatherDesc: rainy ? 'Mainly clear' : 'Clear sky',
        cloudCoverPct: rainy ? 20 : 5,
        windMph: 2.9, windGustMph: 4.8, windDir: 'NW',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: nd(7), label: '+26h',
        tempF: rainy ? 38 : 36, feelsLikeF: rainy ? 34 : 32,
        weatherCode: 1, weatherDesc: 'Mainly clear',
        cloudCoverPct: rainy ? 22 : 14,
        windMph: rainy ? 3.4 : 3.8, windGustMph: rainy ? 6.2 : 7.1, windDir: 'NNW',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: nd(9), label: '+28h',
        tempF: rainy ? 42 : 42, feelsLikeF: rainy ? 39 : 39,
        weatherCode: 1, weatherDesc: 'Mainly clear',
        cloudCoverPct: rainy ? 20 : 20,
        windMph: rainy ? 3.8 : 5.1, windGustMph: rainy ? 7.1 : 9.7, windDir: 'NW',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: nd(11), label: '+30h',
        tempF: 48, feelsLikeF: 45,
        weatherCode: 1, weatherDesc: 'Mainly clear',
        cloudCoverPct: 18,
        windMph: 5.4, windGustMph: 9.7, windDir: 'NW',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: nd(13), label: '+32h',
        tempF: rainy ? 51 : 54, feelsLikeF: rainy ? 48 : 51,
        weatherCode: 2, weatherDesc: 'Partly cloudy',
        cloudCoverPct: rainy ? 28 : 32,
        windMph: rainy ? 6.2 : 6.8, windGustMph: rainy ? 10.8 : 11.4, windDir: 'W',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: nd(15), label: '+34h',
        tempF: rainy ? 49 : 52, feelsLikeF: rainy ? 46 : 49,
        weatherCode: 2, weatherDesc: 'Partly cloudy',
        cloudCoverPct: rainy ? 35 : 40,
        windMph: rainy ? 6.8 : 7.1, windGustMph: rainy ? 11.4 : 12.6, windDir: 'W',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
    ],
  };
}

function nextDayHour(startIso: string, hour: number): string {
  const date = new Date(startIso.slice(0, 10) + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + 1);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:00`;
}

export const RESULTS_SAMPLE_CONFIGS: Record<string, ResultsSampleConfig> = {

  // ── Ridgeline Trail Races — single 50K ────────────────────────────────────

  'ghost-train-2022': {
    raceName: 'Ridgeline Trail Races',
    events: [{
      distanceMiles: 31.07, count: 74,
      dnfRate: 0.16, dnsRate: 0.09,
      medianSecs: 6.9 * 3600, timeStdSecs: 1.3 * 3600,
    }],
    stateWeights: NE_ULTRA_STATES,
    genderM: 0.58, ageMean: 38, ageStd: 9,
    weather: nhAugustWeather('2022-08-13T07:00', '2022-08-13T21:00'),
  },

  'ghost-train-2023': {
    raceName: 'Ridgeline Trail Races',
    events: [{
      distanceMiles: 31.07, count: 84,
      dnfRate: 0.14, dnsRate: 0.08,
      medianSecs: 6.75 * 3600, timeStdSecs: 1.25 * 3600,
    }],
    stateWeights: NE_ULTRA_STATES,
    genderM: 0.57, ageMean: 38, ageStd: 9,
    weather: nhAugustWeather('2023-08-12T07:00', '2023-08-12T21:00'),
  },

  'ghost-train-2024': {
    raceName: 'Ridgeline Trail Races',
    events: [{
      distanceMiles: 31.07, count: 96,
      dnfRate: 0.13, dnsRate: 0.07,
      medianSecs: 6.6 * 3600, timeStdSecs: 1.2 * 3600,
    }],
    stateWeights: NE_ULTRA_STATES,
    genderM: 0.56, ageMean: 38, ageStd: 9,
    weather: nhAugustWeather('2024-08-10T07:00', '2024-08-10T21:00'),
  },

  // ── White Mountains Challenge — HM + 50K ────────────────────────────────────

  'white-mountains-results-2024': {
    raceName: 'White Mountains Challenge',
    events: [
      {
        distanceMiles: 13.1, count: 128,
        dnfRate: 0.04, dnsRate: 0.05,
        medianSecs: 2.55 * 3600, timeStdSecs: 0.6 * 3600,
      },
      {
        distanceMiles: 31.07, count: 112,
        dnfRate: 0.15, dnsRate: 0.09,
        medianSecs: 6.8 * 3600, timeStdSecs: 1.25 * 3600,
      },
    ],
    stateWeights: NE_ULTRA_STATES,
    genderM: 0.54, ageMean: 37, ageStd: 9,
    weather: nhSeptemberWeather('2024-09-21T07:00', '2024-09-21T18:00'),
  },

  // ── Mountain Endurance Challenge — 25K / 50K / 50M / 100M ──────────────────

  'mountain-endurance-results-2022': {
    raceName: 'Mountain Endurance Challenge',
    events: [
      {
        distanceMiles: 15.53, count: 152,
        dnfRate: 0.07, dnsRate: 0.06,
        medianSecs: 2.85 * 3600, timeStdSecs: 0.65 * 3600,
      },
      {
        distanceMiles: 31.07, count: 178,
        dnfRate: 0.16, dnsRate: 0.09,
        medianSecs: 7.1 * 3600, timeStdSecs: 1.3 * 3600,
      },
      {
        distanceMiles: 50.0, count: 112,
        dnfRate: 0.26, dnsRate: 0.12,
        medianSecs: 13.2 * 3600, timeStdSecs: 2.0 * 3600,
      },
      {
        distanceMiles: 100.0, count: 68,
        dnfRate: 0.35, dnsRate: 0.14,
        medianSecs: 26.5 * 3600, timeStdSecs: 3.5 * 3600,
      },
    ],
    stateWeights: LARGE_ULTRA_STATES,
    genderM: 0.60, ageMean: 39, ageStd: 9,
    weather: nhOctoberWeather('2022-10-08T05:00', '2022-10-09T17:00', false),
  },

  'mountain-endurance-results-2023': {
    raceName: 'Mountain Endurance Challenge',
    events: [
      {
        distanceMiles: 15.53, count: 174,
        dnfRate: 0.06, dnsRate: 0.06,
        medianSecs: 2.8 * 3600, timeStdSecs: 0.62 * 3600,
      },
      {
        distanceMiles: 31.07, count: 202,
        dnfRate: 0.15, dnsRate: 0.08,
        medianSecs: 7.0 * 3600, timeStdSecs: 1.25 * 3600,
      },
      {
        distanceMiles: 50.0, count: 128,
        dnfRate: 0.24, dnsRate: 0.11,
        medianSecs: 13.0 * 3600, timeStdSecs: 1.9 * 3600,
      },
      {
        distanceMiles: 100.0, count: 78,
        dnfRate: 0.33, dnsRate: 0.13,
        medianSecs: 26.0 * 3600, timeStdSecs: 3.3 * 3600,
      },
    ],
    stateWeights: LARGE_ULTRA_STATES,
    genderM: 0.59, ageMean: 39, ageStd: 9,
    weather: nhOctoberWeather('2023-10-14T05:00', '2023-10-15T17:00', true),
  },

  'mountain-endurance-results-2024': {
    raceName: 'Mountain Endurance Challenge',
    events: [
      {
        distanceMiles: 15.53, count: 196,
        dnfRate: 0.06, dnsRate: 0.05,
        medianSecs: 2.75 * 3600, timeStdSecs: 0.60 * 3600,
      },
      {
        distanceMiles: 31.07, count: 228,
        dnfRate: 0.14, dnsRate: 0.08,
        medianSecs: 6.85 * 3600, timeStdSecs: 1.2 * 3600,
      },
      {
        distanceMiles: 50.0, count: 144,
        dnfRate: 0.23, dnsRate: 0.10,
        medianSecs: 12.75 * 3600, timeStdSecs: 1.85 * 3600,
      },
      {
        distanceMiles: 100.0, count: 88,
        dnfRate: 0.31, dnsRate: 0.12,
        medianSecs: 25.5 * 3600, timeStdSecs: 3.2 * 3600,
      },
    ],
    stateWeights: LARGE_ULTRA_STATES,
    genderM: 0.58, ageMean: 39, ageStd: 9,
    weather: nhOctoberWeather('2024-10-12T05:00', '2024-10-13T17:00', false),
  },
};

// ─── CSV generation ───────────────────────────────────────────────────────────

const CSV_HEADER = 'place,bib,first,last,age,gender,city,state,country,division,time,distance,finish_status';

function formatTime(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function divisionName(gender: string, age: number): string {
  const g = gender === 'M' ? 'Male' : 'Female';
  if (age < 20) return `${g} 0-19`;
  if (age < 30) return `${g} 20-29`;
  if (age < 40) return `${g} 30-39`;
  if (age < 50) return `${g} 40-49`;
  if (age < 60) return `${g} 50-59`;
  if (age < 70) return `${g} 60-69`;
  return `${g} 70+`;
}

function csvField(v: string | number): string {
  const s = String(v);
  return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
}

interface Participant {
  bib: number;
  age: number;
  gender: string;
  city: string;
  state: string;
  country: string;
  distanceMiles: number;
  timeSecs: number | null;   // null = DNF or DNS
  finishStatus: number;      // 1=finish 2=DNF 3=DNS
  overallPlace: number | null;
  division: string;
  eventIdx: number;          // which event they entered
}

export function generateResultsCSV(sampleId: string): string {
  const config = RESULTS_SAMPLE_CONFIGS[sampleId];
  if (!config) throw new Error(`Unknown results sample ID: ${sampleId}`);

  const rng = new Prng(seedFor(sampleId));

  // Generate participants per event
  const allByEvent: Participant[][] = config.events.map((ev, evIdx) => {
    const participants: Participant[] = [];

    for (let i = 0; i < ev.count; i++) {
      const stateObj = rng.pickWeighted(config.stateWeights.map(s => ({ value: s.state, weight: s.weight })));
      const country = stateObj === 'CAN' ? 'CAN' : 'USA';
      const state = stateObj === 'CAN' ? rng.pick(['ON', 'QC', 'BC', 'AB']) : stateObj;
      const cities = CITIES_BY_STATE[stateObj] ?? ['Unknown'];
      const city = rng.pick(cities);

      const gRoll = rng.next();
      const gender = gRoll < config.genderM ? 'M' : gRoll < config.genderM + 0.02 ? 'NB' : 'F';
      const age = Math.max(18, Math.min(75, Math.round(rng.normal(config.ageMean, config.ageStd))));

      // Determine finish status
      let finishStatus: number;
      const r = rng.next();
      if (r < ev.dnsRate) {
        finishStatus = 3; // DNS
      } else if (r < ev.dnsRate + ev.dnfRate) {
        finishStatus = 2; // DNF
      } else {
        finishStatus = 1; // Finished
      }

      let timeSecs: number | null = null;
      let distanceMiles = ev.distanceMiles;

      if (finishStatus === 1) {
        // Normal distribution around median, clamp to reasonable range
        const raw = rng.normal(ev.medianSecs, ev.timeStdSecs);
        timeSecs = Math.max(ev.medianSecs * 0.5, Math.min(ev.medianSecs * 2.0, Math.round(raw)));
      } else if (finishStatus === 2) {
        // DNF: partial distance — stopped between 20% and 85% of course
        distanceMiles = parseFloat((ev.distanceMiles * (0.20 + rng.next() * 0.65)).toFixed(2));
      } else {
        // DNS: no time, no distance
        distanceMiles = 0;
      }

      participants.push({
        bib: 0, // assigned below
        age, gender, city, state, country,
        distanceMiles,
        timeSecs,
        finishStatus,
        overallPlace: null,
        division: divisionName(gender, age),
        eventIdx: evIdx,
      });
    }

    // Assign overall places within this event (sorted by finish time)
    const finishers = participants.filter(p => p.finishStatus === 1);
    finishers.sort((a, b) => (a.timeSecs ?? 0) - (b.timeSecs ?? 0));
    finishers.forEach((p, i) => { p.overallPlace = i + 1; });

    return participants;
  });

  // Assign bibs sequentially across all events
  let bib = 1;
  for (const group of allByEvent) {
    for (const p of group) {
      p.bib = bib++;
    }
  }

  // Build CSV rows — order: finishers first (by place), then DNF, then DNS
  const rows: string[] = [CSV_HEADER];

  for (const group of allByEvent) {
    const finishers = group.filter(p => p.finishStatus === 1).sort((a, b) => (a.overallPlace ?? 0) - (b.overallPlace ?? 0));
    const dnfs = group.filter(p => p.finishStatus === 2);
    const dnss = group.filter(p => p.finishStatus === 3);

    for (const p of [...finishers, ...dnfs, ...dnss]) {
      const fields = [
        p.overallPlace !== null ? String(p.overallPlace) : '',
        String(p.bib),
        `Participant${p.bib}`,
        `Runner${String(p.bib).padStart(4, '0')}`,
        String(p.age),
        p.gender,
        p.city,
        p.state,
        p.country,
        p.division,
        p.timeSecs !== null ? formatTime(p.timeSecs) : '',
        p.finishStatus !== 3 && p.distanceMiles > 0 ? String(p.distanceMiles) : '',
        String(p.finishStatus),
      ].map(csvField);
      rows.push(fields.join(','));
    }
  }

  return rows.join('\n');
}

export function generateResultsWeather(sampleId: string): WeatherData | undefined {
  const config = RESULTS_SAMPLE_CONFIGS[sampleId];
  if (!config) return undefined;
  const w = config.weather;
  return {
    venueAddress: w.venueAddress,
    raceStartIso: w.raceStart,
    raceEndIso: w.raceEnd,
    snapshots: w.snapshots,
  };
}

export function getSampleResultsRaceName(sampleId: string): string {
  return RESULTS_SAMPLE_CONFIGS[sampleId]?.raceName ?? sampleId;
}

export function isValidResultsSampleId(sampleId: string): boolean {
  return Object.prototype.hasOwnProperty.call(RESULTS_SAMPLE_CONFIGS, sampleId);
}
