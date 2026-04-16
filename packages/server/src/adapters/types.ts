import type { ParticipantRecord } from '../types.js';

// Raw row from a CSV — string values before any transformation
export type RawRow = Record<string, string>;

// An adapter maps a platform's raw CSV row to a canonical ParticipantRecord,
// stripping PII in the process. It also provides a detection function so the
// parser can auto-identify the file format.
export interface Adapter {
  name: string;
  // Returns true if the header row looks like it came from this platform
  detect(headers: string[]): boolean;
  // Transforms a raw row into a canonical record, dropping all PII fields.
  // Returns null if the row should be skipped (e.g. non-participant rows).
  transform(row: RawRow): ParticipantRecord | null;
}
