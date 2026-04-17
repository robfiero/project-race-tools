import { describe, it, expect } from 'vitest';
import { ultraSignupAdapter } from '../../adapters/ultrasignup.js';
import { ULTRASIGNUP_HEADERS, makeRow } from '../helpers.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function transform(overrides = {}) {
  return ultraSignupAdapter.transform(makeRow(overrides));
}

// Assert a Date is within 1 second of the expected UTC ISO string
function expectDate(date: Date, isoUtc: string) {
  expect(Math.abs(date.getTime() - new Date(isoUtc).getTime())).toBeLessThan(1000);
}

// ─── detect() ────────────────────────────────────────────────────────────────

describe('ultraSignupAdapter.detect', () => {
  it('returns true for the canonical UltraSignup header set', () => {
    expect(ultraSignupAdapter.detect(ULTRASIGNUP_HEADERS)).toBe(true);
  });

  it('returns true when extra columns are present beyond the required sentinel set', () => {
    expect(ultraSignupAdapter.detect([...ULTRASIGNUP_HEADERS, 'Some Extra Column'])).toBe(true);
  });

  it('returns false when any sentinel column is missing', () => {
    const sentinels = ['Order ID', 'statement_id', 'ultrasignup_fee', 'distance'];
    for (const sentinel of sentinels) {
      const headers = ULTRASIGNUP_HEADERS.filter(h => h !== sentinel);
      expect(ultraSignupAdapter.detect(headers)).toBe(false);
    }
  });

  it('returns false for an empty header array', () => {
    expect(ultraSignupAdapter.detect([])).toBe(false);
  });

  it('returns false for completely unrelated headers', () => {
    expect(ultraSignupAdapter.detect(['Name', 'Email', 'Phone', 'City'])).toBe(false);
  });

  it('is case-sensitive: rejects lowercase sentinel names', () => {
    const headers = ULTRASIGNUP_HEADERS.map(h => h.toLowerCase());
    expect(ultraSignupAdapter.detect(headers)).toBe(false);
  });
});

// ─── transform() — row filtering ─────────────────────────────────────────────

describe('ultraSignupAdapter.transform — row filtering', () => {
  it('returns a record for a valid row', () => {
    expect(transform()).not.toBeNull();
  });

  it('returns null when Order ID is missing', () => {
    expect(transform({ 'Order ID': '' })).toBeNull();
  });

  it('returns null when Order ID is not numeric', () => {
    expect(transform({ 'Order ID': 'COMP-001' })).toBeNull();
    expect(transform({ 'Order ID': 'abc' })).toBeNull();
    expect(transform({ 'Order ID': '  ' })).toBeNull();
  });

  it('returns null when Order ID is a float string', () => {
    expect(transform({ 'Order ID': '123.45' })).toBeNull();
  });

  it('accepts Order ID that is a valid integer string', () => {
    expect(transform({ 'Order ID': '99999' })).not.toBeNull();
  });
});

// ─── transform() — date parsing (via registrationDate) ───────────────────────

