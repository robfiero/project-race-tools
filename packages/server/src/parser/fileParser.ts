import Papa from 'papaparse';
import * as XLSX from 'xlsx';
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

// ─── Excel helpers ───────────────────────────────────────────────────────────

// Normalize any native Excel cell type to a plain string so the adapter layer
// can use its existing helpers (parseDate, parseNumber, etc.) unchanged.
function cellToString(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) {
    // UltraSignup stores timestamps as text strings, not date-formatted cells,
    // so this path is a fallback for other platforms or future adapters.
    const mo = val.getMonth() + 1;
    const da = val.getDate();
    const yr = val.getFullYear();
    let h = val.getHours();
    const mi = String(val.getMinutes()).padStart(2, '0');
    const sc = String(val.getSeconds()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${mo}/${da}/${yr} ${h}:${mi}:${sc} ${ampm}`;
  }
  return String(val);
}

function excelToRows(buffer: Buffer): { headers: string[]; rows: RawRow[] } {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  // header:1 gives raw arrays; defval ensures missing cells become '' not undefined
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });

  if (raw.length < 2) return { headers: [], rows: [] };

  const headers = (raw[0] as unknown[]).map(h => String(h).trim());
  const rows: RawRow[] = [];

  for (let i = 1; i < raw.length; i++) {
    const cells = raw[i] as unknown[];
    // Skip entirely blank rows
    if (cells.every(c => c === '' || c === null || c === undefined)) continue;
    const row: RawRow = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = cellToString(cells[j]);
    }
    rows.push(row);
  }

  return { headers, rows };
}

// ─── Shared processing ───────────────────────────────────────────────────────

function processRows(headers: string[], rows: RawRow[]): ParseResult {
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

export function parseFile(
  buffer: Buffer,
  filename: string,
  fileSizeBytes: number,
): ParseResult {
  if (fileSizeBytes > MAX_BYTES) {
    throw new ParseError(
      `File size (${(fileSizeBytes / 1024 / 1024).toFixed(1)} MB) exceeds the 5 MB limit. ` +
      `RaceStats is designed for events up to 5,000 participants.`
    );
  }

  const ext = filename.toLowerCase().split('.').pop() ?? '';

  if (ext === 'xlsx' || ext === 'xls') {
    const { headers, rows } = excelToRows(buffer);
    return processRows(headers, rows);
  }

  // Default: treat as CSV
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
