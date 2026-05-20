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
  RI: ['Providence', 'Warwick', 'Newport', 'Pawtucket'],
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
  distanceMiles: number;      // exact distance (fixed-distance) or unused placeholder (fixed-time)
  count: number;              // starters for this event
  dnfRate: number;            // fraction of starters who DNF
  dnsRate: number;            // fraction of starters who DNS
  medianSecs: number;         // median finish time in seconds (fixed-distance only)
  timeStdSecs: number;        // std dev of finish time (fixed-distance only)
  // Fixed-time event fields (set fixedTime: true and provide the three below):
  fixedTime?: boolean;
  durationSecs?: number;      // race duration (e.g. 24 * 3600 for a 24-hour race)
  medianMiles?: number;       // median distance covered by finishers
  distanceStdMiles?: number;  // std dev of finisher distance
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

const CO_ULTRA_STATES: StateWeight[] = [
  { state: 'CO', weight: 30 }, { state: 'CA', weight: 16 }, { state: 'TX', weight: 10 },
  { state: 'WA', weight: 8 },  { state: 'OR', weight: 7 },  { state: 'AZ', weight: 6 },
  { state: 'UT', weight: 5 },  { state: 'NY', weight: 4 },  { state: 'IL', weight: 3 },
  { state: 'PA', weight: 3 },  { state: 'GA', weight: 2 },  { state: 'NC', weight: 2 },
  { state: 'MN', weight: 2 },  { state: 'CAN', weight: 2 },
];

const COMMUNITY_5K_STATES: StateWeight[] = [
  { state: 'MA', weight: 44 }, { state: 'NH', weight: 18 }, { state: 'RI', weight: 12 },
  { state: 'CT', weight: 10 }, { state: 'ME', weight: 6 },  { state: 'VT', weight: 4 },
  { state: 'NY', weight: 4 },  { state: 'NJ', weight: 2 },
];

