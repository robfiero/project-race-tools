#!/usr/bin/env tsx
/**
 * sanitize-csv.ts
 *
 * Replaces PII fields in UltraSignup CSV exports with realistic-looking but
 * entirely fake values, then writes the results to ./sanitized/<original-name>.
 *
 * Usage:
 *   npx tsx scripts/sanitize-csv.ts                  # all GhostTrain*.csv in repo root
 *   npx tsx scripts/sanitize-csv.ts path/to/file.csv  # explicit file(s)
 *
 * Fields sanitized:
 *   First Name        → fake first name (gender-aware pool)
 *   Last Name         → fake last name
 *   DOB               → 01/01/<birth-year>  (year kept for age accuracy)
 *   Email             → participant<orderId>@example.com
 *   Address           → fake street address
 *   Phone             → 555-<6 digits>
 *   emergency_name    → fake full name
 *   emergency_phone   → 555-<6 digits>
 *
 * City, State, Zip, Country are NOT touched — they drive geographic statistics.
 * All other non-PII columns pass through unchanged.
 *
 * Sanitization is deterministic: the same input always produces the same output.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';

// ─── Name pools ───────────────────────────────────────────────────────────────

const FIRST_NAMES_M = [
  'Aaron', 'Adam', 'Alex', 'Andrew', 'Ben', 'Blake', 'Brandon', 'Brian',
  'Carlos', 'Chris', 'Daniel', 'David', 'Derek', 'Dylan', 'Eric', 'Ethan',
  'Frank', 'Greg', 'Henry', 'Ian', 'Jack', 'James', 'Jason', 'Jeff',
  'Jordan', 'Josh', 'Kevin', 'Kyle', 'Luke', 'Mark', 'Matt', 'Michael',
  'Nathan', 'Nick', 'Noah', 'Patrick', 'Paul', 'Peter', 'Ryan', 'Sam',
  'Scott', 'Sean', 'Seth', 'Steve', 'Thomas', 'Tim', 'Tom', 'Tyler',
  'Will', 'Zach',
];

const FIRST_NAMES_F = [
  'Abby', 'Alexis', 'Alice', 'Amanda', 'Amy', 'Andrea', 'Angela', 'Anna',
  'Ashley', 'Beth', 'Brittany', 'Caitlin', 'Chelsea', 'Christina', 'Claire',
  'Dana', 'Emily', 'Emma', 'Grace', 'Hannah', 'Heather', 'Holly', 'Jennifer',
  'Jessica', 'Julia', 'Julie', 'Karen', 'Kate', 'Katie', 'Kelly', 'Laura',
  'Lauren', 'Leah', 'Lisa', 'Megan', 'Melissa', 'Michelle', 'Morgan',
  'Nicole', 'Rachel', 'Rebecca', 'Sarah', 'Shannon', 'Stephanie', 'Susan',
  'Taylor', 'Tiffany', 'Tracy', 'Wendy', 'Zoe',
];

const FIRST_NAMES_NB = [
  'Alex', 'Avery', 'Blake', 'Cameron', 'Charlie', 'Dakota', 'Drew', 'Ellis',
  'Finley', 'Harper', 'Hayden', 'Jamie', 'Jordan', 'Jules', 'Kendall',
  'Logan', 'Morgan', 'Parker', 'Quinn', 'Reese', 'Riley', 'Robin', 'Rowan',
  'Sage', 'Sam', 'Skyler', 'Taylor', 'Terry', 'Toni', 'Wren',
];

const LAST_NAMES = [
  'Adams', 'Allen', 'Anderson', 'Baker', 'Barnes', 'Bell', 'Bennett',
  'Brooks', 'Brown', 'Campbell', 'Carter', 'Clark', 'Collins', 'Cook',
  'Cooper', 'Cox', 'Davis', 'Edwards', 'Evans', 'Fisher', 'Foster',
  'Garcia', 'Gonzalez', 'Gray', 'Green', 'Hall', 'Harris', 'Hayes',
  'Hill', 'Howard', 'Hughes', 'Jackson', 'Johnson', 'Jones', 'Kelly',
  'King', 'Lee', 'Lewis', 'Long', 'Martin', 'Martinez', 'Miller',
  'Mitchell', 'Moore', 'Morgan', 'Morris', 'Murphy', 'Nelson', 'Parker',
  'Patel', 'Perez', 'Phillips', 'Price', 'Reed', 'Richardson', 'Roberts',
  'Robinson', 'Rodriguez', 'Rogers', 'Ross', 'Russell', 'Sanchez', 'Scott',
  'Smith', 'Stewart', 'Sullivan', 'Taylor', 'Thomas', 'Thompson', 'Torres',
  'Turner', 'Walker', 'Ward', 'Watson', 'White', 'Williams', 'Wilson',
  'Wood', 'Wright', 'Young',
];

const STREET_NAMES = [
  'Maple', 'Oak', 'Pine', 'Cedar', 'Elm', 'Birch', 'Willow', 'Spruce',
  'Chestnut', 'Walnut', 'Hickory', 'Sycamore', 'Beech', 'Poplar', 'Ash',
  'Aspen', 'Hemlock', 'Fir', 'Larch', 'Juniper', 'Redwood', 'Magnolia',
  'Dogwood', 'Hawthorn', 'Mulberry', 'Locust', 'Cypress', 'Basswood',
  'Cottonwood', 'Butternut',
];

const STREET_TYPES = [
  'St', 'Ave', 'Rd', 'Ln', 'Dr', 'Blvd', 'Way', 'Ct', 'Pl', 'Ter',
];

// ─── Deterministic hash ───────────────────────────────────────────────────────

/**
 * Returns a non-negative integer derived from the input string.
 * Used to pick fake values deterministically per Order ID.
 */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0; // unsigned 32-bit
}

