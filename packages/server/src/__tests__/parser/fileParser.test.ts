import { describe, it, expect } from 'vitest';
import { parseFile, ParseError } from '../../parser/fileParser.js';
import { makeRow, buildCsv, ULTRASIGNUP_HEADERS } from '../helpers.js';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;

// Minimal valid 1-participant CSV
function validCsv() {
  return buildCsv([makeRow()]);
}
function validBuf() {
  const csv = validCsv();
  return { buffer: Buffer.from(csv), size: Buffer.byteLength(csv) };
}

// ─── File size limit ──────────────────────────────────────────────────────────

describe('parseFile — file size limit', () => {
  it('throws ParseError when reported fileSizeBytes exceeds 5 MB', async () => {
    const { buffer } = validBuf();
    await expect(parseFile(buffer, 'test.csv', MAX_BYTES + 1))
      .rejects.toThrow(ParseError);
  });

  it('error message mentions the 5 MB limit', async () => {
    const { buffer } = validBuf();
    await expect(parseFile(buffer, 'test.csv', MAX_BYTES + 1))
      .rejects.toThrow(/5 MB/i);
  });

  it('accepts a file exactly at the limit', async () => {
    const { buffer } = validBuf();
    await expect(parseFile(buffer, 'test.csv', MAX_BYTES)).resolves.toBeDefined();
  });

  it('accepts a file 1 byte under the limit', async () => {
    const { buffer } = validBuf();
    await expect(parseFile(buffer, 'test.csv', MAX_BYTES - 1)).resolves.toBeDefined();
  });
});

// ─── Row count limit ──────────────────────────────────────────────────────────

describe('parseFile — row count limit', () => {
  it('throws ParseError when the row count exceeds 5,000', async () => {
    const rows = Array.from({ length: MAX_ROWS + 1 }, (_, i) =>
      makeRow({ 'Order ID': String(10000 + i) }),
    );
    const csv = buildCsv(rows);
    const buf = Buffer.from(csv);
    await expect(parseFile(buf, 'test.csv', buf.length)).rejects.toThrow(ParseError);
  });

  it('error message mentions the 5,000 participant limit', async () => {
    const rows = Array.from({ length: MAX_ROWS + 1 }, (_, i) =>
      makeRow({ 'Order ID': String(10000 + i) }),
    );
    const csv = buildCsv(rows);
    const buf = Buffer.from(csv);
    await expect(parseFile(buf, 'test.csv', buf.length)).rejects.toThrow(/5,000/);
  });

  it('accepts exactly 5,000 rows', async () => {
    const rows = Array.from({ length: MAX_ROWS }, (_, i) =>
      makeRow({ 'Order ID': String(10000 + i) }),
    );
    const csv = buildCsv(rows);
    const buf = Buffer.from(csv);
    await expect(parseFile(buf, 'test.csv', buf.length)).resolves.toBeDefined();
  });
});

// ─── Empty / headerless files ─────────────────────────────────────────────────

describe('parseFile — empty and minimal files', () => {
  it('throws ParseError for a completely empty buffer', async () => {
    const buf = Buffer.from('');
    await expect(parseFile(buf, 'test.csv', 0)).rejects.toThrow(ParseError);
  });

  it('throws ParseError for a CSV with only a header row and no data', async () => {
    const csv = ULTRASIGNUP_HEADERS.join(',') + '\n';
    const buf = Buffer.from(csv);
    await expect(parseFile(buf, 'test.csv', buf.length)).rejects.toThrow(ParseError);
  });

  it('error message mentions "empty" for a no-data file', async () => {
    const csv = ULTRASIGNUP_HEADERS.join(',') + '\n';
    const buf = Buffer.from(csv);
    await expect(parseFile(buf, 'test.csv', buf.length)).rejects.toThrow(/empty/i);
  });
});

// ─── Format detection ─────────────────────────────────────────────────────────

describe('parseFile — format detection', () => {
  it('throws ParseError for a CSV with unrecognized headers', async () => {
    const csv = 'name,email,phone\nAlice,a@b.com,555-1234\n';
    const buf = Buffer.from(csv);
    await expect(parseFile(buf, 'test.csv', buf.length)).rejects.toThrow(ParseError);
  });

  it('error message mentions "Unrecognized file format" for unknown headers', async () => {
    const csv = 'name,email,phone\nAlice,a@b.com,555-1234\n';
    const buf = Buffer.from(csv);
    await expect(parseFile(buf, 'test.csv', buf.length)).rejects.toThrow(/Unrecognized file format/i);
  });

  it('error message mentions "UltraSignup" as a supported format', async () => {
    const csv = 'name,email,phone\nAlice,a@b.com,555-1234\n';
    const buf = Buffer.from(csv);
    await expect(parseFile(buf, 'test.csv', buf.length)).rejects.toThrow(/UltraSignup/);
  });
});

