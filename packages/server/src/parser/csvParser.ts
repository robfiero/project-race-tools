import Papa from 'papaparse';
import type { ParticipantRecord } from '../types.js';
import { detectAdapter } from '../adapters/index.js';

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

export function parseCSV(buffer: Buffer, fileSizeBytes: number): ParseResult {
  if (fileSizeBytes > MAX_BYTES) {
    throw new ParseError(
      `File size (${(fileSizeBytes / 1024 / 1024).toFixed(1)}MB) exceeds the 5MB limit. ` +
      `RaceStats is designed for events up to 5,000 participants.`
    );
  }

  const text = buffer.toString('utf-8');

  // PapaParse synchronous parse — works well for files up to our 5MB limit.
  // header:true gives us named fields; skipEmptyLines prevents ghost rows.
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (result.errors.length > 0) {
    // Non-fatal parse warnings are common in CSV; only fail on critical errors
    const fatal = result.errors.filter(e => e.type === 'Delimiter' || e.type === 'Quotes');
    if (fatal.length > 0) {
      throw new ParseError(`CSV parse error: ${fatal[0].message}`);
    }
  }

  const rows = result.data;
  if (rows.length === 0) {
    throw new ParseError('The file appears to be empty or has no data rows.');
  }

  if (rows.length > MAX_ROWS) {
    throw new ParseError(
      `Row count (${rows.length.toLocaleString()}) exceeds the 5,000 participant limit. ` +
      `RaceStats is designed for events up to 5,000 participants.`
    );
  }

  const headers = result.meta.fields ?? [];
  const adapter = detectAdapter(headers);
  if (!adapter) {
    throw new ParseError(
      'Unrecognized file format. Currently supported: UltraSignup exports. ' +
      'Make sure you are uploading a CSV exported directly from a supported platform.'
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
