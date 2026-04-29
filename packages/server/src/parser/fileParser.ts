import Papa from 'papaparse';
import type { ParticipantRecord } from '../types.js';
import { detectAdapter } from '../adapters/index.js';
import type { RawRow } from '../adapters/types.js';

const MAX_ROWS = 5000;
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

export interface ParseResult {
  participants: ParticipantRecord[];
  adapterName: string;
  skippedRows: number;
}

// ─── Shared processing ───────────────────────────────────────────────────────

// PapaParse and the Excel builder both key rows by header name, so multiple
// blank-header columns collapse onto the same '' key (last writer wins).
// Checking for '' in both the header list and at least one row value is
// sufficient to detect any column whose header is missing but contains data.
function assertNoBlankHeadersWithData(headers: string[], rows: RawRow[]): void {
  if (!headers.some(h => h === '')) return;
  const hasData = rows.some(row => {
    const val = row[''];
    return typeof val === 'string' && val.trim() !== '';
  });
  if (!hasData) return;
  throw new ParseError(
    'This file has one or more columns with no header label that contain data. ' +
    'Every data column must have a header for the file to be processed correctly. ' +
    'Open the file in a spreadsheet application, add the missing column headers, and re-upload.',
  );
}

function processRows(headers: string[], rows: RawRow[]): ParseResult {
  assertNoBlankHeadersWithData(headers, rows);

  if (rows.length === 0) {
    throw new ParseError('The file appears to be empty or has no data rows.');
  }

  if (rows.length > MAX_ROWS) {
    throw new ParseError(
      `Row count (${rows.length.toLocaleString()}) exceeds the 5,000 participant limit. ` +
      `RaceStats is designed for events up to 5,000 participants.`
    );
  }

  const adapter = detectAdapter(headers);
  if (!adapter) {
    throw new ParseError(
      'Unrecognized file format. Currently supported: UltraSignup exports. ' +
      'Make sure you are uploading a file exported directly from a supported platform.'
    );
  }

  const participants: ParticipantRecord[] = [];
  let skippedRows = 0;

  for (const row of rows) {
    const record = adapter.transform(row);
    if (record === null) {
      skippedRows++;
    } else {
      participants.push(record);
    }
  }

  if (participants.length === 0) {
    throw new ParseError('No valid participant records found in this file.');
  }

  return { participants, adapterName: adapter.name, skippedRows };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function parseFile(
  buffer: Buffer,
  filename: string,
  fileSizeBytes: number,
): Promise<ParseResult> {
  if (fileSizeBytes > MAX_BYTES) {
    throw new ParseError(
      `File size (${(fileSizeBytes / 1024 / 1024).toFixed(1)} MB) exceeds the 5 MB limit. ` +
      `RaceStats is designed for events up to 5,000 participants.`
    );
  }

  const ext = filename.toLowerCase().split('.').pop() ?? '';

  if (ext !== 'csv') {
    throw new ParseError(
      'Only CSV files are supported. To use an Excel export, open it in Excel or Google Sheets and save as CSV, then re-upload.'
    );
  }

  // Parse as CSV
  const text = buffer.toString('utf-8');
  const result = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (result.errors.length > 0) {
    const fatal = result.errors.filter(e => e.type === 'Delimiter' || e.type === 'Quotes');
    if (fatal.length > 0) {
      throw new ParseError(`CSV parse error: ${fatal[0].message}`);
    }
  }

  const headers = result.meta.fields ?? [];
  return processRows(headers, result.data);
}
