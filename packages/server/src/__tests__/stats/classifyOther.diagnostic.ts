/**
 * classifyOther.diagnostic.ts
 *
 * Read-only diagnostic script. Identifies which records land in the "other"
 * bucket of classifyParticipantStatus() and groups them by non-PII shape.
 *
 * Run with:
 *   npx tsx packages/server/src/__tests__/stats/classifyOther.diagnostic.ts
 *
 * GUARDRAILS:
 *   - Does NOT modify any production code.
 *   - Does NOT output any PII (no names, emails, addresses, DOB, phones).
 *   - Does NOT use any test framework.
 */

import Papa from 'papaparse';
import { generateCSV, isValidSampleId } from '../../sample/generator.js';
import { ultraSignupAdapter } from '../../adapters/ultrasignup.js';
import type { ParticipantRecord, ParticipantStatusCounts } from '../../types.js';

// ─── Replicated classifier logic (NOT modifying the original) ────────────────
// classifyParticipantStatus is NOT exported from stats/index.ts, so we
// replicate its exact decision tree here, isolated from production code.
// Keep in sync with packages/server/src/stats/index.ts.

const PAID_ORDER_TYPES = new Set(['credit card', 'paypal']);

function classifyParticipantStatus(p: ParticipantRecord): keyof ParticipantStatusCounts {
  if (p.isRelayJoin) return 'relayTeamMember';

  const orderType = p.orderType.trim().toLowerCase();
  const hasStatement = p.statementId !== '';

  if (orderType === 'pending cc') {
    return p.removed ? 'waitlistWithdrawnDeclined' : 'waitlistNeverInvited';
  }
  if (orderType === 'credit card' && hasStatement) {
    return p.removed ? 'creditCardDropped' : 'creditCardActive';
  }
  if (orderType === 'paypal' && hasStatement) {
    return p.removed ? 'paypalDropped' : 'paypalActive';
  }
  if (PAID_ORDER_TYPES.has(orderType) && !hasStatement) {
    return p.removed ? 'paymentPendingDropped' : 'paymentPendingActive';
  }
  if (orderType === '' && hasStatement) {
    return p.removed ? 'specialCaseA' : 'specialCaseB';
  }
  if ((orderType === '' || orderType === 'comp') && p.isComped) {
    return p.removed ? 'compedDropped' : 'compedActive';
  }
  if (orderType === '100% coupon') return p.removed ? 'couponDropped' : 'couponActive';
  if (orderType === 'gift card')   return p.removed ? 'giftCardDropped' : 'giftCardActive';
  return 'other';
}

// ─── Non-PII shape descriptor ─────────────────────────────────────────────────

interface RecordShape {
  orderType: string;          // raw orderType string (lowercased for grouping)
  removed: boolean;
  hasStatement: boolean;
  isComped: boolean;
  isRelayJoin: boolean;
  hasCoupon: boolean;
  droppingFromRace: boolean;
  isPendingCc: boolean;
  priceBucket: string;        // '0' | '1-50' | '51-100' | '101+'
  discountBucket: string;     // 'none' | 'partial' | 'full'
  orderTotalBucket: string;   // 'zero' | 'positive'
  isTeamCaptain: boolean;
  hasTeamName: boolean;
  event: string;              // safe — synthetic event name only
}

function priceBucket(price: number): string {
  if (price === 0) return '0';
  if (price <= 50) return '1-50';
  if (price <= 100) return '51-100';
  return '101+';
}

function discountBucket(isComped: boolean, hasCoupon: boolean): string {
  if (isComped) return 'full';
  if (hasCoupon) return 'partial';
  return 'none';
}

// We don't have price/discount/total as separate fields on ParticipantRecord —
// the adapter derives isComped and hasCoupon from the raw CSV. For bucketing
// purposes we use isComped as a proxy for full discount.
function shapeOf(p: ParticipantRecord): RecordShape {
  const orderType = p.orderType.toLowerCase();
  return {
    orderType,
    removed: p.removed,
    hasStatement: p.statementId !== '',
    isComped: p.isComped,
    isRelayJoin: p.isRelayJoin,
    hasCoupon: p.hasCoupon,
    droppingFromRace: p.droppingFromRace,
    isPendingCc: orderType === 'pending cc',
    // Price and totals are not on ParticipantRecord; we use isComped/hasCoupon
    // as proxy for discount bucket. Price bucket is unknown post-parse.
    priceBucket: 'unknown (stripped at parse)',
    discountBucket: discountBucket(p.isComped, p.hasCoupon),
    orderTotalBucket: p.isComped ? 'zero' : 'positive',
    isTeamCaptain: p.isTeamCaptain,
    hasTeamName: p.teamName !== '',
    event: p.event,
  };
}

