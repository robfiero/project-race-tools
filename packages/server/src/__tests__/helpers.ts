import type { ParticipantRecord, ResultRecord } from '../types.js';
import type { RawRow } from '../adapters/types.js';

// ─── UltraSignup CSV helpers ──────────────────────────────────────────────────

/** All columns present in a real UltraSignup export (PII included — adapter drops them). */
export const ULTRASIGNUP_HEADERS = [
  'Order ID', 'statement_id', 'ultrasignup_fee', 'distance',
  'Registration Date', 'order_type', 'Coupon', 'gender',
  'Identified Gender', 'Age', 'State', 'Country', 'Zip',
  'Removed', 'Bib', 'Captain', 'team_name', 'Price',
  'item_discount', 'Dropping from the Race', 'Refunds',
  // PII columns — present in the CSV but intentionally never read by the adapter
  'First Name', 'Last Name', 'DOB', 'Email',
  'Address', 'Phone', 'emergency_name', 'emergency_phone',
];

/** Minimal valid UltraSignup row — override any field for specific test cases. */
export function makeRow(overrides: Partial<RawRow> = {}): RawRow {
  return {
    'Order ID': '10001',
    'statement_id': 'S-001',
    'ultrasignup_fee': '5.00',
    'distance': '50 Mile',
    'Registration Date': '4/13/2026 6:01:23 PM',
    'order_type': 'Credit Card',
    'Coupon': '0',
    'gender': 'M',
    'Identified Gender': '',
    'Age': '35',
    'State': 'MA',
    'Country': 'USA',
    'Zip': '02101',
    'Removed': 'false',
    'Bib': '100',
    'Captain': 'no',
    'team_name': '',
    'Price': '150.00',
    'item_discount': '0.00',
    'Dropping from the Race': 'no',
    'Refunds': '',
    // PII (present in export, never used by adapter)
    'First Name': 'Jane',
    'Last Name': 'Doe',
    'DOB': '1990-01-15',
    'Email': 'jane@example.com',
    'Address': '1 Main St',
    'Phone': '555-0100',
    'emergency_name': 'John Doe',
    'emergency_phone': '555-0101',
    ...overrides,
  };
}

/** Build a CSV string from an array of rows using UltraSignup headers. */
export function buildCsv(rows: RawRow[], extraHeaders: string[] = []): string {
  const headers = [...ULTRASIGNUP_HEADERS, ...extraHeaders];
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => {
      const val = row[h] ?? '';
      // Wrap in quotes if value contains a comma
      return val.includes(',') ? `"${val}"` : val;
    }).join(','));
  }
  return lines.join('\n');
}

// ─── ParticipantRecord builder ────────────────────────────────────────────────

/** Minimal valid ParticipantRecord — override fields for specific test cases. */
export function makeParticipant(overrides: Partial<ParticipantRecord> = {}): ParticipantRecord {
  return {
    orderId: '10001',
    registrationDate: new Date('2026-04-13T22:01:23.000Z'), // 6:01 PM EDT
    event: '50 Mile',
    orderType: 'Credit Card',
    hasCoupon: false,
    gender: 'M',
    identifiedGender: '',
    age: 35,
    state: 'MA',
    country: 'USA',
    zipCode: '02101',
    removed: false,
    statementId: '44001',
    bib: '100',
    isTeamCaptain: false,
    teamName: '',
    isComped: false,
    isRelayJoin: false,
    droppingFromRace: false,
    refundStatus: '',
    ...overrides,
  };
}

/** Sequence of unique order IDs for multi-participant tests. */
export function makeParticipants(count: number, overrides: Partial<ParticipantRecord> = {}): ParticipantRecord[] {
  return Array.from({ length: count }, (_, i) =>
    makeParticipant({ orderId: String(10001 + i), ...overrides }),
  );
}

// ─── ResultRecord builder ─────────────────────────────────────────────────────

/** Minimal valid ResultRecord — a finisher at 50 miles in 4:30:00. */
export function makeResultRecord(overrides: Partial<ResultRecord> = {}): ResultRecord {
  return {
    bib: '100',
    age: 35,
    gender: 'M',
    city: 'Boston',
    state: 'MA',
    country: 'USA',
    distanceMiles: 50,
    timeSeconds: 16200, // 4:30:00
    finishStatus: 1,
    overallPlace: 1,
    divisionName: '',
    ...overrides,
  };
}

/** Build n ResultRecords with sequential bibs and shared overrides. */
export function makeResultRecords(count: number, overrides: Partial<ResultRecord> = {}): ResultRecord[] {
  return Array.from({ length: count }, (_, i) =>
    makeResultRecord({ bib: String(100 + i), ...overrides }),
  );
}
