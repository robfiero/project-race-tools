import Papa from 'papaparse';
import ExcelJS from 'exceljs';
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

// Normalize any ExcelJS cell value to a plain string so the adapter layer
// can use its existing helpers (parseDate, parseNumber, etc.) unchanged.
function cellToString(val: ExcelJS.CellValue): string {
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
  if (typeof val === 'object') {
    // Formula or shared formula — use the computed result
    if ('formula' in val || 'sharedFormula' in val) {
      const result = (val as { result?: ExcelJS.CellValue }).result;
      return result != null ? cellToString(result) : '';
    }
    // Rich text — join all text runs
    if ('richText' in val) {
      return (val as ExcelJS.CellRichTextValue).richText.map(rt => rt.text).join('');
    }
    // Hyperlink — use the display text
    if ('text' in val) {
      return String((val as ExcelJS.CellHyperlinkValue).text);
    }
    // Error value (#DIV/0!, #REF!, etc.) — treat as empty
    if ('error' in val) return '';
  }
  return String(val);
}

async function excelToRows(buffer: Buffer): Promise<{ headers: string[]; rows: RawRow[] }> {
  const workbook = new ExcelJS.Workbook();
  // ExcelJS's Buffer type predates Node's generic Buffer<T> — cast to satisfy TS
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  const ws = workbook.worksheets[0];
  if (!ws) return { headers: [], rows: [] };

  const allRows: ExcelJS.Row[] = [];
  ws.eachRow({ includeEmpty: false }, row => allRows.push(row));

  if (allRows.length < 2) return { headers: [], rows: [] };

  const headerRow = allRows[0];
  const colCount = headerRow.cellCount;
  const headers: string[] = [];
  for (let col = 1; col <= colCount; col++) {
    headers.push(String(headerRow.getCell(col).value ?? '').trim());
  }

  const rows: RawRow[] = [];
  for (let i = 1; i < allRows.length; i++) {
    const exRow = allRows[i];
    const cells: string[] = [];
    for (let col = 1; col <= colCount; col++) {
      cells.push(cellToString(exRow.getCell(col).value));
    }
    if (cells.every(c => c === '')) continue;

    const row: RawRow = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = cells[j] ?? '';
    }
    rows.push(row);
  }

  return { headers, rows };
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

  if (ext === 'xls') {
    throw new ParseError(
      'The legacy .xls format is not supported. Please open the file in Excel and save it as .xlsx, then re-upload.'
    );
  }

  if (ext === 'xlsx') {
    const { headers, rows } = await excelToRows(buffer);
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