describe('ultraSignupAdapter.transform — date parsing (Eastern → UTC)', () => {
  it('parses a summer (EDT, UTC-4) timestamp correctly', () => {
    // 6:01:23 PM EDT = 22:01:23 UTC same day
    const record = transform({ 'Registration Date': '4/13/2026 6:01:23 PM' })!;
    expectDate(record.registrationDate, '2026-04-13T22:01:23Z');
  });

  it('parses a winter (EST, UTC-5) timestamp correctly', () => {
    // 8:30:00 AM EST = 13:30:00 UTC same day
    const record = transform({ 'Registration Date': '1/15/2026 8:30:00 AM' })!;
    expectDate(record.registrationDate, '2026-01-15T13:30:00Z');
  });

  it('parses 12:00 AM (midnight) correctly — 12 AM means hour 0', () => {
    // 12:00:00 AM EDT = 04:00:00 UTC
    const record = transform({ 'Registration Date': '6/1/2026 12:00:00 AM' })!;
    expectDate(record.registrationDate, '2026-06-01T04:00:00Z');
  });

  it('parses 12:00 PM (noon) correctly — 12 PM means hour 12', () => {
    // 12:00:00 PM EDT = 16:00:00 UTC
    const record = transform({ 'Registration Date': '6/1/2026 12:00:00 PM' })!;
    expectDate(record.registrationDate, '2026-06-01T16:00:00Z');
  });

  it('parses 11:59 PM correctly', () => {
    // 11:59:00 PM EDT = 03:59:00 UTC next day
    const record = transform({ 'Registration Date': '7/4/2026 11:59:00 PM' })!;
    expectDate(record.registrationDate, '2026-07-05T03:59:00Z');
  });

  it('returns epoch (new Date(0)) for an empty date string', () => {
    const record = transform({ 'Registration Date': '' })!;
    expect(record.registrationDate.getTime()).toBe(0);
  });

  it('returns epoch for a completely malformed date string', () => {
    const record = transform({ 'Registration Date': 'not-a-date' })!;
    expect(record.registrationDate.getTime()).toBe(0);
  });

  it('handles single-digit month and day', () => {
    // 1/5/2026 = January 5 (EST, UTC-5)
    const record = transform({ 'Registration Date': '1/5/2026 9:00:00 AM' })!;
    expectDate(record.registrationDate, '2026-01-05T14:00:00Z');
  });
});

// ─── transform() — gender parsing ────────────────────────────────────────────

describe('ultraSignupAdapter.transform — gender', () => {
  it('maps "M" to M', () => expect(transform({ gender: 'M' })!.gender).toBe('M'));
  it('maps "F" to F', () => expect(transform({ gender: 'F' })!.gender).toBe('F'));
  it('maps "NB" to NB', () => expect(transform({ gender: 'NB' })!.gender).toBe('NB'));
  it('maps "N" to NB', () => expect(transform({ gender: 'N' })!.gender).toBe('NB'));
  it('maps "X" to NB', () => expect(transform({ gender: 'X' })!.gender).toBe('NB'));
  it('maps blank to Unknown', () => expect(transform({ gender: '' })!.gender).toBe('Unknown'));
  it('maps an unrecognized value to Unknown', () => expect(transform({ gender: 'Other' })!.gender).toBe('Unknown'));
  it('is case-insensitive for M/F (lowercase)', () => {
    expect(transform({ gender: 'm' })!.gender).toBe('M');
    expect(transform({ gender: 'f' })!.gender).toBe('F');
  });
  it('maps "x" in Identified Gender column to NB (newer UltraSignup non-binary field)', () => {
    expect(transform({ 'Identified Gender': 'x' })!.gender).toBe('NB');
    expect(transform({ 'Identified Gender': 'X' })!.gender).toBe('NB');
  });
  it('Identified Gender "x" takes precedence over gender column', () => {
    // Some exports may have an empty or binary gender column alongside a newer x field
    expect(transform({ gender: '', 'Identified Gender': 'x' })!.gender).toBe('NB');
    expect(transform({ gender: 'M', 'Identified Gender': 'x' })!.gender).toBe('NB');
  });
  it('non-x Identified Gender values do not override the gender column', () => {
    expect(transform({ gender: 'F', 'Identified Gender': 'Female' })!.gender).toBe('F');
    expect(transform({ gender: 'M', 'Identified Gender': '' })!.gender).toBe('M');
  });
});

// ─── transform() — age parsing ───────────────────────────────────────────────

