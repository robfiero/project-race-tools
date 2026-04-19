import { describe, it, expect } from 'vitest';
import { ultraSignupResultsAdapter } from '../../adapters/resultsAdapter.js';
import type { RawRow } from '../../adapters/types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal valid UltraSignup results row (not registration). */
function makeResultsRow(overrides: Partial<RawRow> = {}): RawRow {
  return {
    place: '1',
    bib: '101',
    first: 'Alice',
    last: 'Smith',
    age: '32',
    gender: 'F',
    city: 'Boston',
    state: 'MA',
    country: 'USA',
    division: 'F30-39',
    time: '4:30:00',
    distance: '50',
    finish_status: '1',
    ...overrides,
  };
}

function transform(overrides: Partial<RawRow> = {}) {
  return ultraSignupResultsAdapter.transform(makeResultsRow(overrides));
}

// ─── detect() ─────────────────────────────────────────────────────────────────

describe('ultraSignupResultsAdapter.detect', () => {
  it('returns true when place + time are present', () => {
    expect(ultraSignupResultsAdapter.detect(['place', 'bib', 'time', 'gender'])).toBe(true);
  });

  it('returns true when place + distance are present (no time)', () => {
    expect(ultraSignupResultsAdapter.detect(['place', 'bib', 'distance', 'gender'])).toBe(true);
  });

  it('returns true when headers are mixed case', () => {
    expect(ultraSignupResultsAdapter.detect(['Place', 'Bib', 'Time', 'Gender'])).toBe(true);
  });

  it('returns true when both time and distance are present', () => {
    expect(ultraSignupResultsAdapter.detect(['place', 'time', 'distance'])).toBe(true);
  });

  it('returns false when place is missing', () => {
    expect(ultraSignupResultsAdapter.detect(['bib', 'time', 'gender'])).toBe(false);
  });

  it('returns false when neither time nor distance is present', () => {
    expect(ultraSignupResultsAdapter.detect(['place', 'bib', 'gender', 'age'])).toBe(false);
  });

  it('returns false when registration sentinel "order id" is present', () => {
    expect(ultraSignupResultsAdapter.detect(['order id', 'place', 'time'])).toBe(false);
  });

  it('returns false when registration sentinel "statement_id" is present', () => {
    expect(ultraSignupResultsAdapter.detect(['statement_id', 'place', 'time'])).toBe(false);
  });

  it('returns false for an empty header list', () => {
    expect(ultraSignupResultsAdapter.detect([])).toBe(false);
  });

  it('returns false for completely unrelated headers', () => {
    expect(ultraSignupResultsAdapter.detect(['Name', 'Email', 'Phone', 'Notes'])).toBe(false);
  });

  it('strips whitespace from headers before matching', () => {
    expect(ultraSignupResultsAdapter.detect([' place ', ' time '])).toBe(true);
  });
});

// ─── transform() — row filtering ──────────────────────────────────────────────

describe('ultraSignupResultsAdapter.transform — row filtering', () => {
  it('returns a record for a valid row', () => {
    expect(transform()).not.toBeNull();
  });

  it('returns null when both bib and place are blank (completely empty row)', () => {
    expect(transform({ bib: '', place: '' })).toBeNull();
  });

  it('returns a record when bib is present but place is blank', () => {
    expect(transform({ place: '' })).not.toBeNull();
  });

  it('returns a record when place is present but bib is blank', () => {
    expect(transform({ bib: '' })).not.toBeNull();
  });

  it('stores the bib value on the returned record', () => {
    expect(transform({ bib: '999' })?.bib).toBe('999');
  });
});

// ─── transform() — time parsing ───────────────────────────────────────────────