// ─── Legacy .xls format ───────────────────────────────────────────────────────

describe('parseFile — legacy .xls rejection', () => {
  it('throws ParseError for a .xls file extension', async () => {
    const { buffer } = validBuf();
    await expect(parseFile(buffer, 'export.xls', buffer.length)).rejects.toThrow(ParseError);
  });

  it('error message instructs user to save as .xlsx', async () => {
    const { buffer } = validBuf();
    await expect(parseFile(buffer, 'export.xls', buffer.length)).rejects.toThrow(/\.xlsx/i);
  });
});

// ─── All rows invalid (none transform to records) ─────────────────────────────

describe('parseFile — all rows invalid', () => {
  it('throws ParseError when every row has a non-numeric Order ID', async () => {
    const rows = [
      makeRow({ 'Order ID': 'COMP-001' }),
      makeRow({ 'Order ID': 'COMP-002' }),
    ];
    const csv = buildCsv(rows);
    const buf = Buffer.from(csv);
    await expect(parseFile(buf, 'test.csv', buf.length)).rejects.toThrow(ParseError);
  });

  it('error message mentions "No valid participant records"', async () => {
    const rows = [makeRow({ 'Order ID': 'INVALID' })];
    const csv = buildCsv(rows);
    const buf = Buffer.from(csv);
    await expect(parseFile(buf, 'test.csv', buf.length)).rejects.toThrow(/No valid participant records/);
  });
});

// ─── Successful parse ─────────────────────────────────────────────────────────

describe('parseFile — successful CSV parse', () => {
  it('returns the correct participant count for a single-row file', async () => {
    const { buffer, size } = validBuf();
    const result = await parseFile(buffer, 'test.csv', size);
    expect(result.participants).toHaveLength(1);
  });

  it('returns adapterName "UltraSignup"', async () => {
    const { buffer, size } = validBuf();
    const result = await parseFile(buffer, 'test.csv', size);
    expect(result.adapterName).toBe('UltraSignup');
  });

  it('counts skipped rows where Order ID is non-numeric', async () => {
    const rows = [
      makeRow({ 'Order ID': '10001' }),
      makeRow({ 'Order ID': 'COMP-001' }), // skipped
      makeRow({ 'Order ID': '10002' }),
    ];
    const csv = buildCsv(rows);
    const buf = Buffer.from(csv);
    const result = await parseFile(buf, 'test.csv', buf.length);
    expect(result.participants).toHaveLength(2);
    expect(result.skippedRows).toBe(1);
  });

  it('parses multiple rows and preserves participant count', async () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      makeRow({ 'Order ID': String(10001 + i) }),
    );
    const csv = buildCsv(rows);
    const buf = Buffer.from(csv);
    const result = await parseFile(buf, 'test.csv', buf.length);
    expect(result.participants).toHaveLength(10);
    expect(result.skippedRows).toBe(0);
  });

  it('strips PII — output records have no First Name field', async () => {
    const { buffer, size } = validBuf();
    const result = await parseFile(buffer, 'test.csv', size);
    const record = result.participants[0] as unknown as Record<string, unknown>;
    expect(record['First Name']).toBeUndefined();
    expect(record['Email']).toBeUndefined();
  });

  it('trims whitespace from header names', async () => {
    const headers = ULTRASIGNUP_HEADERS.map(h => ` ${h} `);
    const row = makeRow();
    const csv = headers.join(',') + '\n' + ULTRASIGNUP_HEADERS.map(h => row[h] ?? '').join(',');
    const buf = Buffer.from(csv);
    await expect(parseFile(buf, 'test.csv', buf.length)).resolves.toBeDefined();
  });
});

// ─── File extension routing ───────────────────────────────────────────────────

describe('parseFile — file extension handling', () => {
  it('treats an unknown extension as CSV', async () => {
    const { buffer, size } = validBuf();
    await expect(parseFile(buffer, 'export.txt', size)).resolves.toBeDefined();
  });

  it('filename casing does not affect CSV parsing', async () => {
    const { buffer, size } = validBuf();
    await expect(parseFile(buffer, 'EXPORT.CSV', size)).resolves.toBeDefined();
  });
});
