// Synthetic UltraSignup-format CSV generator for demo purposes.
// Uses a seeded LCG PRNG so output is deterministic per sampleId.

class Prng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0; }

  next(): number {
    this.s = (Math.imul(this.s, 1664525) + 1013904223) >>> 0;
    return this.s / 0x100000000;
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  bool(p: number): boolean { return this.next() < p; }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  pickWeighted<T>(items: Array<{ value: T; weight: number }>): T {
    const total = items.reduce((s, x) => s + x.weight, 0);
    let r = this.next() * total;
    for (const { value, weight } of items) {
      r -= weight;
      if (r <= 0) return value;
    }
    return items[items.length - 1].value;
  }

  normal(mean: number, std: number): number {
    const u1 = Math.max(1e-10, this.next());
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * std;
  }
}

function seedFor(id: string): number {
  return id.split('').reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 0) >>> 0;
}

// Representative zip codes by state (for distance-lookup plausibility)
const STATE_ZIPS: Record<string, string[]> = {
  NH: ['03032', '03060', '03103', '03301', '03431', '03570', '03820'],
  ME: ['03901', '04001', '04103', '04240', '04330', '04401', '04730'],
  VT: ['05001', '05060', '05201', '05301', '05401', '05602'],
  MA: ['01002', '01060', '01201', '01420', '01701', '01851', '02101', '02301', '02401'],
  CT: ['06001', '06101', '06201', '06401', '06701', '06801'],
  NY: ['10001', '10601', '12001', '12401', '13001', '14001'],
  NJ: ['07001', '07101', '07301', '07501', '07901'],
  PA: ['15001', '15201', '17001', '17601', '18001', '19001'],
  FL: ['32001', '33101', '33601', '34201'],
  CO: ['80001', '80401', '81001', '81601'],
  CA: ['90210', '92101', '94101', '95101'],
  TX: ['75001', '75201', '77001', '78201'],
  WA: ['98001', '98101', '98401', '98501'],
  OR: ['97001', '97201', '97401'],
  MI: ['48001', '48201', '48401', '49001'],
  NC: ['27001', '27601', '28001'],
  GA: ['30001', '30301', '31001'],
};

interface EventConfig {
  name: string;
  fraction: number;
  price: number;
}

interface StateWeight {
  state: string;
  weight: number;
}

interface SampleConfig {
  raceName: string;
  count: number;
  year: number;
  raceMonth: number;
  raceDay: number;
  regOpenMonthsBefore: number;
  events: EventConfig[];
  stateWeights: StateWeight[];
  genderM: number;
  genderF: number;
  ageMean: number;
  ageStd: number;
  couponRate: number;
  compRate: number;
  removeRate: number;
  dropRate: number;
  statementId: number;
}