describe('ultraSignupResultsAdapter.transform — time parsing', () => {
  it('parses a standard h:mm:ss time', () => {
    expect(transform({ time: '4:30:00' })?.timeSeconds).toBe(4 * 3600 + 30 * 60);
  });

  it('parses multi-digit hour (ultra-distance events)', () => {
    expect(transform({ time: '26:01:30' })?.timeSeconds).toBe(26 * 3600 + 60 + 30);
  });

  it('parses a minimum non-zero time of 0:00:01', () => {
    expect(transform({ time: '0:00:01' })?.timeSeconds).toBe(1);
  });

  it('returns null for a zero time 0:00:00', () => {
    expect(transform({ time: '0:00:00' })?.timeSeconds).toBeNull();
  });

  it('returns null for an empty time string', () => {
    expect(transform({ time: '' })?.timeSeconds).toBeNull();
  });

  it('returns null for a partial h:mm format', () => {
    expect(transform({ time: '4:30' })?.timeSeconds).toBeNull();
  });

  it('returns null for a non-numeric string', () => {
    expect(transform({ time: 'DNF' })?.timeSeconds).toBeNull();
  });

  it('returns null for a decimal time string', () => {
    expect(transform({ time: '4.5' })?.timeSeconds).toBeNull();
  });

  it('handles leading and trailing whitespace in time', () => {
    expect(transform({ time: '  4:30:00  ' })?.timeSeconds).toBe(4 * 3600 + 30 * 60);
  });

  it('parses maximum plausible ultra time (100+ hours)', () => {
    expect(transform({ time: '100:00:00' })?.timeSeconds).toBe(100 * 3600);
  });
});

// ─── transform() — distance parsing ───────────────────────────────────────────

describe('ultraSignupResultsAdapter.transform — distance parsing', () => {
  it('parses an integer distance', () => {
    expect(transform({ distance: '50' })?.distanceMiles).toBe(50);
  });

  it('parses a legitimate decimal distance like 26.2', () => {
    expect(transform({ distance: '26.2' })?.distanceMiles).toBe(26.2);
  });

  it('strips UltraSignup sort-hack .001 suffix', () => {
    expect(transform({ distance: '50.001' })?.distanceMiles).toBe(50);
  });

  it('strips UltraSignup sort-hack .002 suffix', () => {
    expect(transform({ distance: '50.002' })?.distanceMiles).toBe(50);
  });

  it('strips UltraSignup sort-hack .009 suffix (still < 0.01)', () => {
    expect(transform({ distance: '50.009' })?.distanceMiles).toBe(50);
  });

  it('preserves a fraction of 0.1 (not a sort hack)', () => {
    // 50.1 % 1 = 0.1, which is ≥ 0.01, so it is kept as-is
    expect(transform({ distance: '50.1' })?.distanceMiles).toBe(50.1);
  });

  it('strips 50.01 because floating-point 50.01 % 1 ≈ 0.0099 (< 0.01 threshold)', () => {
    // IEEE-754: 50.01 % 1 = 0.009999... which falls inside the hack-suffix range
    expect(transform({ distance: '50.01' })?.distanceMiles).toBe(50);
  });

  it('returns null for zero distance', () => {
    expect(transform({ distance: '0' })?.distanceMiles).toBeNull();
  });

  it('returns null for a negative distance', () => {
    expect(transform({ distance: '-10' })?.distanceMiles).toBeNull();
  });

  it('returns null for a non-numeric string', () => {
    expect(transform({ distance: 'N/A' })?.distanceMiles).toBeNull();
  });

  it('returns null for an empty distance', () => {
    expect(transform({ distance: '' })?.distanceMiles).toBeNull();
  });

  it('accepts large distances (200+ mile events)', () => {
    expect(transform({ distance: '200' })?.distanceMiles).toBe(200);
  });
});

// ─── transform() — age parsing ────────────────────────────────────────────────

describe('ultraSignupResultsAdapter.transform — age parsing', () => {
  it('parses a typical adult age', () => {
    expect(transform({ age: '35' })?.age).toBe(35);
  });

  it('accepts minimum valid age of 1', () => {
    expect(transform({ age: '1' })?.age).toBe(1);
  });

  it('accepts boundary age of 120', () => {
    expect(transform({ age: '120' })?.age).toBe(120);
  });

  it('returns null for age 0', () => {
    expect(transform({ age: '0' })?.age).toBeNull();
  });

  it('returns null for a negative age', () => {
    expect(transform({ age: '-5' })?.age).toBeNull();
  });

  it('returns null for age above 120 (data entry error)', () => {
    expect(transform({ age: '121' })?.age).toBeNull();
  });

  it('returns null for an extreme age like 999', () => {
    expect(transform({ age: '999' })?.age).toBeNull();
  });

  it('returns null for a non-numeric age string', () => {
    expect(transform({ age: 'thirty' })?.age).toBeNull();
  });

  it('returns null for an empty age', () => {
    expect(transform({ age: '' })?.age).toBeNull();
  });

  it('truncates decimal ages to integer (parseInt behavior)', () => {
    expect(transform({ age: '35.9' })?.age).toBe(35);
  });
});

