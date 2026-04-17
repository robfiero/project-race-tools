import type { Adapter, RawRow } from './types.js';
import type { ParticipantRecord } from '../types.js';

// PII columns that are dropped and never stored
const PII_COLUMNS = new Set([
  'First Name', 'Last Name', 'DOB', 'Email',
  'Address', 'Phone', 'emergency_name', 'emergency_phone',
]);

// Cached formatter for DST verification — avoids constructing per-row.
const ET_HOUR_FMT = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric', hour12: false, timeZone: 'America/New_York',
});

// Parse "M/D/YYYY H:MM:SS AM/PM" (Eastern local time) into a proper UTC Date.
// We try EDT (UTC-4) then EST (UTC-5) and confirm the candidate with Intl so
// the result is always correct across DST boundaries.
function parseDate(s: string): Date {
  const match = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)/i
  );
  if (!match) return new Date(0);
  const [, mo, da, yr, h, mi, sec, ampm] = match;
  let hours = parseInt(h, 10);
  if (ampm.toUpperCase() === 'PM' && hours !== 12) hours += 12;
  if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;

  const pad = (n: number) => String(n).padStart(2, '0');
  const localStr =
    `${yr}-${pad(parseInt(mo, 10))}-${pad(parseInt(da, 10))}` +
    `T${pad(hours)}:${pad(parseInt(mi, 10))}:${pad(parseInt(sec, 10))}`;

  // EDT (UTC-4) covers mid-March → early November; try it first.
  for (const offset of ['-04:00', '-05:00']) {
    const candidate = new Date(localStr + offset);
    if (isNaN(candidate.getTime())) continue;
    const etHour = parseInt(ET_HOUR_FMT.format(candidate), 10) % 24;
    if (etHour === hours) return candidate;
  }

  // Fallback — should not be reached for well-formed UltraSignup exports.
  return new Date(Date.UTC(
    parseInt(yr, 10), parseInt(mo, 10) - 1, parseInt(da, 10),
    hours, parseInt(mi, 10), parseInt(sec, 10),
  ));
}

function parseNumber(s: string): number {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseAge(s: string): number | null {
  const n = parseInt(s, 10);
  if (isNaN(n) || n <= 0 || n > 120) return null;
  return n;
}

function parseGender(s: string): ParticipantRecord['gender'] {
  const v = s.trim().toUpperCase();
  if (v === 'M') return 'M';
  if (v === 'F') return 'F';
  if (v === 'NB' || v === 'N' || v === 'X') return 'NB';
  return 'Unknown';
}

function parseBoolean(s: string): boolean {
  return s.trim().toLowerCase() === 'true';
}

function cleanZip(zip: string, country: string): string {
  const z = zip.trim();
  // Only retain US zip codes (5 digits) for distance lookup
  if (country.trim().toUpperCase() === 'USA' && /^\d{5}/.test(z)) {
    return z.substring(0, 5);
  }
  return '';
}

function cleanCountry(s: string): string {
  const v = s.trim().toUpperCase();
  if (v === 'USA' || v === 'US') return 'USA';
  if (v === 'CAN' || v === 'CA') return 'CAN';
  return v || 'Unknown';
}

function cleanState(s: string): string {
  return s.trim().toUpperCase();
}

function isDroppingFromRace(s: string): boolean {
  return s.trim().toLowerCase().startsWith('dropping');
}

// A registration is comped when the item_discount equals the full price
// (i.e. the organizer waived the fee entirely). Partial discounts are not comps.
function isComped(priceStr: string, discountStr: string): boolean {
  const price = parseNumber(priceStr);
  const discount = parseNumber(discountStr);
  return price > 0 && discount >= price;
}

// A relay join is a comped non-captain in a relay event — the captain paid
// for the team slot and the other members joined free. This is a normal relay
// pricing model and is separated from genuine comps (RD/volunteer entries).
function isRelayJoin(
  comped: boolean,
  eventName: string,
  captainStr: string,
  teamNameStr: string,
): boolean {
  return (
    comped &&
    eventName.toLowerCase().includes('relay') &&
    captainStr.trim().toLowerCase() !== 'yes' &&
    teamNameStr.trim() !== ''
  );
}

export const ultraSignupAdapter: Adapter = {
  name: 'UltraSignup',

  detect(headers: string[]): boolean {
    // UltraSignup exports always include these sentinel columns
    const required = ['Order ID', 'statement_id', 'ultrasignup_fee', 'distance'];
    return required.every(col => headers.includes(col));
  },

  transform(row: RawRow): ParticipantRecord | null {
    // Skip rows that are clearly not participant records
    const orderId = row['Order ID']?.trim();
    if (!orderId || !/^\d+$/.test(orderId)) return null;

    // NOTE: All PII_COLUMNS fields are intentionally not read here.
    // They exist in the raw row but we never reference them.
    void PII_COLUMNS; // silence unused var lint

    const country = cleanCountry(row['Country'] ?? '');
    const state = cleanState(row['State'] ?? '');
    const zip = cleanZip(row['Zip'] ?? '', row['Country'] ?? '');

    const identifiedGender = row['Identified Gender']?.trim() ?? '';
    const parsedGender = parseGender(row['gender'] ?? '');
    // "Identified Gender" is UltraSignup's newer self-identification field.
    // An "x" here means the participant selected non-binary; it takes precedence.
    const gender: ParticipantRecord['gender'] =
      identifiedGender.toLowerCase() === 'x' ? 'NB' : parsedGender;

    return {
      orderId,
      registrationDate: parseDate(row['Registration Date'] ?? ''),
      event: row['distance']?.trim() ?? 'Unknown',
      orderType: row['order_type']?.trim() ?? '',
      hasCoupon: parseNumber(row['Coupon'] ?? '0') > 0,
      gender,
      identifiedGender,
      age: parseAge(row['Age'] ?? ''),
      state,
      country,
      zipCode: zip,
      removed: parseBoolean(row['Removed'] ?? 'false'),
      bib: row['Bib']?.trim() ?? '',
      isTeamCaptain: (row['Captain']?.trim().toLowerCase() === 'yes'),
      teamName: row['team_name']?.trim() ?? '',
      isComped: isComped(row['Price'] ?? '0', row['item_discount'] ?? '0'),
      isRelayJoin: isRelayJoin(
        isComped(row['Price'] ?? '0', row['item_discount'] ?? '0'),
        row['distance'] ?? '',
        row['Captain'] ?? '',
        row['team_name'] ?? '',
      ),
      droppingFromRace: isDroppingFromRace(row['Dropping from the Race'] ?? ''),
      refundStatus: row['Refunds']?.trim() ?? '',
    };
  },
};