export const SAMPLE_CONFIGS: Record<string, SampleConfig> = {
  'pinecrest-5k-2024': {
    raceName: 'Pinecrest 5K',
    count: 102, year: 2024, raceMonth: 7, raceDay: 6, regOpenMonthsBefore: 4,
    events: [{ name: '5K Run', fraction: 1.0, price: 30 }],
    stateWeights: [
      { state: 'NH', weight: 50 }, { state: 'MA', weight: 18 },
      { state: 'ME', weight: 13 }, { state: 'VT', weight: 8 },
      { state: 'NY', weight: 5 }, { state: 'CT', weight: 4 }, { state: 'PA', weight: 2 },
    ],
    genderM: 0.52, genderF: 0.46, ageMean: 36, ageStd: 10,
    couponRate: 0.05, compRate: 0.02, removeRate: 0.01, dropRate: 0.01,
    statementId: 44001,
  },

  'white-mountains-2022': {
    raceName: 'White Mountains Challenge',
    count: 278, year: 2022, raceMonth: 9, raceDay: 17, regOpenMonthsBefore: 7,
    events: [
      { name: '5K', fraction: 0.25, price: 45 },
      { name: 'Half Marathon', fraction: 0.45, price: 75 },
      { name: '50K', fraction: 0.30, price: 110 },
    ],
    stateWeights: [
      { state: 'NH', weight: 32 }, { state: 'MA', weight: 22 }, { state: 'NY', weight: 12 },
      { state: 'ME', weight: 10 }, { state: 'VT', weight: 9 }, { state: 'CT', weight: 6 },
      { state: 'NJ', weight: 4 }, { state: 'PA', weight: 2 }, { state: 'CO', weight: 2 }, { state: 'CA', weight: 1 },
    ],
    genderM: 0.53, genderF: 0.45, ageMean: 35, ageStd: 9,
    couponRate: 0.06, compRate: 0.02, removeRate: 0.015, dropRate: 0.02,
    statementId: 44002,
  },
  'white-mountains-2023': {
    raceName: 'White Mountains Challenge',
    count: 315, year: 2023, raceMonth: 9, raceDay: 16, regOpenMonthsBefore: 7,
    events: [
      { name: '5K', fraction: 0.25, price: 50 },
      { name: 'Half Marathon', fraction: 0.45, price: 80 },
      { name: '50K', fraction: 0.30, price: 120 },
    ],
    stateWeights: [
      { state: 'NH', weight: 30 }, { state: 'MA', weight: 23 }, { state: 'NY', weight: 13 },
      { state: 'ME', weight: 10 }, { state: 'VT', weight: 8 }, { state: 'CT', weight: 6 },
      { state: 'NJ', weight: 4 }, { state: 'PA', weight: 3 }, { state: 'CO', weight: 2 }, { state: 'CA', weight: 1 },
    ],
    genderM: 0.52, genderF: 0.46, ageMean: 35, ageStd: 9,
    couponRate: 0.065, compRate: 0.02, removeRate: 0.015, dropRate: 0.02,
    statementId: 44003,
  },
  'white-mountains-2024': {
    raceName: 'White Mountains Challenge',
    count: 348, year: 2024, raceMonth: 9, raceDay: 21, regOpenMonthsBefore: 8,
    events: [
      { name: '5K', fraction: 0.25, price: 55 },
      { name: 'Half Marathon', fraction: 0.45, price: 85 },
      { name: '50K', fraction: 0.30, price: 130 },
    ],
    stateWeights: [
      { state: 'NH', weight: 29 }, { state: 'MA', weight: 24 }, { state: 'NY', weight: 13 },
      { state: 'ME', weight: 10 }, { state: 'VT', weight: 8 }, { state: 'CT', weight: 7 },
      { state: 'NJ', weight: 4 }, { state: 'PA', weight: 3 }, { state: 'CO', weight: 1 }, { state: 'CA', weight: 1 },
    ],
    genderM: 0.52, genderF: 0.46, ageMean: 35, ageStd: 9,
    couponRate: 0.07, compRate: 0.02, removeRate: 0.01, dropRate: 0.02,
    statementId: 44004,
  },

  'mountain-endurance-2022': {
    raceName: 'Mountain Endurance Challenge',
    count: 738, year: 2022, raceMonth: 10, raceDay: 8, regOpenMonthsBefore: 10,
    events: [
      { name: '25K', fraction: 0.30, price: 65 },
      { name: '50K', fraction: 0.35, price: 95 },
      { name: '50 Miler', fraction: 0.22, price: 130 },
      { name: '100 Miler', fraction: 0.13, price: 175 },
    ],
    stateWeights: [
      { state: 'NH', weight: 19 }, { state: 'MA', weight: 17 }, { state: 'NY', weight: 16 },
      { state: 'ME', weight: 8 }, { state: 'CT', weight: 8 }, { state: 'VT', weight: 6 },
      { state: 'NJ', weight: 6 }, { state: 'PA', weight: 5 }, { state: 'FL', weight: 3 },
      { state: 'CO', weight: 3 }, { state: 'CA', weight: 3 }, { state: 'TX', weight: 2 },
      { state: 'WA', weight: 2 }, { state: 'GA', weight: 1 }, { state: 'NC', weight: 1 },
    ],
    genderM: 0.57, genderF: 0.41, ageMean: 38, ageStd: 9,
    couponRate: 0.07, compRate: 0.03, removeRate: 0.02, dropRate: 0.03,
    statementId: 45001,
  },
  'mountain-endurance-2023': {
    raceName: 'Mountain Endurance Challenge',
    count: 797, year: 2023, raceMonth: 10, raceDay: 14, regOpenMonthsBefore: 10,
    events: [
      { name: '25K', fraction: 0.30, price: 70 },
      { name: '50K', fraction: 0.35, price: 100 },
      { name: '50 Miler', fraction: 0.22, price: 140 },
      { name: '100 Miler', fraction: 0.13, price: 185 },
    ],
    stateWeights: [
      { state: 'NH', weight: 18 }, { state: 'MA', weight: 17 }, { state: 'NY', weight: 16 },
      { state: 'ME', weight: 8 }, { state: 'CT', weight: 8 }, { state: 'VT', weight: 6 },
      { state: 'NJ', weight: 6 }, { state: 'PA', weight: 5 }, { state: 'FL', weight: 3 },
      { state: 'CO', weight: 3 }, { state: 'CA', weight: 3 }, { state: 'TX', weight: 2 },
      { state: 'WA', weight: 2 }, { state: 'GA', weight: 2 }, { state: 'NC', weight: 1 },
    ],
    genderM: 0.56, genderF: 0.42, ageMean: 38, ageStd: 9,
    couponRate: 0.075, compRate: 0.03, removeRate: 0.02, dropRate: 0.025,
    statementId: 45002,
  },
  'mountain-endurance-2024': {
    raceName: 'Mountain Endurance Challenge',
    count: 853, year: 2024, raceMonth: 10, raceDay: 12, regOpenMonthsBefore: 11,
    events: [
      { name: '25K', fraction: 0.30, price: 75 },
      { name: '50K', fraction: 0.35, price: 110 },
      { name: '50 Miler', fraction: 0.22, price: 150 },
      { name: '100 Miler', fraction: 0.13, price: 195 },
    ],
    stateWeights: [
      { state: 'NH', weight: 18 }, { state: 'MA', weight: 17 }, { state: 'NY', weight: 16 },
      { state: 'ME', weight: 8 }, { state: 'CT', weight: 8 }, { state: 'VT', weight: 6 },
      { state: 'NJ', weight: 6 }, { state: 'PA', weight: 5 }, { state: 'FL', weight: 3 },
      { state: 'CO', weight: 3 }, { state: 'CA', weight: 3 }, { state: 'TX', weight: 2 },
      { state: 'WA', weight: 2 }, { state: 'GA', weight: 2 }, { state: 'NC', weight: 1 },
    ],
    genderM: 0.55, genderF: 0.43, ageMean: 38, ageStd: 9,
    couponRate: 0.08, compRate: 0.03, removeRate: 0.015, dropRate: 0.025,
    statementId: 45003,
  },
};