// ─── transform() — gender parsing ─────────────────────────────────────────────

describe('ultraSignupResultsAdapter.transform — gender parsing', () => {
  it.each([
    ['M',          'M'],
    ['MALE',       'M'],
    ['male',       'M'],
    ['Male',       'M'],
    ['F',          'F'],
    ['FEMALE',     'F'],
    ['female',     'F'],
    ['Female',     'F'],
    ['NB',         'NB'],
    ['N',          'NB'],
    ['X',          'NB'],
    ['NON-BINARY', 'NB'],
    ['non-binary', 'NB'],
    ['Other',      'Unknown'],
    ['Z',          'Unknown'],
    ['',           'Unknown'],
  ])('maps %s → %s', (input, expected) => {
    expect(transform({ gender: input })?.gender).toBe(expected);
  });
});

// ─── transform() — Division → Gender fallback ──────────────────────────────────

describe('ultraSignupResultsAdapter.transform — division→gender fallback', () => {
  function noGender(division: string, extra: Partial<RawRow> = {}) {
    return transform({ gender: '', division, ...extra });
  }

  it('uses division column as gender when gender is absent and value is M', () => {
    expect(noGender('M')?.gender).toBe('M');
  });

  it('uses division column as gender when gender is absent and value is F', () => {
    expect(noGender('F')?.gender).toBe('F');
  });

  it('uses division column as gender for NB', () => {
    expect(noGender('NB')?.gender).toBe('NB');
  });

  it('uses division column as gender for X (non-binary indicator)', () => {
    expect(noGender('X')?.gender).toBe('NB');
  });

  it('uses division column as gender for full word "male" (case-insensitive)', () => {
    expect(noGender('male')?.gender).toBe('M');
  });

  it('uses division column as gender for "female"', () => {
    expect(noGender('female')?.gender).toBe('F');
  });

  it('uses division column as gender for "non-binary"', () => {
    expect(noGender('non-binary')?.gender).toBe('NB');
  });

  it('leaves divisionName empty when division was treated as gender', () => {
    expect(noGender('M')?.divisionName).toBe('');
  });

  it('does NOT use division as gender when gender column is present', () => {
    expect(transform({ gender: 'F', division: 'M' })?.gender).toBe('F');
  });

  it('does NOT treat a real division category like F30-39 as gender', () => {
    expect(noGender('F30-39')?.gender).toBe('Unknown');
    expect(noGender('F30-39')?.divisionName).toBe('F30-39');
  });

  it('does NOT treat AG or other division codes as gender', () => {
    expect(noGender('M40-49')?.gender).toBe('Unknown');
    expect(noGender('M40-49')?.divisionName).toBe('M40-49');
  });

  it('preserves divisionName when gender column is present', () => {
    expect(transform({ gender: 'F', division: 'F30-39' })?.divisionName).toBe('F30-39');
  });
});

// ─── transform() — finish status parsing ──────────────────────────────────────

describe('ultraSignupResultsAdapter.transform — finish status', () => {
  it.each([
    ['1', 1],
    ['2', 2],
    ['3', 3],
    ['4', 4],
    ['5', 5],
    ['6', 6],
  ])('parses explicit status %s → %i', (statusStr, expected) => {
    expect(transform({ finish_status: statusStr })?.finishStatus).toBe(expected);
  });

  it('infers Finished (1) from time when status is absent', () => {
    expect(transform({ finish_status: '', time: '4:30:00' })?.finishStatus).toBe(1);
  });

  it('infers Finished (1) from overallPlace when status and time are absent', () => {
    expect(transform({ finish_status: '', time: '', place: '12' })?.finishStatus).toBe(1);
  });

  it('defaults to DNF (2) when status, time, and place are all absent', () => {
    expect(transform({ finish_status: '', time: '', place: '' })?.finishStatus).toBe(2);
  });

  it('falls back to inference for out-of-range status (7)', () => {
    // Out of range, time present → infers Finished
    expect(transform({ finish_status: '7', time: '4:30:00' })?.finishStatus).toBe(1);
  });

  it('falls back to inference for out-of-range status (0)', () => {
    // 0 is out of range, no time/place → defaults to DNF
    expect(transform({ finish_status: '0', time: '', place: '' })?.finishStatus).toBe(2);
  });

  it('falls back to inference for non-numeric status string', () => {
    expect(transform({ finish_status: 'DNF', time: '', place: '' })?.finishStatus).toBe(2);
  });

  it('reads finish_status via alternate column header "finish status" (with space)', () => {
    const row = makeResultsRow({ time: '' });
    delete (row as Record<string, string>)['finish_status'];
    (row as Record<string, string>)['finish status'] = '3';
    expect(ultraSignupResultsAdapter.transform(row)?.finishStatus).toBe(3);
  });
});