describe('ultraSignupAdapter.transform — age', () => {
  it('parses a valid numeric age', () => expect(transform({ Age: '28' })!.age).toBe(28));
  it('parses the boundary age 1', () => expect(transform({ Age: '1' })!.age).toBe(1));
  it('parses the boundary age 120', () => expect(transform({ Age: '120' })!.age).toBe(120));
  it('returns null for age 0 (invalid)', () => expect(transform({ Age: '0' })!.age).toBeNull());
  it('returns null for age > 120 (invalid)', () => expect(transform({ Age: '121' })!.age).toBeNull());
  it('returns null for a blank age field', () => expect(transform({ Age: '' })!.age).toBeNull());
  it('returns null for a non-numeric age string', () => expect(transform({ Age: 'N/A' })!.age).toBeNull());
  it('returns null for negative age', () => expect(transform({ Age: '-5' })!.age).toBeNull());
});

// ─── transform() — coupon ────────────────────────────────────────────────────

describe('ultraSignupAdapter.transform — coupon', () => {
  it('hasCoupon is false when Coupon is "0"', () => expect(transform({ Coupon: '0' })!.hasCoupon).toBe(false));
  it('hasCoupon is true when Coupon is a non-zero number', () => expect(transform({ Coupon: '10' })!.hasCoupon).toBe(true));
  it('hasCoupon is false for blank Coupon', () => expect(transform({ Coupon: '' })!.hasCoupon).toBe(false));
});

// ─── transform() — country / state / zip cleaning ────────────────────────────

describe('ultraSignupAdapter.transform — location fields', () => {
  it('normalizes USA country', () => expect(transform({ Country: 'USA' })!.country).toBe('USA'));
  it('normalizes "US" to "USA"', () => expect(transform({ Country: 'US' })!.country).toBe('USA'));
  it('normalizes "CAN" to "CAN"', () => expect(transform({ Country: 'CAN' })!.country).toBe('CAN'));
  it('normalizes "CA" (Canada) to "CAN"', () => expect(transform({ Country: 'CA' })!.country).toBe('CAN'));
  it('uppercases state code', () => expect(transform({ State: 'ma' })!.state).toBe('MA'));
  it('retains US zip code (5-digit)', () => expect(transform({ Zip: '02134', Country: 'USA' })!.zipCode).toBe('02134'));
  it('trims zip to first 5 digits when longer', () => expect(transform({ Zip: '021340000', Country: 'USA' })!.zipCode).toBe('02134'));
  it('drops zip for non-US participants', () => expect(transform({ Zip: 'M5V3A8', Country: 'CAN' })!.zipCode).toBe(''));
  it('drops zip when not 5-digit numeric for USA', () => expect(transform({ Zip: 'ABCDE', Country: 'USA' })!.zipCode).toBe(''));
  it('returns empty zipCode for blank Zip field', () => expect(transform({ Zip: '' })!.zipCode).toBe(''));
});

// ─── transform() — isComped ───────────────────────────────────────────────────

describe('ultraSignupAdapter.transform — isComped', () => {
  it('is false when price is 0 (no fee charged)', () => {
    expect(transform({ Price: '0', item_discount: '0' })!.isComped).toBe(false);
  });

  it('is true when discount exactly equals price (full comp)', () => {
    expect(transform({ Price: '150.00', item_discount: '150.00' })!.isComped).toBe(true);
  });

  it('is true when discount exceeds price', () => {
    expect(transform({ Price: '50.00', item_discount: '60.00' })!.isComped).toBe(true);
  });

  it('is false for a partial discount (discount < price)', () => {
    expect(transform({ Price: '150.00', item_discount: '50.00' })!.isComped).toBe(false);
  });

  it('is false when discount is 0', () => {
    expect(transform({ Price: '150.00', item_discount: '0.00' })!.isComped).toBe(false);
  });
});

// ─── transform() — isRelayJoin ────────────────────────────────────────────────