const CSV_HEADER = [
  'Order ID', 'Registration Date', 'distance', 'Quantity', 'Price', 'Price Option',
  'order_type', 'Coupon', 'First Name', 'Last Name', 'gender', 'Identified Gender',
  'Age', 'AgeGroup', 'DOB', 'Email', 'Address', 'City', 'State', 'Zip', 'Country',
  'Phone', 'Removed', 'Bib', 'Captain', 'team_name', 'emergency_name', 'emergency_phone',
  'statement_id', 'item_discount', 'order_tax', 'ultrasignup_fee', 'order_total',
  'Refunds', 'Dropping from the Race',
].join(',');

function formatRegDate(
  year: number, month: number, day: number,
  hour: number, minute: number, second: number,
): string {
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${month}/${day}/${year} ${h12}:${pad(minute)}:${pad(second)} ${ampm}`;
}

// Add months to a UTC date, returning { year, month, day } components
function addMonthsUTC(year: number, month: number, day: number, months: number) {
  const d = new Date(Date.UTC(year, month - 1 + months, day));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function addDaysUTC(year: number, month: number, day: number, days: number) {
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function daysBetween(
  y1: number, m1: number, d1: number,
  y2: number, m2: number, d2: number,
): number {
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.floor((b - a) / 86400000);
}

const HOUR_WEIGHTS = [
  { value: 7, weight: 2 }, { value: 8, weight: 4 }, { value: 9, weight: 7 },
  { value: 10, weight: 8 }, { value: 11, weight: 7 }, { value: 12, weight: 9 },
  { value: 13, weight: 8 }, { value: 14, weight: 7 }, { value: 15, weight: 6 },
  { value: 16, weight: 6 }, { value: 17, weight: 7 }, { value: 18, weight: 8 },
  { value: 19, weight: 9 }, { value: 20, weight: 8 }, { value: 21, weight: 6 },
  { value: 22, weight: 4 }, { value: 23, weight: 2 }, { value: 0, weight: 1 },
];

function csvField(v: string): string {
  return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
}

export function generateCSV(sampleId: string): string {
  const config = SAMPLE_CONFIGS[sampleId];
  if (!config) throw new Error(`Unknown sample ID: ${sampleId}`);

  const rng = new Prng(seedFor(sampleId));

  // Registration window: opens N months before race, closes 2 weeks before
  const open = addMonthsUTC(config.year, config.raceMonth, config.raceDay, -config.regOpenMonthsBefore);
  const close = addDaysUTC(config.year, config.raceMonth, config.raceDay, -14);
  const totalDays = daysBetween(open.year, open.month, open.day, close.year, close.month, close.day);

  function pickRegDate() {
    // Weighted toward end of registration: 20% in first 60%, 30% in next 30%, 50% in last 10%
    const r = rng.next();
    let fraction: number;
    if (r < 0.20) fraction = (r / 0.20) * 0.60;
    else if (r < 0.50) fraction = 0.60 + ((r - 0.20) / 0.30) * 0.30;
    else fraction = 0.90 + ((r - 0.50) / 0.50) * 0.10;
    const d = addDaysUTC(open.year, open.month, open.day, Math.floor(fraction * totalDays));
    return { ...d, hour: rng.pickWeighted(HOUR_WEIGHTS), minute: rng.int(0, 59), second: rng.int(0, 59) };
  }

  function pickEvent(): EventConfig {
    return rng.pickWeighted(config.events.map(e => ({ value: e, weight: e.fraction })));
  }

  function pickStateZip(): { state: string; zip: string } {
    const state = rng.pickWeighted(config.stateWeights.map(s => ({ value: s.state, weight: s.weight })));
    const zips = STATE_ZIPS[state] ?? STATE_ZIPS['NH'];
    return { state, zip: rng.pick(zips) };
  }

  function pickGender(): { gender: string; identifiedGender: string } {
    const r = rng.next();
    if (r < config.genderM) return { gender: 'M', identifiedGender: '' };
    if (r < config.genderM + config.genderF) return { gender: 'F', identifiedGender: '' };
    // Non-binary: use identifiedGender='x' with either M or F in the gender column
    return { gender: rng.bool(0.5) ? 'M' : 'F', identifiedGender: 'x' };
  }

  function pickAge(): number {
    return Math.max(16, Math.min(75, Math.round(rng.normal(config.ageMean, config.ageStd))));
  }

  const rows: string[] = [CSV_HEADER];
  let orderId = 1000000 + rng.int(100, 9999);
  let bib = 1;

  for (let i = 0; i < config.count; i++) {
    orderId += rng.int(1, 5);
    const event = pickEvent();
    const { state, zip } = pickStateZip();
    const { gender, identifiedGender } = pickGender();
    const age = pickAge();
    const regDate = pickRegDate();

    const isComped = rng.bool(config.compRate);
    const hasCoupon = !isComped && rng.bool(config.couponRate);
    const isRemoved = rng.bool(config.removeRate);
    const isDropping = !isRemoved && rng.bool(config.dropRate);

    const price = event.price;
    const couponAmt = hasCoupon ? rng.pick([5, 10, 15, 20]) : 0;
    const discount = isComped ? price : 0;
    const usFee = isComped ? 0 : parseFloat((price * 0.04 + 1.0).toFixed(2));
    const total = isComped ? 0 : price + usFee - couponAmt;
    const orderType = isComped ? 'Comp' : rng.bool(0.85) ? 'Credit Card' : 'PayPal';

    const dateStr = formatRegDate(regDate.year, regDate.month, regDate.day, regDate.hour, regDate.minute, regDate.second);
    const priceOption = `${event.name} - Registration - $${price}`;

    const fields = [
      String(orderId),
      dateStr,
      event.name,
      '1',
      price.toFixed(4),
      priceOption,
      orderType,
      couponAmt.toFixed(4),
      `Participant${orderId}`,      // First Name (PII — stripped by adapter)
      `Demo${String(i).padStart(4, '0')}`,  // Last Name (PII — stripped)
      gender,
      identifiedGender,
      String(age),
      '',
      '1/1/1980',                   // DOB (PII — stripped)
      `participant${orderId}@example.com`, // Email (PII — stripped)
      '123 Main St',                // Address (PII — stripped)
      'Sample City',
      state,
      zip,
      'USA',
      '5550000000',                 // Phone (PII — stripped)
      isRemoved ? 'True' : 'False',
      String(bib++),
      'No',
      '',
      'Emergency Contact',          // emergency_name (PII — stripped)
      '5550000001',                 // emergency_phone (PII — stripped)
      String(config.statementId),
      discount.toFixed(4),
      '0.00',
      usFee.toFixed(2),
      total.toFixed(2),
      '',
      isDropping ? 'Dropping from the Race' : '',
    ].map(csvField);

    rows.push(fields.join(','));
  }

  return rows.join('\n');
}

export function getSampleRaceName(sampleId: string): string {
  return SAMPLE_CONFIGS[sampleId]?.raceName ?? sampleId;
}

export function isValidSampleId(sampleId: string): boolean {
  return Object.prototype.hasOwnProperty.call(SAMPLE_CONFIGS, sampleId);
}