function maSpring5kWeather(startIso: string, endIso: string): SampleWeather {
  const d = startIso.slice(0, 11);
  return {
    venueAddress: '100 Park Drive, Boston, MA 02215',
    raceStart: startIso,
    raceEnd: endIso,
    snapshots: [
      {
        timeIso: startIso, label: 'Race Start',
        tempF: 58, feelsLikeF: 57, weatherCode: 1, weatherDesc: 'Mainly clear',
        cloudCoverPct: 18, windMph: 4.6, windGustMph: 8.4, windDir: 'SW',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: d + '09:00', label: '+1h',
        tempF: 62, feelsLikeF: 61, weatherCode: 2, weatherDesc: 'Partly cloudy',
        cloudCoverPct: 32, windMph: 5.8, windGustMph: 10.1, windDir: 'SW',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: endIso, label: 'Race End',
        tempF: 64, feelsLikeF: 63, weatherCode: 2, weatherDesc: 'Partly cloudy',
        cloudCoverPct: 36, windMph: 6.2, windGustMph: 11.0, windDir: 'WSW',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
    ],
  };
}

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

type OctoberWeatherProfile = 'overcast' | 'rainy' | 'clear';

function nhOctoberWeather(startIso: string, endIso: string, profile: OctoberWeatherProfile): SampleWeather {
  const d = startIso.slice(0, 11); // day 1 prefix
  const nd = (h: number) => nextDayHour(startIso, h); // day 2 helper
  const offsets = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36];
  const timeForOffset = (offset: number) => {
    if (offset === 0) return startIso;
    if (offset === 36) return endIso;
    if (offset < 20) return `${d}${String(5 + offset).padStart(2, '0')}:00`;
    return nd(offset - 19);
  };
  const profileData: Record<OctoberWeatherProfile, { temps: number[]; winds: number[]; gusts: number[]; dirs: string[] }> = {
    overcast: {
      temps: [42, 43, 46, 49, 52, 54, 53, 50, 47, 44, 41, 40, 42, 44, 48, 52, 53, 52, 50],
      winds: [7.2, 7.8, 8.4, 8.9, 9.1, 8.7, 8.0, 7.2, 6.4, 5.8, 5.0, 4.4, 4.2, 4.8, 5.6, 6.4, 6.8, 6.3, 5.7],
      gusts: [13.4, 14.2, 15.8, 16.7, 17.2, 16.4, 15.1, 13.8, 12.1, 10.6, 9.2, 8.0, 7.8, 8.6, 10.1, 11.8, 12.6, 11.4, 10.2],
      dirs: ['NE', 'NE', 'E', 'E', 'ENE', 'ENE', 'E', 'NE', 'N', 'N', 'NW', 'NW', 'NW', 'W', 'W', 'W', 'WNW', 'NW', 'NW'],
    },
    rainy: {
      temps: [45, 46, 47, 49, 51, 52, 50, 48, 46, 44, 42, 41, 42, 43, 45, 48, 50, 49, 47],
      winds: [9.2, 10.4, 11.0, 11.6, 11.3, 10.8, 9.7, 8.8, 7.9, 7.0, 6.2, 5.4, 4.8, 5.2, 6.1, 7.0, 7.4, 6.8, 6.0],
      gusts: [18.7, 20.8, 22.4, 23.6, 22.9, 21.7, 19.2, 16.8, 14.5, 12.9, 11.4, 9.6, 8.8, 9.4, 11.2, 13.1, 14.0, 12.8, 11.3],
      dirs: ['NE', 'NE', 'E', 'E', 'E', 'ENE', 'NE', 'NE', 'N', 'N', 'NW', 'NW', 'NW', 'WNW', 'W', 'W', 'W', 'NW', 'NW'],
    },
    clear: {
      temps: [41, 43, 49, 54, 58, 57, 53, 48, 43, 39, 36, 35, 38, 42, 49, 55, 57, 56, 54],
      winds: [4.2, 4.8, 5.6, 6.4, 7.0, 6.6, 5.4, 4.2, 3.4, 2.8, 2.2, 2.0, 2.6, 3.5, 4.8, 5.8, 6.3, 5.6, 4.9],
      gusts: [7.8, 8.6, 10.2, 11.8, 13.0, 12.1, 9.8, 7.6, 6.1, 4.9, 3.8, 3.4, 4.8, 6.6, 8.9, 10.7, 11.6, 10.2, 9.1],
      dirs: ['NW', 'NW', 'NNW', 'N', 'N', 'NNE', 'NE', 'E', 'E', 'W', 'W', 'W', 'W', 'SW', 'SW', 'SW', 'WSW', 'W', 'W'],
    },
  };
  const current = profileData[profile];
  const weatherFor = (index: number): Pick<WeatherSnapshot, 'weatherCode' | 'weatherDesc' | 'cloudCoverPct' | 'precipInch' | 'precipType' | 'precipIntensity'> => {
    if (profile === 'rainy') {
      if (index <= 5) {
        return {
          weatherCode: index <= 1 ? 61 : 63,
          weatherDesc: index <= 1 ? 'Slight rain' : 'Moderate rain',
          cloudCoverPct: index <= 5 ? 96 : 88,
          precipInch: index <= 5 ? (index <= 1 ? 0.05 : 0.14) : 0.02,
          precipType: 'rain',
          precipIntensity: index <= 1 ? 'light' : 'moderate',
        };
      }
      if (index <= 8) {
        return { weatherCode: 61, weatherDesc: 'Light rain', cloudCoverPct: 90, precipInch: 0.04, precipType: 'rain', precipIntensity: 'light' };
      }
      if (index <= 12) return { weatherCode: 3, weatherDesc: 'Overcast', cloudCoverPct: 82, precipInch: 0, precipType: '', precipIntensity: '' };
      return { weatherCode: 2, weatherDesc: 'Partly cloudy', cloudCoverPct: 45, precipInch: 0, precipType: '', precipIntensity: '' };
    }
    if (profile === 'overcast') {
      if (index <= 6) return { weatherCode: 3, weatherDesc: 'Overcast', cloudCoverPct: 88, precipInch: 0, precipType: '', precipIntensity: '' };
      if (index <= 9) return { weatherCode: 2, weatherDesc: 'Mostly cloudy', cloudCoverPct: 68, precipInch: 0, precipType: '', precipIntensity: '' };
      return { weatherCode: 2, weatherDesc: 'Partly cloudy', cloudCoverPct: 42, precipInch: 0, precipType: '', precipIntensity: '' };
    }
    if (index <= 2) return { weatherCode: 1, weatherDesc: 'Mainly clear', cloudCoverPct: 12, precipInch: 0, precipType: '', precipIntensity: '' };
    if (index <= 6) return { weatherCode: 2, weatherDesc: 'Partly cloudy', cloudCoverPct: 28, precipInch: 0, precipType: '', precipIntensity: '' };
    if (index <= 11) return { weatherCode: 0, weatherDesc: 'Clear sky', cloudCoverPct: 6, precipInch: 0, precipType: '', precipIntensity: '' };
    return { weatherCode: 1, weatherDesc: 'Mainly clear', cloudCoverPct: 18, precipInch: 0, precipType: '', precipIntensity: '' };
  };
  return {
    venueAddress: '1 Mason Road, Brookline, NH 03033',
    raceStart: startIso,
    raceEnd: endIso,
    snapshots: offsets.map((offset, index) => {
      const weather = weatherFor(index);
      return {
        timeIso: timeForOffset(offset),
        label: offset === 0 ? 'Race Start' : offset === 36 ? 'Race End' : `+${offset}h`,
        tempF: current.temps[index],
        feelsLikeF: current.temps[index] - (profile === 'clear' ? (index >= 10 && index <= 13 ? 4 : 2) : profile === 'rainy' ? 4 : 3),
        weatherCode: weather.weatherCode,
        weatherDesc: weather.weatherDesc,
        cloudCoverPct: weather.cloudCoverPct,
        windMph: current.winds[index],
        windGustMph: current.gusts[index],
        windDir: current.dirs[index],
        precipInch: weather.precipInch,
        precipType: weather.precipType,
        precipIntensity: weather.precipIntensity,
      };
    }),
  };
}