function pick<T>(pool: T[], seed: string, salt: string): T {
  return pool[hash(seed + salt) % pool.length];
}

// ─── Field sanitizers ─────────────────────────────────────────────────────────

function fakeFirstName(orderId: string, gender: string): string {
  const g = gender.trim().toUpperCase();
  const pool = g === 'M' ? FIRST_NAMES_M : g === 'F' ? FIRST_NAMES_F : FIRST_NAMES_NB;
  return pick(pool, orderId, 'first');
}

function fakeLastName(orderId: string): string {
  return pick(LAST_NAMES, orderId, 'last');
}

function fakeEmergencyName(orderId: string): string {
  // Emergency contacts are a mix; use the neutral pool for simplicity
  const first = pick([...FIRST_NAMES_M, ...FIRST_NAMES_F], orderId, 'ec_first');
  const last = pick(LAST_NAMES, orderId, 'ec_last');
  return `${first} ${last}`;
}

function fakeEmail(orderId: string): string {
  return `participant${orderId}@example.com`;
}

function fakeAddress(orderId: string): string {
  const num = (hash(orderId + 'addr') % 9900) + 100; // 100–9999
  const street = pick(STREET_NAMES, orderId, 'street');
  const type = pick(STREET_TYPES, orderId, 'stype');
  return `${num} ${street} ${type}`;
}

function fakePhone(orderId: string, salt: string): string {
  const n = hash(orderId + salt);
  // Format: 555-XXXXXX  (555 prefix is reserved / clearly fake)
  const digits = String(n % 1_000_000).padStart(6, '0');
  return `555${digits}`;
}

/**
 * Sanitizes DOB by preserving the birth year and replacing month/day with
 * 01/01.  The birth year alone determines approximate age to within ±1 year,
 * which is sufficient for age-group statistics without exposing the actual
 * birthday.
 *
 * Input format: M/D/YYYY or MM/DD/YYYY
 * Output format: 1/1/YYYY  (matching UltraSignup's loose M/D/YYYY style)
 */
function sanitizeDob(dob: string): string {
  const m = dob.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return dob; // unrecognized format — leave as-is
  const year = m[3];
  return `1/1/${year}`;
}

// ─── CSV processing ───────────────────────────────────────────────────────────

type Row = Record<string, string>;

function sanitizeRow(row: Row): Row {
  const orderId = row['Order ID']?.trim() ?? 'unknown';
  const gender = row['gender'] ?? '';

  const out = { ...row };

  out['First Name']       = fakeFirstName(orderId, gender);
  out['Last Name']        = fakeLastName(orderId);
  out['Email']            = fakeEmail(orderId);
  out['Address']          = fakeAddress(orderId);
  out['Phone']            = fakePhone(orderId, 'phone');
  out['emergency_name']   = fakeEmergencyName(orderId);
  out['emergency_phone']  = fakePhone(orderId, 'ec_phone');

  if (out['DOB']) out['DOB'] = sanitizeDob(out['DOB']);

  return out;
}

function processFile(inputPath: string, outputDir: string): void {
  const filename = path.basename(inputPath);
  const outputPath = path.join(outputDir, filename);

  const raw = fs.readFileSync(inputPath, 'utf-8');

  // Papa Parse with header:true returns typed rows; cast to our Row type.
  const result = Papa.parse<Row>(raw, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    const serious = result.errors.filter(e => e.type !== 'Delimiter');
    if (serious.length > 0) {
      console.warn(`  Warnings in ${filename}:`, serious.slice(0, 3));
    }
  }

  const sanitized = result.data.map(sanitizeRow);

  // Reconstruct CSV preserving the original column order.
  const output = Papa.unparse(sanitized, {
    columns: result.meta.fields,
    quotes: false,
    quoteChar: '"',
    escapeChar: '"',
    newline: '\r\n',
  });

  // Preserve UTF-8 BOM if the original had one (UltraSignup exports include it)
  const bom = raw.startsWith('\uFEFF') ? '\uFEFF' : '';
  fs.writeFileSync(outputPath, bom + output, 'utf-8');

  const rows = sanitized.length;
  console.log(`  ${filename}: ${rows} rows → ${outputPath}`);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// Default: all GhostTrain*.csv in the repo root
const argFiles = process.argv.slice(2);
let inputFiles: string[];

if (argFiles.length > 0) {
  inputFiles = argFiles.map(f => path.resolve(f));
} else {
  inputFiles = fs.readdirSync(repoRoot)
    .filter(f => /^GhostTrain.*\.csv$/i.test(f))
    .map(f => path.join(repoRoot, f));
}

if (inputFiles.length === 0) {
  console.error('No CSV files found. Pass explicit paths or run from the repo root.');
  process.exit(1);
}

const outputDir = path.join(repoRoot, 'sanitized');
fs.mkdirSync(outputDir, { recursive: true });

console.log(`Sanitizing ${inputFiles.length} file(s) → ${outputDir}/\n`);
for (const f of inputFiles) {
  processFile(f, outputDir);
}
console.log('\nDone. Originals are untouched.');
