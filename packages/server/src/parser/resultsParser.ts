import Papa from 'papaparse';
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
      'If uploading a registration file, use the Registration Analytics tab.',
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

  if (ext !== 'csv') {
    throw new ParseError(
      'Only CSV files are supported. To use an Excel export, open it in Excel or Google Sheets and save as CSV, then re-upload.'
    );
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