// ─── transform() — country and state normalization ────────────────────────────

describe('ultraSignupResultsAdapter.transform — country and state', () => {
  it.each([
    ['USA', 'USA'],
    ['usa', 'USA'],
    ['US',  'USA'],
    ['CAN', 'CAN'],
    ['CA',  'CAN'],
    ['GBR', 'GBR'],
    ['AUS', 'AUS'],
  ])('normalizes country "%s" → "%s"', (input, expected) => {
    expect(transform({ country: input })?.country).toBe(expected);
  });

  it('returns Unknown for an empty country', () => {
    expect(transform({ country: '' })?.country).toBe('Unknown');
  });

  it('uppercases the state field', () => {
    expect(transform({ state: 'ma' })?.state).toBe('MA');
  });

  it('trims whitespace from the state field', () => {
    expect(transform({ state: ' NH ' })?.state).toBe('NH');
  });
});

// ─── transform() — place parsing ──────────────────────────────────────────────

describe('ultraSignupResultsAdapter.transform — place / overallPlace', () => {
  it('parses a valid place', () => {
    expect(transform({ place: '42' })?.overallPlace).toBe(42);
  });

  it('returns null for place 0', () => {
    expect(transform({ place: '0' })?.overallPlace).toBeNull();
  });

  it('returns null for a negative place', () => {
    expect(transform({ place: '-1' })?.overallPlace).toBeNull();
  });

  it('returns null for a non-numeric place string', () => {
    expect(transform({ place: 'DNF' })?.overallPlace).toBeNull();
  });

  it('returns null for an empty place', () => {
    expect(transform({ place: '' })?.overallPlace).toBeNull();
  });
});

// ─── transform() — header case-insensitivity ──────────────────────────────────

describe('ultraSignupResultsAdapter.transform — header normalization', () => {
  it('matches column names regardless of case (e.g. Gender, AGE, STATE)', () => {
    const row: RawRow = {
      'Place': '1',
      'Bib': '200',
      'Age': '28',
      'Gender': 'M',
      'State': 'VT',
      'Country': 'USA',
      'Time': '3:45:00',
      'Distance': '50',
      'Finish_Status': '1',
    };
    const result = ultraSignupResultsAdapter.transform(row);
    expect(result).not.toBeNull();
    expect(result?.age).toBe(28);
    expect(result?.gender).toBe('M');
    expect(result?.state).toBe('VT');
    expect(result?.timeSeconds).toBe(3 * 3600 + 45 * 60);
  });

  it('handles all-uppercase headers', () => {
    const row: RawRow = {
      'PLACE': '3',
      'BIB': '300',
      'GENDER': 'F',
      'TIME': '5:00:00',
    };
    const result = ultraSignupResultsAdapter.transform(row);
    expect(result?.gender).toBe('F');
    expect(result?.timeSeconds).toBe(5 * 3600);
  });
});

// ─── transform() — security / injection resistance ────────────────────────────

describe('ultraSignupResultsAdapter.transform — special character safety', () => {
  it('does not throw on XSS-like content in bib', () => {
    expect(() => transform({ bib: '<script>alert(1)</script>' })).not.toThrow();
  });

  it('does not throw on SQL-injection-like content in city', () => {
    expect(() => transform({ city: "'; DROP TABLE results; --" })).not.toThrow();
  });

  it('does not throw on very long string values', () => {
    expect(() => transform({ city: 'A'.repeat(10000) })).not.toThrow();
  });

  it('does not throw on unicode content', () => {
    expect(() => transform({ city: '北京市', state: 'BJ', country: 'CHN' })).not.toThrow();
  });

  it('does not throw on null-byte-like characters in strings', () => {
    expect(() => transform({ bib: '\x00\x01\x02' })).not.toThrow();
  });
});