function shapeKey(s: RecordShape): string {
  return [
    `orderType=${JSON.stringify(s.orderType)}`,
    `removed=${s.removed}`,
    `hasStatement=${s.hasStatement}`,
    `isComped=${s.isComped}`,
    `isRelayJoin=${s.isRelayJoin}`,
    `hasCoupon=${s.hasCoupon}`,
    `droppingFromRace=${s.droppingFromRace}`,
    `discountBucket=${s.discountBucket}`,
    `orderTotalBucket=${s.orderTotalBucket}`,
    `isTeamCaptain=${s.isTeamCaptain}`,
    `hasTeamName=${s.hasTeamName}`,
    `event=${JSON.stringify(s.event)}`,
  ].join(', ');
}

// ─── CSV parsing ──────────────────────────────────────────────────────────────

function parseSampleToRecords(sampleId: string): ParticipantRecord[] {
  const csv = generateCSV(sampleId);
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const records: ParticipantRecord[] = [];
  for (const row of result.data) {
    const record = ultraSignupAdapter.transform(row);
    if (record !== null) records.push(record);
  }
  return records;
}

// ─── Category resemblance heuristic ──────────────────────────────────────────

function mostResembles(shape: RecordShape): string {
  const ot = shape.orderType;
  if (ot === 'comp' || ot === 'comped') return 'compedActive / compedDropped';
  if (ot === 'stripe' || ot === 'check') return 'creditCardActive / creditCardDropped (or new processor field)';
  if (ot === 'free' || ot === 'volunteer') return 'compedActive / compedDropped';
  if (ot === '') {
    if (!shape.hasStatement && shape.isComped) return 'compedActive / compedDropped';
    if (!shape.hasStatement && !shape.isComped) return 'compedActive (zero-price non-comped edge case)';
  }
  return 'unknown — needs manual review';
}

// ─── Main diagnostic ──────────────────────────────────────────────────────────