describe('ultraSignupAdapter.transform — isRelayJoin', () => {
  const relayComped = {
    Price: '0', item_discount: '0', // not comped — no relay join possible
  };
  const relayCompedRow = {
    Price: '100.00', item_discount: '100.00', // comped
    distance: '12 Mile Relay',
    Captain: 'no',
    team_name: 'Team Alpha',
  };

  it('is true for a comped non-captain on a relay event with a team', () => {
    expect(transform(relayCompedRow)!.isRelayJoin).toBe(true);
  });

  it('is false when the participant is the team captain', () => {
    expect(transform({ ...relayCompedRow, Captain: 'yes' })!.isRelayJoin).toBe(false);
  });

  it('is false when there is no team name', () => {
    expect(transform({ ...relayCompedRow, team_name: '' })!.isRelayJoin).toBe(false);
  });

  it('is false when the event is not a relay', () => {
    expect(transform({ ...relayCompedRow, distance: '50 Mile' })!.isRelayJoin).toBe(false);
  });

  it('is false when the participant is not comped', () => {
    expect(transform({ ...relayCompedRow, Price: '100.00', item_discount: '0.00' })!.isRelayJoin).toBe(false);
  });

  it('matches "relay" case-insensitively in event name', () => {
    expect(transform({ ...relayCompedRow, distance: '12 Mile RELAY' })!.isRelayJoin).toBe(true);
    expect(transform({ ...relayCompedRow, distance: 'Relay Race' })!.isRelayJoin).toBe(true);
  });
});

// ─── transform() — droppingFromRace ──────────────────────────────────────────

describe('ultraSignupAdapter.transform — droppingFromRace', () => {
  it('is false for a normal row', () => {
    expect(transform()!.droppingFromRace).toBe(false);
  });

  it('is true when field starts with "Dropping"', () => {
    expect(transform({ 'Dropping from the Race': 'Dropping from the race' })!.droppingFromRace).toBe(true);
  });

  it('is true when field starts with "dropping" (lowercase)', () => {
    expect(transform({ 'Dropping from the Race': 'dropping' })!.droppingFromRace).toBe(true);
  });

  it('is false for an empty field', () => {
    expect(transform({ 'Dropping from the Race': '' })!.droppingFromRace).toBe(false);
  });

  it('is false when field is "no"', () => {
    expect(transform({ 'Dropping from the Race': 'no' })!.droppingFromRace).toBe(false);
  });
});

// ─── transform() — removed / bib / teamCaptain ───────────────────────────────

describe('ultraSignupAdapter.transform — removed / bib / teamCaptain', () => {
  it('parses removed: false', () => expect(transform({ Removed: 'false' })!.removed).toBe(false));
  it('parses removed: true', () => expect(transform({ Removed: 'true' })!.removed).toBe(true));
  it('retains bib number', () => expect(transform({ Bib: '42' })!.bib).toBe('42'));
  it('isTeamCaptain is true when Captain is "yes"', () => expect(transform({ Captain: 'yes' })!.isTeamCaptain).toBe(true));
  it('isTeamCaptain is false when Captain is "no"', () => expect(transform({ Captain: 'no' })!.isTeamCaptain).toBe(false));
  it('isTeamCaptain is false when Captain is blank', () => expect(transform({ Captain: '' })!.isTeamCaptain).toBe(false));
});

// ─── transform() — PII is never present on the output record ─────────────────

describe('ultraSignupAdapter.transform — PII exclusion', () => {
  it('does not expose First Name on the output record', () => {
    const record = transform({ 'First Name': 'Alice' })! as unknown as Record<string, unknown>;
    expect(record['First Name']).toBeUndefined();
    expect(record['firstName']).toBeUndefined();
  });

  it('does not expose Email on the output record', () => {
    const record = transform({ Email: 'alice@example.com' })! as unknown as Record<string, unknown>;
    expect(record['Email']).toBeUndefined();
    expect(record['email']).toBeUndefined();
  });

  it('does not expose DOB on the output record', () => {
    const record = transform({ DOB: '1990-01-15' })! as unknown as Record<string, unknown>;
    expect(record['DOB']).toBeUndefined();
    expect(record['dob']).toBeUndefined();
  });
});
