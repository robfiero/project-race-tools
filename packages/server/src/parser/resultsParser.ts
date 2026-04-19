import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import type { ResultRecord } from '../types.js';
import { ultraSignupResultsAdapter } from '../adapters/resultsAdapter.js';
import type { RawRow } from '../adapters/types.js';
import { ParseError } from './fileParser.js';

const MAX_ROWS = 10_000;
const MAX_BYTES = 5 * 1024 * 1024;

export interface ResultsParseResult {
  results: ResultRecord[];
  adapterName: string;
  skippedRows: number;
}

function cellToString(val: ExcelJS.CellValue): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'object') {
    if ('formula' in val || 'sharedFormula' in val) {
      const result = (val as { result?: ExcelJS.CellValue }).result;
      return result != null ? cellToString(result) : '';
    }
    if ('richText' in val) {
      return (val as ExcelJS.CellRichTextValue).richText.map(rt => rt.text).join('');
    }
    if ('text' in val) return String((val as ExcelJS.CellHyperlinkValue).text);
    if ('error' in val) return '';
  }
  return String(val);
}

async function excelToRows(buffer: Buffer): Promise<{ headers: string[]; rows: RawRow[] }> {
  const workbook = new ExcelJS.Workbook();
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

function processRows(headers: string[], rows: RawRow[]): ResultsParseResult {
  assertNoBlankHeadersWithData(headers, rows);

  if (rows.length === 0) {
    throw new ParseError('The file appears to be empty or has no data rows.');
  }
  if (rows.length > MAX_ROWS) {
    throw new ParseError(
      `Row count (${rows.length.toLocaleString()}) exceeds the ${MAX_ROWS.toLocaleString()} row limit.`,
    );
  }

  if (!ultraSignupResultsAdapter.detect(headers)) {
    throw new ParseError(
      'Unrecognized results file format. Expected a UltraSignup results export ' +
      'with columns: place, bib, time, distance, finish_status. ' +
      'If uploading a participant registration file, use the Participant Analytics tab.',
    );
  }

  const results: ResultRecord[] = [];
  let skippedRows = 0;

  for (const row of rows) {
    const record = ultraSignupResultsAdapter.transform(row);
    if (record === null) {
      skippedRows++;
    } else {
      results.push(record);
    }
  }

  if (results.length === 0) {
    throw new ParseError('No valid result records found in this file.');
  }

  return { results, adapterName: ultraSignupResultsAdapter.name, skippedRows };
}

export async function parseResultsFile(
  buffer: Buffer,
  filename: string,
  fileSizeBytes: number,
): Promise<ResultsParseResult> {
  if (fileSizeBytes > MAX_BYTES) {
    throw new ParseError(
      `File size (${(fileSizeBytes / 1024 / 1024).toFixed(1)} MB) exceeds the 5 MB limit.`,
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

  const text = buffer.toString('utf-8');
  const parsed = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim(),
  });

  if (parsed.errors.length > 0) {
    const fatal = parsed.errors.filter(e => e.type === 'Delimiter' || e.type === 'Quotes');
    if (fatal.length > 0) {
      throw new ParseError(`CSV parse error: ${fatal[0].message}`);
    }
  }

  return processRows(parsed.meta.fields ?? [], parsed.data);
}
