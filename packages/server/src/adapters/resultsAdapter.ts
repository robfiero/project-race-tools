import type { RawRow } from './types.js';
import type { ResultRecord, FinishStatus } from '../types.js';

// Normalize a single row's keys to lowercase for flexible column matching.
// Both official UltraSignup exports (lowercase) and website copy-paste (mixed case)
// are handled this way.
function normRow(row: RawRow): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.toLowerCase().trim()] = (v ?? '').trim();
  }
  return out;
}

function get(n: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (k in n) return n[k];
  }
  return '';
}

function parseTime(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const m = t.match(/^(\d+):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const total = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
  return total > 0 ? total : null;
}

function parseDistance(s: string): number | null {
  const n = parseFloat(s);
  if (isNaN(n) || n <= 0) return null;
  // Remove UltraSignup fractional sort hacks: .001/.002 etc. added for ordering
  const frac = n % 1;
  if (frac > 0 && frac < 0.01) return Math.floor(n);
  return n;
}

function parseAge(s: string): number | null {
  const n = parseInt(s, 10);
  if (isNaN(n) || n <= 0 || n > 120) return null;
  return n;
}

function parseGender(s: string): ResultRecord['gender'] {
  const v = s.toUpperCase();
  if (v === 'M' || v === 'MALE') return 'M';
  if (v === 'F' || v === 'FEMALE') return 'F';
  if (v === 'NB' || v === 'N' || v === 'X' || v === 'NON-BINARY') return 'NB';
  return 'Unknown';
}

function parsePlace(s: string): number | null {
  const n = parseInt(s, 10);
  return isNaN(n) || n <= 0 ? null : n;
}

function parseStatus(
  statusStr: string,
  timeSeconds: number | null,
  overallPlace: number | null,
): FinishStatus {
  const n = parseInt(statusStr, 10);
  if (n >= 1 && n <= 6) return n as FinishStatus;
  // Infer when finish_status column is missing (website copy-paste format)
  if (timeSeconds !== null && timeSeconds > 0) return 1;
  if (overallPlace !== null) return 1;
  return 2; // default to DNF
}

function cleanCountry(s: string): string {
  const v = s.trim().toUpperCase();
  if (!v) return 'Unknown';
  if (v === 'USA' || v === 'US' || v === 'UNITED STATES' || v === 'UNITED STATES OF AMERICA' || v === 'U.S.' || v === 'U.S.A.') return 'USA';
  if (v === 'CAN' || v === 'CA' || v === 'CANADA') return 'CAN';
  if (v === 'GBR' || v === 'UK' || v === 'UNITED KINGDOM' || v === 'GREAT BRITAIN') return 'GBR';
  if (v === 'AUS' || v === 'AUSTRALIA') return 'AUS';
  if (v === 'NZL' || v === 'NEW ZEALAND') return 'NZL';
  return v;
}

export interface ResultsDetector {
  name: string;
  detect(headers: string[]): boolean;
  transform(row: RawRow): ResultRecord | null;
}

export const ultraSignupResultsAdapter: ResultsDetector = {
  name: 'UltraSignup Results',

  detect(headers: string[]): boolean {
    const lower = new Set(headers.map(h => h.toLowerCase().trim()));
    // Registration files have these; results files don't
    if (lower.has('order id') || lower.has('statement_id')) return false;
    // Results files always have place + (time or distance)
    return lower.has('place') && (lower.has('time') || lower.has('distance'));
  },

  transform(row: RawRow): ResultRecord | null {
    const n = normRow(row);

    const bib = get(n, 'bib');
    const place = get(n, 'place');

    // Skip completely blank rows
    if (!bib && !place) return null;

    const timeStr = get(n, 'time');
    const distStr = get(n, 'distance');
    const statusStr = get(n, 'finish_status', 'finish status', 'status');

    const timeSeconds = parseTime(timeStr);
    const distanceMiles = parseDistance(distStr);
    const overallPlace = parsePlace(place);

    const finishStatus = parseStatus(statusStr, timeSeconds, overallPlace);

    const genderStr = get(n, 'gender');
    const divisionStr = get(n, 'division', 'div');
    // Some UltraSignup exports use "Division" as the column header for gender values.
    // If the division column contains a gender code and no gender column is present,
    // treat it as gender and leave divisionName empty.
    const divIsGender = !genderStr && /^(m|f|male|female|nb|non-binary|x)$/i.test(divisionStr.trim());

    return {
      bib,
      age: parseAge(get(n, 'age')),
      gender: parseGender(divIsGender ? divisionStr : genderStr),
      city: get(n, 'city'),
      state: get(n, 'state').toUpperCase(),
      country: cleanCountry(get(n, 'country')),
      distanceMiles,
      timeSeconds,
      finishStatus,
      overallPlace,
      divisionName: divIsGender ? '' : divisionStr,
    };
  },
};