(async () => {
  const SAMPLE_IDS = [
    'mountain-endurance-2024',
    'white-mountains-2024',
    'pinecrest-5k-2024',
  ];

  // Validate all IDs first
  for (const id of SAMPLE_IDS) {
    if (!isValidSampleId(id)) {
      console.error(`ERROR: Unknown sample ID: ${id}`);
      process.exit(1);
    }
  }

  console.log('='.repeat(72));
  console.log('  classifyParticipantStatus() — "other" bucket diagnostic');
  console.log('  Diagnostic-only. No PII. No production code modified.');
  console.log('='.repeat(72));
  console.log();

  // Aggregate pattern table across all samples
  const globalPatterns = new Map<string, { count: number; shape: RecordShape; sampleIds: Set<string> }>();

  for (const sampleId of SAMPLE_IDS) {
    console.log(`── Sample: ${sampleId} ${'─'.repeat(Math.max(0, 60 - sampleId.length))}`);

    const records = parseSampleToRecords(sampleId);
    const total = records.length;

    // Tally every status category
    const categoryCounts: Record<string, number> = {};
    const otherRecords: ParticipantRecord[] = [];

    for (const p of records) {
      const cat = classifyParticipantStatus(p);
      categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
      if (cat === 'other') otherRecords.push(p);
    }

    const otherCount = otherRecords.length;
    const otherPct = total > 0 ? ((otherCount / total) * 100).toFixed(1) : '0.0';

    console.log(`  Total records  : ${total}`);
    console.log(`  "other" count  : ${otherCount} (${otherPct}%)`);
    console.log();

    // Full category breakdown
    console.log('  All category counts:');
    const cats = Object.entries(categoryCounts).sort(([, a], [, b]) => b - a);
    for (const [cat, count] of cats) {
      const pct = ((count / total) * 100).toFixed(1);
      const marker = cat === 'other' ? '  <<< FOCUS' : '';
      console.log(`    ${cat.padEnd(30)} ${String(count).padStart(4)}  (${pct}%)${marker}`);
    }
    console.log();

    if (otherCount === 0) {
      console.log('  No "other" records in this sample.');
      console.log();
      continue;
    }

    // Group by non-PII shape
    const patternMap = new Map<string, { count: number; shape: RecordShape }>();
    for (const p of otherRecords) {
      const shape = shapeOf(p);
      const key = shapeKey(shape);
      const existing = patternMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        patternMap.set(key, { count: 1, shape });
      }

      // Also accumulate into global map
      const gExisting = globalPatterns.get(key);
      if (gExisting) {
        gExisting.count++;
        gExisting.sampleIds.add(sampleId);
      } else {
        globalPatterns.set(key, { count: 1, shape, sampleIds: new Set([sampleId]) });
      }
    }

    console.log(`  "other" patterns (${patternMap.size} distinct):`);
    const sorted = [...patternMap.entries()].sort(([, a], [, b]) => b.count - a.count);
    for (const [key, { count, shape }] of sorted) {
      const pct = ((count / otherCount) * 100).toFixed(1);
      console.log();
      console.log(`    Pattern (count=${count}, ${pct}% of other):`);
      console.log(`      ${key}`);
      console.log(`      most resembles: ${mostResembles(shape)}`);
    }
    console.log();
  }

  // ── Global cross-sample summary ────────────────────────────────────────────
  console.log('='.repeat(72));
  console.log('  GLOBAL PATTERN SUMMARY (all samples combined)');
  console.log('='.repeat(72));
  console.log();

  if (globalPatterns.size === 0) {
    console.log('  No "other" records found in any sample dataset.');
    console.log();
  } else {
    const totalOther = [...globalPatterns.values()].reduce((s, v) => s + v.count, 0);
    console.log(`  Total "other" records across all samples: ${totalOther}`);
    console.log(`  Distinct patterns: ${globalPatterns.size}`);
    console.log();

    const globalSorted = [...globalPatterns.entries()].sort(([, a], [, b]) => b.count - a.count);
    let patternIdx = 1;
    for (const [, { count, shape, sampleIds }] of globalSorted) {
      const pct = ((count / totalOther) * 100).toFixed(1);
      console.log(`  Pattern #${patternIdx++}`);
      console.log(`    count          : ${count} (${pct}% of all "other")`);
      console.log(`    present in     : ${[...sampleIds].join(', ')}`);
      console.log(`    orderType      : ${JSON.stringify(shape.orderType)}`);
      console.log(`    removed        : ${shape.removed}`);
      console.log(`    hasStatement   : ${shape.hasStatement}`);
      console.log(`    isComped       : ${shape.isComped}`);
      console.log(`    isRelayJoin    : ${shape.isRelayJoin}`);
      console.log(`    hasCoupon      : ${shape.hasCoupon}`);
      console.log(`    droppingFromRace: ${shape.droppingFromRace}`);
      console.log(`    discountBucket : ${shape.discountBucket}`);
      console.log(`    orderTotalBucket: ${shape.orderTotalBucket}`);
      console.log(`    isTeamCaptain  : ${shape.isTeamCaptain}`);
      console.log(`    hasTeamName    : ${shape.hasTeamName}`);
      console.log(`    event          : ${JSON.stringify(shape.event)}`);
      console.log(`    most resembles : ${mostResembles(shape)}`);
      console.log();
    }
  }

  // ── Classifier gap analysis ────────────────────────────────────────────────
  console.log('='.repeat(72));
  console.log('  CLASSIFIER GAP ANALYSIS');
  console.log('='.repeat(72));
  console.log();
  console.log('  Classifier handles these orderType values (lowercased):');
  console.log('    ""           (blank)     → compedActive/compedDropped/specialCaseA/specialCaseB');
  console.log('    "credit card" + stmt     → creditCardActive/creditCardDropped');
  console.log('    "credit card" no stmt   → paymentPendingActive/paymentPendingDropped');
  console.log('    "paypal" + stmt         → paypalActive/paypalDropped');
  console.log('    "paypal" no stmt        → paymentPendingActive/paymentPendingDropped');
  console.log('    "comp"                  → compedActive/compedDropped');
  console.log('    "pending cc"            → waitlistNeverInvited/waitlistWithdrawnDeclined');
  console.log('    "100% coupon"           → couponActive/couponDropped');
  console.log('    "gift card"             → giftCardActive/giftCardDropped');
  console.log('    isRelayJoin=true        → relayTeamMember (checked first, before orderType)');
  console.log();
  console.log('  Sample generator produces these orderType values:');
  console.log('    "Credit Card"  (85% of non-comped) → maps to "credit card" ✓');
  console.log('    "PayPal"       (15% of non-comped) → maps to "paypal" ✓');
  console.log('    "Comp"         (comped entries)    → maps to "comp" ✓');
  console.log();
  console.log('  NOTE: This is diagnostic only. No production code is modified by running this script.');
  console.log();
})();