function coWeather24hr(startIso: string, endIso: string): SampleWeather {
  const d = startIso.slice(0, 11); // day 1 'YYYY-MM-DDT'
  const nd = (h: number) => nextDayHour(startIso, h); // day 2 helper
  return {
    venueAddress: '14 Ridgecrest Road, Salida, CO 81201',
    raceStart: startIso,
    raceEnd: endIso,
    snapshots: [
      {
        timeIso: startIso, label: 'Race Start',
        tempF: 58, feelsLikeF: 56, weatherCode: 1, weatherDesc: 'Mainly clear',
        cloudCoverPct: 8, windMph: 5.2, windGustMph: 9.4, windDir: 'SW',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: d + '10:00', label: '+4h',
        tempF: 68, feelsLikeF: 67, weatherCode: 1, weatherDesc: 'Mainly clear',
        cloudCoverPct: 12, windMph: 6.1, windGustMph: 11.2, windDir: 'SW',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: d + '14:00', label: '+8h',
        tempF: 78, feelsLikeF: 76, weatherCode: 2, weatherDesc: 'Partly cloudy',
        cloudCoverPct: 30, windMph: 7.8, windGustMph: 14.3, windDir: 'SSW',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: d + '18:00', label: '+12h',
        tempF: 72, feelsLikeF: 70, weatherCode: 2, weatherDesc: 'Partly cloudy',
        cloudCoverPct: 35, windMph: 5.4, windGustMph: 9.8, windDir: 'W',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: d + '22:00', label: '+16h',
        tempF: 59, feelsLikeF: 57, weatherCode: 1, weatherDesc: 'Mainly clear',
        cloudCoverPct: 15, windMph: 3.2, windGustMph: 5.8, windDir: 'NW',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: nd(2), label: '+20h',
        tempF: 52, feelsLikeF: 49, weatherCode: 1, weatherDesc: 'Clear',
        cloudCoverPct: 5, windMph: 2.1, windGustMph: 3.9, windDir: 'NW',
        precipInch: 0, precipType: '', precipIntensity: '',
      },
      {
        timeIso: nd(6), label: 'Finish',
        tempF: 61, feelsLikeF: 59, weatherCode: 1, weatherDesc: 'Mainly clear',
        cloudCoverPct: 10, windMph: 4.4, windGustMph: 8.1, windDir: 'SW',
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

  // ── Harbor Park 5K — single-event road race ───────────────────────────────

  'harbor-park-5k-results-2024': {
    raceName: 'Harbor Park 5K',
    events: [
      {
        distanceMiles: 3.11, count: 452,
        dnfRate: 0.003, dnsRate: 0.06,
        medianSecs: 28 * 60, timeStdSecs: 7 * 60,
      },
    ],
    stateWeights: COMMUNITY_5K_STATES,
    genderM: 0.46, ageMean: 36, ageStd: 13,
    weather: maSpring5kWeather('2024-05-18T08:00', '2024-05-18T09:30'),
  },

  // ── Ridgeline Trail Races — 25K + 50K ────────────────────────────────────

  'ghost-train-2022': {
    raceName: 'Ridgeline Trail Races',
    events: [
      {
        distanceMiles: 15.53, count: 38,
        dnfRate: 0.06, dnsRate: 0.05,
        medianSecs: 2.9 * 3600, timeStdSecs: 0.58 * 3600,
      },
      {
        distanceMiles: 31.07, count: 74,
        dnfRate: 0.16, dnsRate: 0.09,
        medianSecs: 6.9 * 3600, timeStdSecs: 1.3 * 3600,
      },
    ],
    stateWeights: NE_ULTRA_STATES,
    genderM: 0.58, ageMean: 38, ageStd: 9,
    weather: nhAugustWeather('2022-08-13T07:00', '2022-08-13T21:00'),
  },

  'ghost-train-2023': {
    raceName: 'Ridgeline Trail Races',
    events: [
      {
        distanceMiles: 15.53, count: 46,
        dnfRate: 0.05, dnsRate: 0.05,
        medianSecs: 2.85 * 3600, timeStdSecs: 0.55 * 3600,
      },
      {
        distanceMiles: 31.07, count: 84,
        dnfRate: 0.14, dnsRate: 0.08,
        medianSecs: 6.75 * 3600, timeStdSecs: 1.25 * 3600,
      },
    ],
    stateWeights: NE_ULTRA_STATES,
    genderM: 0.57, ageMean: 38, ageStd: 9,
    weather: nhAugustWeather('2023-08-12T07:00', '2023-08-12T21:00'),
  },

  'ghost-train-2024': {
    raceName: 'Ridgeline Trail Races',
    events: [
      {
        distanceMiles: 15.53, count: 54,
        dnfRate: 0.04, dnsRate: 0.04,
        medianSecs: 2.8 * 3600, timeStdSecs: 0.52 * 3600,
      },
      {
        distanceMiles: 31.07, count: 96,
        dnfRate: 0.13, dnsRate: 0.07,
        medianSecs: 6.6 * 3600, timeStdSecs: 1.2 * 3600,
      },
    ],
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
    weather: nhOctoberWeather('2022-10-08T05:00', '2022-10-09T17:00', 'overcast'),
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
    weather: nhOctoberWeather('2023-10-14T05:00', '2023-10-15T17:00', 'rainy'),
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
    weather: nhOctoberWeather('2024-10-12T05:00', '2024-10-13T17:00', 'clear'),
  },

  // ── Coyote Ridge 24-Hour Endurance Run ────────────────────────────────────

  'coyote-ridge-24hr-2024': {
    raceName: 'Coyote Ridge 24-Hour Endurance Run',
    events: [{
      distanceMiles: 0,           // unused for fixed-time events
      count: 88,
      dnfRate: 0.18,
      dnsRate: 0.09,
      medianSecs: 0,              // unused for fixed-time events
      timeStdSecs: 0,             // unused for fixed-time events
      fixedTime: true,
      durationSecs: 24 * 3600,   // 24-hour race
      medianMiles: 55,            // median finisher covers ~55 miles
      distanceStdMiles: 16,       // wide spread: back-of-pack ~25 mi, elites ~95 mi
    }],
    stateWeights: CO_ULTRA_STATES,
    genderM: 0.60, ageMean: 40, ageStd: 10,
    weather: coWeather24hr('2024-06-22T06:00', '2024-06-23T06:00'),
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
  const g = gender === 'M' ? 'Male' : gender === 'F' ? 'Female' : 'Non-Binary';
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
    const isFixedTime = ev.fixedTime === true && ev.durationSecs != null && ev.medianMiles != null;

    // For fixed-time events: pre-generate a pool of unique integer distance buckets sampled
    // without replacement so no 3+ finishers share a rounded mile (which would cause the
    // event-type detector to classify it as fixed-distance instead of fixed-time).
    const fixedTimeBuckets: number[] = [];
    if (isFixedTime) {
      const medMi = ev.medianMiles!;
      const stdMi = ev.distanceStdMiles ?? medMi * 0.25;
      const minB = Math.max(3, Math.floor(medMi * 0.20));
      const maxB = Math.ceil(medMi * 1.95);
      const available = new Set(Array.from({ length: maxB - minB + 1 }, (_, i) => minB + i));
      const needed = Math.ceil(ev.count * (1 - ev.dnsRate - ev.dnfRate)) + 10;
      for (let k = 0; k < needed && available.size > 0; k++) {
        const candidates = [...available];
        const wts = candidates.map(d => {
          const z = (d - medMi) / stdMi;
          return Math.exp(-0.5 * z * z) + 0.02;
        });
        const chosen = rng.pickWeighted(candidates.map((d, j) => ({ value: d, weight: wts[j] })));
        fixedTimeBuckets.push(chosen);
        available.delete(chosen);
      }
      // Sort descending: highest mileage gets place 1
      fixedTimeBuckets.sort((a, b) => b - a);
    }
    let bucketIdx = 0;

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
        if (isFixedTime) {
          // Fixed-time finisher: everyone runs the full duration; distance varies
          timeSecs = ev.durationSecs!;
          const baseMile = fixedTimeBuckets[bucketIdx++] ?? Math.round(ev.medianMiles! * 0.6);
          // Add fractional noise ±0.4 miles — stays within the integer bucket
          const noise = (rng.next() - 0.5) * 0.8;
          distanceMiles = parseFloat(Math.max(1, baseMile + noise).toFixed(2));
        } else {
          // Fixed-distance finisher: time varies
          const raw = rng.normal(ev.medianSecs, ev.timeStdSecs);
          timeSecs = Math.max(ev.medianSecs * 0.5, Math.min(ev.medianSecs * 2.0, Math.round(raw)));
        }
      } else if (finishStatus === 2) {
        if (isFixedTime) {
          // DNF in fixed-time: stopped early, ran partial distance
          const pct = 0.05 + rng.next() * 0.70;
          timeSecs = Math.round(ev.durationSecs! * pct);
          distanceMiles = parseFloat((ev.medianMiles! * pct * (0.7 + rng.next() * 0.5)).toFixed(2));
        } else {
          // DNF in fixed-distance: reports the event distance
          distanceMiles = ev.distanceMiles;
        }
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

    // Assign overall places: fixed-time → more distance = better; fixed-distance → faster = better
    const finishers = participants.filter(p => p.finishStatus === 1);
    if (isFixedTime) {
      finishers.sort((a, b) => b.distanceMiles - a.distanceMiles);
    } else {
      finishers.sort((a, b) => (a.timeSecs ?? 0) - (b.timeSecs ?? 0));
    }
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
