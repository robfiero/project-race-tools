import { describe, it, expect } from 'vitest';
import { computeResultsStats, formatTime } from '../../stats/results.js';
import { generateResultsCSV, RESULTS_SAMPLE_CONFIGS } from '../../sample/resultsGenerator.js';
import { makeResultRecord, makeResultRecords } from '../helpers.js';
import type { ResultRecord } from '../../types.js';

// ─── formatTime ────────────────────────────────────────────────────────────────

describe('formatTime', () => {
  it('formats 0 seconds as 0:00:00', () => expect(formatTime(0)).toBe('0:00:00'));
  it('formats exactly 1 hour', () => expect(formatTime(3600)).toBe('1:00:00'));
  it('formats 1 hour 1 minute 1 second', () => expect(formatTime(3661)).toBe('1:01:01'));
  it('formats 90 seconds as 0:01:30', () => expect(formatTime(90)).toBe('0:01:30'));
  it('pads single-digit minutes', () => expect(formatTime(3660)).toBe('1:01:00'));
  it('pads single-digit seconds', () => expect(formatTime(3601)).toBe('1:00:01'));
  it('handles 10+ hours without padding', () => expect(formatTime(36000)).toBe('10:00:00'));
  it('handles 24-hour race time', () => expect(formatTime(86400)).toBe('24:00:00'));
  it('handles 100-hour endurance time', () => expect(formatTime(360000)).toBe('100:00:00'));
  it('handles 59 minutes 59 seconds', () => expect(formatTime(3599)).toBe('0:59:59'));
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build n records that can each be independently overridden. */
function recs(n: number, overrides: Partial<ResultRecord> = {}): ResultRecord[] {
  return makeResultRecords(n, overrides);
}

/** Single finisher convenience. */
function finisher(overrides: Partial<ResultRecord> = {}): ResultRecord {
  return makeResultRecord({ finishStatus: 1, ...overrides });
}

// ─── Empty results ─────────────────────────────────────────────────────────────

describe('computeResultsStats — empty results', () => {
  const s = computeResultsStats([]);

  it('totalEntrants is 0', () => expect(s.summary.totalEntrants).toBe(0));
  it('finishers is 0', () => expect(s.summary.finishers).toBe(0));
  it('dnf is 0', () => expect(s.summary.dnf).toBe(0));
  it('dns is 0', () => expect(s.summary.dns).toBe(0));
  it('finishRate is 0', () => expect(s.summary.finishRate).toBe(0));
  it('dnfRate is 0', () => expect(s.summary.dnfRate).toBe(0));
  it('produces at least one summary event entry', () => {
    expect(s.summary.events.length).toBeGreaterThanOrEqual(1);
  });
  it('performance has no finish time data', () => {
    expect(s.performance.events[0]?.finishTime).toBeNull();
  });
  it('geographic usParticipants is 0', () => {
    expect(s.geographic.usParticipants).toBe(0);
  });
  it('attrition overall total is 0', () => {
    expect(s.attrition.overall.total).toBe(0);
  });
  it('attrition always includes M/F/NB gender rows', () => {
    const names = s.attrition.byGender.map(r => r.name);
    expect(names).toContain('Male');
    expect(names).toContain('Female');
    expect(names).toContain('Non-Binary');
  });
});

// ─── Summary stats ─────────────────────────────────────────────────────────────

describe('computeResultsStats — summary counts', () => {
  // 6 finish, 2 DNF, 1 DNS, 1 unofficial — 10 total, 9 starters
  const results = [
    ...recs(6, { finishStatus: 1, distanceMiles: 50, timeSeconds: 14400 }),
    ...recs(2, { finishStatus: 2, distanceMiles: null, timeSeconds: null }),
    ...recs(1, { finishStatus: 3, distanceMiles: null, timeSeconds: null }),
    ...recs(1, { finishStatus: 4, distanceMiles: 50, timeSeconds: 18000 }),
  ].map((r, i) => ({ ...r, bib: String(i) }));

  const s = computeResultsStats(results).summary;

  it('totalEntrants counts all records', () => expect(s.totalEntrants).toBe(10));
  it('finishers includes both status-1 and unofficial (status-4)', () => expect(s.finishers).toBe(7));
  it('dnf counts only status-2', () => expect(s.dnf).toBe(2));
  it('dns counts only status-3', () => expect(s.dns).toBe(1));
  it('unofficial is tracked separately', () => expect(s.unofficial).toBe(1));
  it('finishRate excludes DNS from denominator', () => {
    // pct(7, 9) = round(7/9 * 1000) / 10 = round(777.8) / 10 = 77.8
    expect(s.finishRate).toBe(77.8);
  });
  it('dnfRate excludes DNS from denominator', () => {
    // pct(2, 9) = round(222.2) / 10 = 22.2
    expect(s.dnfRate).toBe(22.2);
  });
});

describe('computeResultsStats — all DNS', () => {
  const s = computeResultsStats(recs(5, { finishStatus: 3, timeSeconds: null, distanceMiles: null })).summary;

  it('totalEntrants is 5', () => expect(s.totalEntrants).toBe(5));
  it('finishers is 0', () => expect(s.finishers).toBe(0));
  it('finishRate is 0 (no starters)', () => expect(s.finishRate).toBe(0));
  it('dnfRate is 0 (no starters)', () => expect(s.dnfRate).toBe(0));
});

describe('computeResultsStats — all finishers, no DNS or DNF', () => {
  const s = computeResultsStats(
    recs(5, { finishStatus: 1, distanceMiles: 50, timeSeconds: 14400 }),
  ).summary;

  it('finishRate is 100', () => expect(s.finishRate).toBe(100));
  it('dnfRate is 0', () => expect(s.dnfRate).toBe(0));
  it('dns is 0', () => expect(s.dns).toBe(0));
});

describe('computeResultsStats — DQ and below-threshold statuses', () => {
  const results = [
    ...recs(3, { finishStatus: 1, distanceMiles: 50, timeSeconds: 14400 }),
    makeResultRecord({ bib: 'dq1', finishStatus: 5, distanceMiles: null, timeSeconds: null }),
    makeResultRecord({ bib: 'bt1', finishStatus: 6, distanceMiles: null, timeSeconds: null }),
  ];
  const s = computeResultsStats(results).summary;

  it('totalEntrants includes DQ and below-threshold', () => expect(s.totalEntrants).toBe(5));
  it('finishers does not count DQ or below-threshold', () => expect(s.finishers).toBe(3));
  it('dq is tracked on summary', () => expect(s.dq).toBe(1));
  it('belowThreshold is tracked on summary', () => expect(s.belowThreshold).toBe(1));
});

// ─── Event group detection ─────────────────────────────────────────────────────

describe('computeResultsStats — event group detection', () => {
  it('detects a single fixed-distance event when ≥3 finishers share the same rounded mileage', () => {
    const s = computeResultsStats(recs(5, { finishStatus: 1, distanceMiles: 50 }));
    expect(s.performance.events).toHaveLength(1);
    expect(s.performance.events[0].eventType).toBe('fixed-distance');
    expect(s.performance.events[0].eventName).toBe('50 mi');
  });

  it('detects a fixed-time event when finisher distances are all unique (no cluster ≥3)', () => {
    const results = [45, 47, 49, 51, 53].map((d, i) =>
      makeResultRecord({ bib: String(i), finishStatus: 1, distanceMiles: d, timeSeconds: null }),
    );
    const s = computeResultsStats(results);
    expect(s.performance.events[0].eventType).toBe('fixed-time');
  });

  it('detects two events when two distance clusters each have ≥3 finishers', () => {
    const results = [
      ...recs(4, { finishStatus: 1, distanceMiles: 50, timeSeconds: 18000 }),
      ...recs(3, { finishStatus: 1, distanceMiles: 25, timeSeconds: 9000 }),
    ].map((r, i) => ({ ...r, bib: String(i) }));
    const s = computeResultsStats(results);
    expect(s.performance.events).toHaveLength(2);
    // Sorted descending by distance
    expect(s.performance.events[0].eventName).toBe('50 mi');
    expect(s.performance.events[1].eventName).toBe('25 mi');
  });

  it('falls back to a single "Event" group when no finishers have distance data', () => {
    const results = recs(5, { finishStatus: 1, distanceMiles: null, timeSeconds: 14400 });
    const s = computeResultsStats(results);
    expect(s.performance.events).toHaveLength(1);
    expect(s.performance.events[0].eventName).toBe('Event');
  });

  it('strips UltraSignup sort-hack fractions when grouping distances (50.001 → 50)', () => {
    const results = recs(4, { finishStatus: 1, distanceMiles: 50.001, timeSeconds: 14400 });
    const s = computeResultsStats(results);
    expect(s.performance.events[0].eventName).toBe('50 mi');
  });

  it('assigns DNS and DNF records to the dominant event group', () => {
    const results = [
      ...recs(4, { finishStatus: 1, distanceMiles: 50, timeSeconds: 18000 }),
      makeResultRecord({ bib: 'd1', finishStatus: 2, distanceMiles: null, timeSeconds: null }),
      makeResultRecord({ bib: 'd2', finishStatus: 3, distanceMiles: null, timeSeconds: null }),
    ];
    const s = computeResultsStats(results);
    expect(s.summary.events[0].totalEntrants).toBe(6);
  });

  it('summary event gender counts use all entrants, including DNS and DNF', () => {
    const results = [
      makeResultRecord({ bib: '1', finishStatus: 1, gender: 'M', distanceMiles: 50, timeSeconds: 18000 }),
      makeResultRecord({ bib: '2', finishStatus: 1, gender: 'F', distanceMiles: 50, timeSeconds: 19000 }),
      makeResultRecord({ bib: '3', finishStatus: 1, gender: 'NB', distanceMiles: 50, timeSeconds: 20000 }),
      makeResultRecord({ bib: '4', finishStatus: 2, gender: 'NB', distanceMiles: 50, timeSeconds: null }),
      makeResultRecord({ bib: '5', finishStatus: 3, gender: 'F', distanceMiles: 50, timeSeconds: null }),
    ];
    const eventGender = computeResultsStats(results).summary.events[0].gender;

    expect(eventGender.male).toBe(1);
    expect(eventGender.female).toBe(2);
    expect(eventGender.nonBinary).toBe(2);
  });

  it('summary event participant age range uses all event entrants, not only finishers', () => {
    const results = [
      makeResultRecord({ bib: '1', age: 35, finishStatus: 1, distanceMiles: 50, timeSeconds: 18000 }),
      makeResultRecord({ bib: '2', age: 42, finishStatus: 1, distanceMiles: 50, timeSeconds: 19000 }),
      makeResultRecord({ bib: '3', age: 50, finishStatus: 1, distanceMiles: 50, timeSeconds: 20000 }),
      makeResultRecord({ bib: '4', age: 18, finishStatus: 3, distanceMiles: 50, timeSeconds: null }),
      makeResultRecord({ bib: '5', age: 65, finishStatus: 2, distanceMiles: 50, timeSeconds: null }),
    ];
    const eventAge = computeResultsStats(results).summary.events[0].participantAge;

    expect(eventAge.min).toBe(18);
    expect(eventAge.max).toBe(65);
  });

  it('summary event participant age range stays scoped to each event and ignores missing ages', () => {
    const stats = computeResultsStats([
      makeResultRecord({ bib: '1', age: 30, finishStatus: 1, distanceMiles: 50, timeSeconds: 18000 }),
      makeResultRecord({ bib: '2', age: 45, finishStatus: 1, distanceMiles: 50, timeSeconds: 19000 }),
      makeResultRecord({ bib: '3', age: null, finishStatus: 1, distanceMiles: 50, timeSeconds: 20000 }),
      makeResultRecord({ bib: '4', age: 20, finishStatus: 1, distanceMiles: 25, timeSeconds: 9000 }),
      makeResultRecord({ bib: '5', age: 24, finishStatus: 1, distanceMiles: 25, timeSeconds: 10000 }),
      makeResultRecord({ bib: '6', age: null, finishStatus: 1, distanceMiles: 25, timeSeconds: 11000 }),
    ]);

    const event50 = stats.summary.events.find(e => e.name === '50 mi')!.participantAge;
    const event25 = stats.summary.events.find(e => e.name === '25 mi')!.participantAge;

    expect(event50.min).toBe(30);
    expect(event50.max).toBe(45);
    expect(event25.min).toBe(20);
    expect(event25.max).toBe(24);
  });

  it('computes field depth bands for each event with enough finishers', () => {
    const results = [
      ...recs(5, { finishStatus: 1, distanceMiles: 50, timeSeconds: 18000 }),
      ...recs(5, { finishStatus: 1, distanceMiles: 100, timeSeconds: 36000 }),
    ].map((r, i) => ({ ...r, bib: String(i) }));
    const pb = computeResultsStats(results).performanceBands!;
    expect(pb.events.map(e => e.eventName)).toEqual(['100 mi', '50 mi']);
    expect(pb.events.every(e => e.rows.length > 0)).toBe(true);
  });
});

// ─── Performance: fixed-distance finish time stats ─────────────────────────────

describe('computeResultsStats — performance (fixed-distance finish times)', () => {
  // 3 male finishers: 4h, 4.5h, 5h; 1 female finisher: 5.5h; 1 NB finisher: 6h
  const results = [
    makeResultRecord({ bib: '1', finishStatus: 1, gender: 'M', distanceMiles: 50, timeSeconds: 14400 }),
    makeResultRecord({ bib: '2', finishStatus: 1, gender: 'M', distanceMiles: 50, timeSeconds: 16200 }),
    makeResultRecord({ bib: '3', finishStatus: 1, gender: 'M', distanceMiles: 50, timeSeconds: 18000 }),
    makeResultRecord({ bib: '4', finishStatus: 1, gender: 'F', distanceMiles: 50, timeSeconds: 19800 }),
    makeResultRecord({ bib: '5', finishStatus: 1, gender: 'NB', distanceMiles: 50, timeSeconds: 21600 }),
  ];
  const perf = computeResultsStats(results).performance.events[0];
  const ft = perf.finishTime!;

  it('eventType is fixed-distance', () => expect(perf.eventType).toBe('fixed-distance'));
  it('distanceAchieved is null for fixed-distance', () => expect(perf.distanceAchieved).toBeNull());
  it('fastestSeconds is the minimum time', () => expect(ft.fastestSeconds).toBe(14400));
  it('slowestSeconds is the maximum time', () => expect(ft.slowestSeconds).toBe(21600));
  it('medianSeconds is the middle value', () => expect(ft.medianSeconds).toBe(18000));
  it('meanSeconds is the average', () => {
    const avg = Math.round((14400 + 16200 + 18000 + 19800 + 21600) / 5);
    expect(ft.meanSeconds).toBe(avg);
  });
  it('produces 5 percentile entries', () => expect(ft.percentiles).toHaveLength(5));
  it('50th percentile matches median', () => {
    const p50 = ft.percentiles.find(p => p.label === '50th');
    expect(p50?.seconds).toBe(ft.medianSeconds);
  });
  it('10th percentile is <= median', () => {
    const p10 = ft.percentiles.find(p => p.label === '10th');
    expect(p10?.seconds).toBeLessThanOrEqual(ft.medianSeconds);
  });
  it('90th percentile is >= median', () => {
    const p90 = ft.percentiles.find(p => p.label === '90th');
    expect(p90?.seconds).toBeGreaterThanOrEqual(ft.medianSeconds);
  });
  it('produces histogram buckets', () => expect(ft.buckets.length).toBeGreaterThan(0));
  it('bucket totals sum to total finisher count', () => {
    const total = ft.buckets.reduce((s, b) => s + b.total, 0);
    expect(total).toBe(5);
  });
  it('byGender includes M row', () => {
    const m = ft.byGender.find(g => g.gender === 'M')!;
    expect(m.finishers).toBe(3);
    expect(m.fastestSeconds).toBe(14400);
    expect(m.slowestSeconds).toBe(18000);
    expect(m.medianSeconds).toBe(16200);
    expect(m.meanSeconds).toBe(16200);
  });
  it('byGender includes F row', () => {
    const f = ft.byGender.find(g => g.gender === 'F')!;
    expect(f.finishers).toBe(1);
    expect(f.fastestSeconds).toBe(19800);
    expect(f.slowestSeconds).toBe(19800);
    expect(f.medianSeconds).toBe(19800);
  });
  it('byGender includes NB row', () => {
    const nb = ft.byGender.find(g => g.gender === 'NB')!;
    expect(nb.finishers).toBe(1);
    expect(nb.fastestSeconds).toBe(21600);
  });
  it('byGender excludes genders with no finishers (Unknown absent)', () => {
    expect(ft.byGender.find(g => g.gender === 'Unknown')).toBeUndefined();
  });

  it('DNF records are excluded from finish time stats', () => {
    const withDnf = [
      ...results,
      makeResultRecord({ bib: 'dnf1', finishStatus: 2, distanceMiles: 50, timeSeconds: 10000 }),
    ];
    const ft2 = computeResultsStats(withDnf).performance.events[0].finishTime!;
    expect(ft2.fastestSeconds).toBe(14400); // DNF's faster time excluded
  });
});

describe('computeResultsStats — performance (single finisher with distance)', () => {
  // With only 1 finisher, detectEventGroups finds no cluster of ≥3 at any distance
  // and therefore classifies the event as fixed-time (not fixed-distance).
  // finishTime is null for fixed-time events; distanceAchieved is populated instead.
  const results = [makeResultRecord({ bib: '1', finishStatus: 1, distanceMiles: 50, timeSeconds: 14400 })];
  const perf = computeResultsStats(results).performance.events[0];

  it('single finisher without a ≥3 distance cluster is classified as fixed-time', () => {
    expect(perf.eventType).toBe('fixed-time');
  });
  it('finishTime is null for a fixed-time event', () => expect(perf.finishTime).toBeNull());
  it('distanceAchieved medianMiles equals the only distance', () => {
    expect(perf.distanceAchieved?.medianMiles).toBe(50);
  });
  it('distanceAchieved maxMiles equals the only distance', () => {
    expect(perf.distanceAchieved?.maxMiles).toBe(50);
  });
  it('produces a single histogram bucket in distanceAchieved', () => {
    expect(perf.distanceAchieved?.buckets).toHaveLength(1);
  });
});

// ─── Performance: fixed-time distance achieved ─────────────────────────────────

describe('computeResultsStats — performance (fixed-time distance achieved)', () => {
  // Varied distances → no cluster → fixed-time event
  const results = [
    makeResultRecord({ bib: '1', finishStatus: 1, distanceMiles: 45, timeSeconds: null, gender: 'M' }),
    makeResultRecord({ bib: '2', finishStatus: 1, distanceMiles: 47, timeSeconds: null, gender: 'F' }),
    makeResultRecord({ bib: '3', finishStatus: 1, distanceMiles: 49, timeSeconds: null, gender: 'M' }),
    makeResultRecord({ bib: '4', finishStatus: 1, distanceMiles: 51, timeSeconds: null, gender: 'F' }),
    makeResultRecord({ bib: '5', finishStatus: 1, distanceMiles: 53, timeSeconds: null, gender: 'NB' }),
  ];
  const perf = computeResultsStats(results).performance.events[0];
  const da = perf.distanceAchieved!;

  it('eventType is fixed-time', () => expect(perf.eventType).toBe('fixed-time'));
  it('finishTime is null for fixed-time', () => expect(perf.finishTime).toBeNull());
  it('medianMiles is the middle value', () => expect(da.medianMiles).toBe(49));
  it('maxMiles is the farthest distance', () => expect(da.maxMiles).toBe(53));
  it('produces percentile entries', () => expect(da.percentiles.length).toBeGreaterThan(0));
  it('byGender includes M and F rows', () => {
    expect(da.byGender.find(g => g.gender === 'M')).toBeDefined();
    expect(da.byGender.find(g => g.gender === 'F')).toBeDefined();
  });
  it('byGender M has correct maxMiles', () => {
    const m = da.byGender.find(g => g.gender === 'M')!;
    expect(m.maxMiles).toBe(49); // M finishers at 45 and 49
  });
  it('byGender M has correct minMiles', () => {
    const m = da.byGender.find(g => g.gender === 'M')!;
    expect(m.minMiles).toBe(45);
  });
});

// ─── Demographics ──────────────────────────────────────────────────────────────

describe('computeResultsStats — demographics gender', () => {
  // 4M, 3F, 1NB, 0 unknown = 8 total
  const results = [
    ...recs(4, { finishStatus: 1, gender: 'M', distanceMiles: 50 }),
    ...recs(3, { finishStatus: 1, gender: 'F', distanceMiles: 50 }),
    makeResultRecord({ bib: 'nb1', finishStatus: 1, gender: 'NB', distanceMiles: 50 }),
  ].map((r, i) => ({ ...r, bib: String(i) }));

  const demo = computeResultsStats(results).demographics;

  it('overall gender.male is 4', () => expect(demo.gender.male).toBe(4));
  it('overall gender.female is 3', () => expect(demo.gender.female).toBe(3));
  it('overall gender.nonBinary is 1', () => expect(demo.gender.nonBinary).toBe(1));
  it('malePercent rounds to 1 decimal', () => expect(demo.gender.malePercent).toBe(50.0));
  it('femalePercent rounds to 1 decimal', () => expect(demo.gender.femalePercent).toBe(37.5));
  it('nonBinaryPercent rounds to 1 decimal', () => expect(demo.gender.nonBinaryPercent).toBe(12.5));

  it('finisherGender only counts finishers, not DNS/DNF', () => {
    const withDnf = [
      ...results,
      makeResultRecord({ bib: 'dnf1', finishStatus: 2, gender: 'F', distanceMiles: null }),
    ];
    const demo2 = computeResultsStats(withDnf).demographics;
    // finisherGender.female should not include the DNF
    expect(demo2.finisherGender.female).toBe(3);
  });
});

describe('computeResultsStats — demographics age', () => {
  const ages = [25, 32, 40, 45, 55];
  const results = ages.map((age, i) =>
    makeResultRecord({ bib: String(i), age, finishStatus: 1, distanceMiles: 50 }),
  );
  const stats = computeResultsStats(results).demographics;

  it('min age is the youngest', () => expect(stats.age.min).toBe(25));
  it('max age is the oldest', () => expect(stats.age.max).toBe(55));
  it('median age is the middle value', () => expect(stats.age.median).toBe(40));
  it('mean age is the average', () => {
    const avg = Math.round((25 + 32 + 40 + 45 + 55) / 5 * 10) / 10;
    expect(stats.age.mean).toBe(avg);
  });
  it('produces age bucket entries', () => expect(stats.age.buckets.length).toBeGreaterThan(0));
  it('age buckets account for all participants', () => {
    const total = stats.age.buckets.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(5);
  });

  it('handles null ages gracefully (excluded from stats)', () => {
    const withNullAge = [
      ...results,
      makeResultRecord({ bib: 'x', age: null, finishStatus: 1, distanceMiles: 50 }),
    ];
    const s = computeResultsStats(withNullAge).demographics;
    expect(s.age.min).toBe(25); // null excluded
    expect(s.age.max).toBe(55);
  });

  it('age stats are null when all ages are null', () => {
    const noAgeResults = recs(3, { age: null, finishStatus: 1, distanceMiles: 50 });
    const s = computeResultsStats(noAgeResults).demographics;
    expect(s.age.min).toBeNull();
    expect(s.age.max).toBeNull();
    expect(s.age.median).toBeNull();
  });
});

describe('computeResultsStats — ageDistributionByEvent', () => {
  it('scopes finisher age stats to each fixed-distance event', () => {
    const stats = computeResultsStats([
      finisher({ bib: '1', age: 30, distanceMiles: 50, timeSeconds: 18000 }),
      finisher({ bib: '2', age: 40, distanceMiles: 50, timeSeconds: 19000 }),
      finisher({ bib: '3', age: 50, distanceMiles: 50, timeSeconds: 20000 }),
      makeResultRecord({ bib: '4', age: 70, distanceMiles: 50, timeSeconds: null, finishStatus: 2 }),
      finisher({ bib: '5', age: 20, distanceMiles: 25, timeSeconds: 9000 }),
      finisher({ bib: '6', age: 22, distanceMiles: 25, timeSeconds: 10000 }),
      finisher({ bib: '7', age: 24, distanceMiles: 25, timeSeconds: 11000 }),
      makeResultRecord({ bib: '8', age: 80, distanceMiles: 25, timeSeconds: null, finishStatus: 3 }),
    ]);

    expect(stats.ageDistributionByEvent.map(e => e.eventName)).toEqual(['50 mi', '25 mi']);
    expect(stats.ageDistributionByEvent.map(e => e.eventType)).toEqual(['fixed-distance', 'fixed-distance']);

    const event50 = stats.ageDistributionByEvent.find(e => e.eventName === '50 mi')!.finisherAge;
    const event25 = stats.ageDistributionByEvent.find(e => e.eventName === '25 mi')!.finisherAge;

    expect(event50.min).toBe(30);
    expect(event50.max).toBe(50);
    expect(event50.median).toBe(40);
    expect(event50.mean).toBe(40);
    expect(event50.buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(3);

    expect(event25.min).toBe(20);
    expect(event25.max).toBe(24);
    expect(event25.median).toBe(22);
    expect(event25.mean).toBe(22);
    expect(event25.buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(3);
  });

  it('preserves top-level finisher age as overall while by-event entries stay event-scoped', () => {
    const stats = computeResultsStats([
      finisher({ bib: '1', age: 30, distanceMiles: 50, timeSeconds: 18000 }),
      finisher({ bib: '2', age: 40, distanceMiles: 50, timeSeconds: 19000 }),
      finisher({ bib: '3', age: 50, distanceMiles: 50, timeSeconds: 20000 }),
      finisher({ bib: '4', age: 20, distanceMiles: 25, timeSeconds: 9000 }),
      finisher({ bib: '5', age: 22, distanceMiles: 25, timeSeconds: 10000 }),
      finisher({ bib: '6', age: 24, distanceMiles: 25, timeSeconds: 11000 }),
    ]);

    expect(stats.demographics.finisherAge.min).toBe(20);
    expect(stats.demographics.finisherAge.max).toBe(50);
    expect(stats.demographics.finisherAge.median).toBe(27);
    expect(stats.ageDistributionByEvent.find(e => e.eventName === '50 mi')!.finisherAge.min).toBe(30);
    expect(stats.ageDistributionByEvent.find(e => e.eventName === '25 mi')!.finisherAge.max).toBe(24);
  });

  it('aligns ageDistributionByEvent event names with performance events', () => {
    const stats = computeResultsStats([
      finisher({ bib: '1', age: 30, distanceMiles: 50, timeSeconds: 18000 }),
      finisher({ bib: '2', age: 40, distanceMiles: 50, timeSeconds: 19000 }),
      finisher({ bib: '3', age: 50, distanceMiles: 50, timeSeconds: 20000 }),
      finisher({ bib: '4', age: 20, distanceMiles: 25, timeSeconds: 9000 }),
      finisher({ bib: '5', age: 22, distanceMiles: 25, timeSeconds: 10000 }),
      finisher({ bib: '6', age: 24, distanceMiles: 25, timeSeconds: 11000 }),
    ]);

    expect(stats.ageDistributionByEvent.map(e => e.eventName)).toEqual(
      stats.performance.events.map(e => e.eventName),
    );
  });

  it('excludes missing ages consistently with overall finisher age stats', () => {
    const stats = computeResultsStats([
      finisher({ bib: '1', age: 35, distanceMiles: 50, timeSeconds: 18000 }),
      finisher({ bib: '2', age: null, distanceMiles: 50, timeSeconds: 19000 }),
      finisher({ bib: '3', age: 45, distanceMiles: 50, timeSeconds: 20000 }),
    ]);
    const eventAge = stats.ageDistributionByEvent[0].finisherAge;

    expect(eventAge.min).toBe(35);
    expect(eventAge.max).toBe(45);
    expect(eventAge.median).toBe(40);
    expect(eventAge.buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(2);
  });

  it('keeps an all-null-age event empty while other event ages remain scoped', () => {
    const stats = computeResultsStats([
      finisher({ bib: '1', age: null, distanceMiles: 50, timeSeconds: 18000 }),
      finisher({ bib: '2', age: null, distanceMiles: 50, timeSeconds: 19000 }),
      finisher({ bib: '3', age: null, distanceMiles: 50, timeSeconds: 20000 }),
      finisher({ bib: '4', age: 20, distanceMiles: 25, timeSeconds: 9000 }),
      finisher({ bib: '5', age: 22, distanceMiles: 25, timeSeconds: 10000 }),
      finisher({ bib: '6', age: 24, distanceMiles: 25, timeSeconds: 11000 }),
    ]);

    const event50 = stats.ageDistributionByEvent.find(e => e.eventName === '50 mi')!.finisherAge;
    const event25 = stats.ageDistributionByEvent.find(e => e.eventName === '25 mi')!.finisherAge;

    expect(event50.mean).toBeNull();
    expect(event50.median).toBeNull();
    expect(event50.min).toBeNull();
    expect(event50.max).toBeNull();
    expect(event50.buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(0);
    expect(event25.mean).toBe(22);
    expect(event25.median).toBe(22);
    expect(stats.demographics.finisherAge.mean).toBe(22);
  });

  it('emits fixed-time event-scoped finisher age stats', () => {
    const stats = computeResultsStats([
      finisher({ bib: '1', age: 31, distanceMiles: 41, timeSeconds: null }),
      finisher({ bib: '2', age: 35, distanceMiles: 44, timeSeconds: null }),
      finisher({ bib: '3', age: 39, distanceMiles: 47, timeSeconds: null }),
      finisher({ bib: '4', age: 43, distanceMiles: 50, timeSeconds: null }),
    ]);

    expect(stats.ageDistributionByEvent).toHaveLength(1);
    expect(stats.ageDistributionByEvent[0].eventType).toBe('fixed-time');
    expect(stats.ageDistributionByEvent[0].finisherAge.median).toBe(37);
    expect(stats.ageDistributionByEvent[0].finisherAge.mean).toBe(37);
  });
});

describe('computeResultsStats — demographics finisherAgeByGender', () => {
  const results = [
    makeResultRecord({ bib: '1', finishStatus: 1, gender: 'M', age: 30, distanceMiles: 50 }),
    makeResultRecord({ bib: '2', finishStatus: 1, gender: 'M', age: 40, distanceMiles: 50 }),
    makeResultRecord({ bib: '3', finishStatus: 1, gender: 'F', age: 35, distanceMiles: 50 }),
    makeResultRecord({ bib: '4', finishStatus: 1, gender: 'NB', age: 28, distanceMiles: 50 }),
  ];
  const byGender = computeResultsStats(results).demographics.finisherAgeByGender;

  it('includes M entry with correct min/max/median', () => {
    const m = byGender.find(g => g.gender === 'M')!;
    expect(m.min).toBe(30);
    expect(m.max).toBe(40);
    expect(m.median).toBe(35); // (30+40)/2 = 35
  });

  it('includes F entry', () => {
    const f = byGender.find(g => g.gender === 'F')!;
    expect(f.min).toBe(35);
    expect(f.max).toBe(35);
  });

  it('includes NB entry', () => {
    const nb = byGender.find(g => g.gender === 'NB')!;
    expect(nb.min).toBe(28);
  });

  it('excludes gender groups with no finishers with age data', () => {
    // NB finisher has no age → should be excluded
    const noNbAge = [
      makeResultRecord({ bib: '1', finishStatus: 1, gender: 'M', age: 35, distanceMiles: 50 }),
      makeResultRecord({ bib: '2', finishStatus: 1, gender: 'NB', age: null, distanceMiles: 50 }),
    ];
    const byG = computeResultsStats(noNbAge).demographics.finisherAgeByGender;
    expect(byG.find(g => g.gender === 'NB')).toBeUndefined();
  });
});

// ─── Geographic ────────────────────────────────────────────────────────────────

describe('computeResultsStats — geographic', () => {
  it('counts US participants correctly when country is USA', () => {
    const results = recs(5, { finishStatus: 1, state: 'MA', country: 'USA' });
    const g = computeResultsStats(results).geographic;
    expect(g.usParticipants).toBe(5);
    expect(g.internationalParticipants).toBe(0);
  });

  it('infers USA from a US state abbreviation when country is Unknown', () => {
    const results = [
      makeResultRecord({ bib: '1', state: 'NH', country: 'Unknown' }),
      makeResultRecord({ bib: '2', state: 'VT', country: 'Unknown' }),
    ];
    const g = computeResultsStats(results).geographic;
    expect(g.usParticipants).toBe(2);
  });

  it('infers CAN from a Canadian province abbreviation when country is Unknown', () => {
    const results = [
      makeResultRecord({ bib: '1', state: 'ON', country: 'Unknown' }),
      makeResultRecord({ bib: '2', state: 'BC', country: 'Unknown' }),
    ];
    const g = computeResultsStats(results).geographic;
    expect(g.byCountry['CAN']).toBe(2);
    expect(g.usParticipants).toBe(0);
  });

  it('uses explicit country over inference when country is set and not Unknown', () => {
    const results = [makeResultRecord({ bib: '1', state: 'ON', country: 'GBR' })];
    const g = computeResultsStats(results).geographic;
    expect(g.byCountry['GBR']).toBe(1);
    expect(g.byCountry['CAN']).toBeUndefined();
  });

  it('infers USA for DC (territory)', () => {
    const g = computeResultsStats([makeResultRecord({ bib: '1', state: 'DC', country: 'Unknown' })]).geographic;
    expect(g.usParticipants).toBe(1);
  });

  it('infers USA for PR (territory)', () => {
    const g = computeResultsStats([makeResultRecord({ bib: '1', state: 'PR', country: 'Unknown' })]).geographic;
    expect(g.usParticipants).toBe(1);
  });

  it('builds byState map correctly', () => {
    const results = [
      makeResultRecord({ bib: '1', state: 'MA' }),
      makeResultRecord({ bib: '2', state: 'MA' }),
      makeResultRecord({ bib: '3', state: 'NH' }),
    ];
    const g = computeResultsStats(results).geographic;
    expect(g.byState['MA']).toBe(2);
    expect(g.byState['NH']).toBe(1);
  });

  it('topStates returns at most 15 entries', () => {
    // 20 different states
    const states = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
                    'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD'];
    const results = states.map((s, i) => makeResultRecord({ bib: String(i), state: s, country: 'USA' }));
    const g = computeResultsStats(results).geographic;
    expect(g.topStates.length).toBeLessThanOrEqual(15);
  });

  it('topCountries returns at most 10 entries', () => {
    const countries = ['USA','CAN','GBR','AUS','DEU','FRA','JPN','BRA','NZL','ZAF','MEX'];
    const results = countries.map((c, i) => makeResultRecord({ bib: String(i), country: c, state: '' }));
    const g = computeResultsStats(results).geographic;
    expect(g.topCountries.length).toBeLessThanOrEqual(10);
  });

  it('topStates is sorted by count descending', () => {
    const results = [
      makeResultRecord({ bib: '1', state: 'MA', country: 'USA' }),
      makeResultRecord({ bib: '2', state: 'NH', country: 'USA' }),
      makeResultRecord({ bib: '3', state: 'NH', country: 'USA' }),
      makeResultRecord({ bib: '4', state: 'NH', country: 'USA' }),
    ];
    const g = computeResultsStats(results).geographic;
    expect(g.topStates[0].state).toBe('NH');
    expect(g.topStates[0].count).toBe(3);
  });

  it('counts explicit non-US countries as international', () => {
    const results = [
      ...recs(3, { state: 'MA', country: 'USA' }),
      makeResultRecord({ bib: 'x1', state: 'ON', country: 'CAN' }),
    ].map((r, i) => ({ ...r, bib: String(i) }));
    const g = computeResultsStats(results).geographic;
    expect(g.usParticipants).toBe(3);
    expect(g.internationalParticipants).toBe(1);
    expect(g.unknownLocationParticipants).toBe(0);
  });

  it('does not count missing or unknown locations as international', () => {
    const g = computeResultsStats([
      makeResultRecord({ bib: '1', state: 'MA', country: 'USA' }),
      makeResultRecord({ bib: '2', state: 'ON', country: 'CAN' }),
      makeResultRecord({ bib: '3', state: '', country: '' }),
      makeResultRecord({ bib: '4', state: 'Unknown', country: 'Unknown' }),
    ]).geographic;

    expect(g.usParticipants).toBe(1);
    expect(g.internationalParticipants).toBe(1);
    expect(g.unknownLocationParticipants).toBe(2);
    expect(g.byCountry).toEqual({ USA: 1, CAN: 1 });
    expect(g.byState).toEqual({ MA: 1, ON: 1 });
  });

  it('records with empty state are still counted in byCountry', () => {
    const results = [makeResultRecord({ bib: '1', state: '', country: 'GBR' })];
    const g = computeResultsStats(results).geographic;
    expect(g.byCountry['GBR']).toBe(1);
    expect(g.byState).toEqual({});
  });

  it('scopes unknown-location geography by event without leaking between events', () => {
    const stats = computeResultsStats([
      makeResultRecord({ bib: '1', state: 'MA', country: 'USA', distanceMiles: 50, timeSeconds: 18000 }),
      makeResultRecord({ bib: '2', state: '', country: '', distanceMiles: 50, timeSeconds: 19000 }),
      makeResultRecord({ bib: '3', state: 'NH', country: 'USA', distanceMiles: 50, timeSeconds: 20000 }),
      makeResultRecord({ bib: '4', state: 'ON', country: 'CAN', distanceMiles: 25, timeSeconds: 9000 }),
      makeResultRecord({ bib: '5', state: 'Unknown', country: 'Unknown', distanceMiles: 25, timeSeconds: 10000 }),
      makeResultRecord({ bib: '6', state: '', country: 'GBR', distanceMiles: 25, timeSeconds: 11000 }),
    ]);

    expect(stats.geographic.usParticipants).toBe(2);
    expect(stats.geographic.internationalParticipants).toBe(2);
    expect(stats.geographic.unknownLocationParticipants).toBe(2);

    const event50 = stats.geographicDistributionByEvent.find(e => e.eventName === '50 mi')!.geographic;
    const event25 = stats.geographicDistributionByEvent.find(e => e.eventName === '25 mi')!.geographic;

    expect(event50.usParticipants).toBe(2);
    expect(event50.internationalParticipants).toBe(0);
    expect(event50.unknownLocationParticipants).toBe(1);
    expect(event50.byCountry).toEqual({ USA: 2 });

    expect(event25.usParticipants).toBe(0);
    expect(event25.internationalParticipants).toBe(2);
    expect(event25.unknownLocationParticipants).toBe(1);
    expect(event25.byCountry).toEqual({ CAN: 1, GBR: 1 });
  });

  it('scopes geographic distribution by fixed-distance event', () => {
    const stats = computeResultsStats([
      makeResultRecord({ bib: '1', state: 'MA', country: 'USA', distanceMiles: 50, timeSeconds: 18000 }),
      makeResultRecord({ bib: '2', state: 'MA', country: 'USA', distanceMiles: 50, timeSeconds: 19000 }),
      makeResultRecord({ bib: '3', state: 'ON', country: 'CAN', distanceMiles: 50, timeSeconds: 20000 }),
      makeResultRecord({ bib: '4', state: 'CO', country: 'USA', distanceMiles: 25, timeSeconds: 9000 }),
      makeResultRecord({ bib: '5', state: 'BC', country: 'CAN', distanceMiles: 25, timeSeconds: 10000 }),
      makeResultRecord({ bib: '6', state: '', country: 'GBR', distanceMiles: 25, timeSeconds: 11000 }),
    ]);

    expect(stats.geographicDistributionByEvent.map(e => e.eventName)).toEqual(['50 mi', '25 mi']);
    expect(stats.geographicDistributionByEvent.map(e => e.eventType)).toEqual(['fixed-distance', 'fixed-distance']);

    const event50 = stats.geographicDistributionByEvent.find(e => e.eventName === '50 mi')!.geographic;
    const event25 = stats.geographicDistributionByEvent.find(e => e.eventName === '25 mi')!.geographic;

    expect(event50.usParticipants).toBe(2);
    expect(event50.internationalParticipants).toBe(1);
    expect(event50.byState).toEqual({ MA: 2, ON: 1 });
    expect(event50.byCountry).toEqual({ USA: 2, CAN: 1 });

    expect(event25.usParticipants).toBe(1);
    expect(event25.internationalParticipants).toBe(2);
    expect(event25.byState).toEqual({ CO: 1, BC: 1 });
    expect(event25.byCountry).toEqual({ USA: 1, CAN: 1, GBR: 1 });
  });

  it('emits fixed-time event-scoped geographic distribution', () => {
    const stats = computeResultsStats([
      makeResultRecord({ bib: '1', state: 'CO', country: 'USA', distanceMiles: 41, timeSeconds: null }),
      makeResultRecord({ bib: '2', state: 'UT', country: 'USA', distanceMiles: 44, timeSeconds: null }),
      makeResultRecord({ bib: '3', state: 'BC', country: 'CAN', distanceMiles: 47, timeSeconds: null }),
      makeResultRecord({ bib: '4', state: '', country: 'AUS', distanceMiles: 50, timeSeconds: null }),
    ]);

    expect(stats.geographicDistributionByEvent).toHaveLength(1);
    expect(stats.geographicDistributionByEvent[0].eventType).toBe('fixed-time');
    expect(stats.geographicDistributionByEvent[0].geographic.usParticipants).toBe(2);
    expect(stats.geographicDistributionByEvent[0].geographic.internationalParticipants).toBe(2);
    expect(stats.geographicDistributionByEvent[0].geographic.byCountry).toEqual({ USA: 2, CAN: 1, AUS: 1 });
  });

  it('preserves top-level geography as overall while by-event entries stay event-scoped', () => {
    const stats = computeResultsStats([
      makeResultRecord({ bib: '1', state: 'MA', country: 'USA', distanceMiles: 50, timeSeconds: 18000 }),
      makeResultRecord({ bib: '2', state: 'ON', country: 'CAN', distanceMiles: 50, timeSeconds: 19000 }),
      makeResultRecord({ bib: '3', state: 'CO', country: 'USA', distanceMiles: 25, timeSeconds: 9000 }),
      makeResultRecord({ bib: '4', state: '', country: 'GBR', distanceMiles: 25, timeSeconds: 10000 }),
      makeResultRecord({ bib: '5', state: 'BC', country: 'CAN', distanceMiles: 25, timeSeconds: 11000 }),
      makeResultRecord({ bib: '6', state: 'NH', country: 'USA', distanceMiles: 50, timeSeconds: 20000 }),
    ]);

    expect(stats.geographic.usParticipants).toBe(3);
    expect(stats.geographic.internationalParticipants).toBe(3);
    expect(stats.geographic.byCountry).toEqual({ USA: 3, CAN: 2, GBR: 1 });

    const event50 = stats.geographicDistributionByEvent.find(e => e.eventName === '50 mi')!.geographic;
    const event25 = stats.geographicDistributionByEvent.find(e => e.eventName === '25 mi')!.geographic;
    expect(event50.byCountry).toEqual({ USA: 2, CAN: 1 });
    expect(event25.byCountry).toEqual({ USA: 1, GBR: 1, CAN: 1 });
  });

  it('aligns geographicDistributionByEvent event names with performance events', () => {
    const stats = computeResultsStats([
      makeResultRecord({ bib: '1', state: 'MA', country: 'USA', distanceMiles: 50, timeSeconds: 18000 }),
      makeResultRecord({ bib: '2', state: 'ON', country: 'CAN', distanceMiles: 50, timeSeconds: 19000 }),
      makeResultRecord({ bib: '3', state: 'NH', country: 'USA', distanceMiles: 50, timeSeconds: 20000 }),
      makeResultRecord({ bib: '4', state: 'CO', country: 'USA', distanceMiles: 25, timeSeconds: 9000 }),
      makeResultRecord({ bib: '5', state: 'BC', country: 'CAN', distanceMiles: 25, timeSeconds: 10000 }),
      makeResultRecord({ bib: '6', state: '', country: 'GBR', distanceMiles: 25, timeSeconds: 11000 }),
    ]);

    expect(stats.geographicDistributionByEvent.map(e => e.eventName)).toEqual(
      stats.performance.events.map(e => e.eventName),
    );
  });
});

// ─── Attrition ─────────────────────────────────────────────────────────────────

describe('computeResultsStats — attrition', () => {
  const results = [
    ...recs(5, { finishStatus: 1, gender: 'M', distanceMiles: 50, timeSeconds: 14400 }),
    ...recs(3, { finishStatus: 2, gender: 'F', distanceMiles: null, timeSeconds: null }),
    makeResultRecord({ bib: 'dns1', finishStatus: 3, gender: 'M', distanceMiles: null, timeSeconds: null }),
    makeResultRecord({ bib: 'nb1', finishStatus: 1, gender: 'NB', distanceMiles: 50, timeSeconds: 18000 }),
  ].map((r, i) => ({ ...r, bib: String(i) }));

  const attrition = computeResultsStats(results).attrition;

  it('overall.total counts all records', () => expect(attrition.overall.total).toBe(10));
  it('overall.finished counts finishers', () => expect(attrition.overall.finished).toBe(6));
  it('overall.dnf counts DNF records', () => expect(attrition.overall.dnf).toBe(3));
  it('overall.dns counts DNS records', () => expect(attrition.overall.dns).toBe(1));
  it('overall.finishRate excludes DNS from denominator', () => {
    // pct(6, 9) = round(666.7) / 10 = 66.7
    expect(attrition.overall.finishRate).toBe(66.7);
  });
  it('overall.dnsRate uses total as denominator', () => {
    // pct(1, 10) = 10.0
    expect(attrition.overall.dnsRate).toBe(10.0);
  });

  it('always includes Male gender row even when M dns exists', () => {
    const male = attrition.byGender.find(r => r.name === 'Male')!;
    expect(male.total).toBe(6); // 5 finish + 1 dns
  });

  it('always includes Female gender row', () => {
    const female = attrition.byGender.find(r => r.name === 'Female')!;
    expect(female.total).toBe(3);
    expect(female.finished).toBe(0);
    expect(female.dnf).toBe(3);
  });

  it('always includes Non-Binary gender row (even with only 1 NB)', () => {
    const nb = attrition.byGender.find(r => r.name === 'Non-Binary')!;
    expect(nb).toBeDefined();
    expect(nb.finished).toBe(1);
  });

  it('includes Non-Binary gender row even when no NB participants exist', () => {
    const noNbResults = [
      ...recs(3, { finishStatus: 1, gender: 'M', distanceMiles: 50 }),
      ...recs(2, { finishStatus: 1, gender: 'F', distanceMiles: 50 }),
    ].map((r, i) => ({ ...r, bib: String(i) }));
    const atr = computeResultsStats(noNbResults).attrition;
    const nb = atr.byGender.find(r => r.name === 'Non-Binary')!;
    expect(nb).toBeDefined();
    expect(nb.total).toBe(0);
    expect(nb.finishRate).toBe(0);
    expect(nb.dnfRate).toBe(0);
  });

  it('byEvent is empty for a single-event race', () => {
    expect(attrition.byEvent).toHaveLength(0);
  });

  it('byEvent has entries for a multi-event race', () => {
    const multiEvent = [
      ...recs(4, { finishStatus: 1, distanceMiles: 50, timeSeconds: 18000 }),
      ...recs(3, { finishStatus: 1, distanceMiles: 25, timeSeconds: 9000 }),
    ].map((r, i) => ({ ...r, bib: String(i) }));
    const atr = computeResultsStats(multiEvent).attrition;
    expect(atr.byEvent).toHaveLength(2);
  });
});

// ─── Summary events (course record / last finisher) ───────────────────────────

describe('computeResultsStats — summary event courseRecord and lastFinisher', () => {
  it('courseRecord is the fastest finisher time', () => {
    const results = [
      makeResultRecord({ bib: '1', finishStatus: 1, distanceMiles: 50, timeSeconds: 14400 }),
      makeResultRecord({ bib: '2', finishStatus: 1, distanceMiles: 50, timeSeconds: 16200 }),
      makeResultRecord({ bib: '3', finishStatus: 1, distanceMiles: 50, timeSeconds: 18000 }),
    ];
    const ev = computeResultsStats(results).summary.events[0];
    expect(ev.courseRecord?.seconds).toBe(14400);
    expect(ev.courseRecord?.display).toBe('4:00:00');
  });

  it('lastFinisher is the slowest finisher time', () => {
    const results = [
      makeResultRecord({ bib: '1', finishStatus: 1, distanceMiles: 50, timeSeconds: 14400 }),
      makeResultRecord({ bib: '2', finishStatus: 1, distanceMiles: 50, timeSeconds: 16200 }),
      makeResultRecord({ bib: '3', finishStatus: 1, distanceMiles: 50, timeSeconds: 18000 }),
    ];
    const ev = computeResultsStats(results).summary.events[0];
    expect(ev.lastFinisher?.seconds).toBe(18000);
    expect(ev.lastFinisher?.display).toBe('5:00:00');
  });

  it('courseRecord is null when no finishers have time data', () => {
    const results = recs(3, { finishStatus: 1, distanceMiles: 50, timeSeconds: null });
    const ev = computeResultsStats(results).summary.events[0];
    expect(ev.courseRecord).toBeNull();
  });

  it('courseRecord is null when there are no finishers', () => {
    const results = recs(3, { finishStatus: 2, distanceMiles: null, timeSeconds: null });
    const ev = computeResultsStats(results).summary.events[0];
    expect(ev.courseRecord).toBeNull();
  });

  it('DNF records do not affect courseRecord', () => {
    const results = [
      makeResultRecord({ bib: '1', finishStatus: 2, distanceMiles: 50, timeSeconds: 10000 }), // faster but DNF
      makeResultRecord({ bib: '2', finishStatus: 1, distanceMiles: 50, timeSeconds: 14400 }),
      makeResultRecord({ bib: '3', finishStatus: 1, distanceMiles: 50, timeSeconds: 16200 }),
      makeResultRecord({ bib: '4', finishStatus: 1, distanceMiles: 50, timeSeconds: 18000 }),
    ];
    const ev = computeResultsStats(results).summary.events[0];
    expect(ev.courseRecord?.seconds).toBe(14400);
  });

  it('fixed-time courseRecord uses farthest distance', () => {
    const results = [45, 47, 49, 51, 53].map((d, i) =>
      makeResultRecord({ bib: String(i), finishStatus: 1, distanceMiles: d, timeSeconds: null }),
    );
    const ev = computeResultsStats(results).summary.events[0];
    expect(ev.courseRecord?.miles).toBe(53);
  });

  it('fixed-time lastFinisher uses shortest distance', () => {
    const results = [45, 47, 49, 51, 53].map((d, i) =>
      makeResultRecord({ bib: String(i), finishStatus: 1, distanceMiles: d, timeSeconds: null }),
    );
    const ev = computeResultsStats(results).summary.events[0];
    expect(ev.lastFinisher?.miles).toBe(45);
  });
});

// ─── Cross-event ───────────────────────────────────────────────────────────────

describe('computeResultsStats — crossEvent', () => {
  it('returns empty rows for a single-event race', () => {
    const results = recs(5, { finishStatus: 1, distanceMiles: 50, timeSeconds: 14400 });
    expect(computeResultsStats(results).crossEvent.rows).toHaveLength(0);
  });

  it('returns one row per event for a multi-event race', () => {
    const results = [
      ...recs(4, { finishStatus: 1, distanceMiles: 50, timeSeconds: 18000 }),
      ...recs(3, { finishStatus: 1, distanceMiles: 25, timeSeconds: 9000 }),
    ].map((r, i) => ({ ...r, bib: String(i) }));
    const rows = computeResultsStats(results).crossEvent.rows;
    expect(rows).toHaveLength(2);
  });

  it('cross-event row has correct entrant count', () => {
    const results = [
      ...recs(4, { finishStatus: 1, distanceMiles: 50, timeSeconds: 18000 }),
      ...recs(3, { finishStatus: 1, distanceMiles: 25, timeSeconds: 9000 }),
    ].map((r, i) => ({ ...r, bib: String(i) }));
    const row50 = computeResultsStats(results).crossEvent.rows.find(r => r.name === '50 mi')!;
    expect(row50.totalEntrants).toBe(4);
    expect(row50.finishers).toBe(4);
  });

  it('femalePercent is calculated from finishers only', () => {
    const results = [
      makeResultRecord({ bib: '1', finishStatus: 1, gender: 'F', distanceMiles: 50, timeSeconds: 18000 }),
      makeResultRecord({ bib: '2', finishStatus: 1, gender: 'M', distanceMiles: 50, timeSeconds: 14400 }),
      makeResultRecord({ bib: '3', finishStatus: 1, gender: 'M', distanceMiles: 50, timeSeconds: 16200 }),
      makeResultRecord({ bib: '4', finishStatus: 1, gender: 'M', distanceMiles: 25, timeSeconds: 9000 }),
      makeResultRecord({ bib: '5', finishStatus: 1, gender: 'M', distanceMiles: 25, timeSeconds: 8000 }),
      makeResultRecord({ bib: '6', finishStatus: 1, gender: 'M', distanceMiles: 25, timeSeconds: 7000 }),
    ];
    const row50 = computeResultsStats(results).crossEvent.rows.find(r => r.name === '50 mi')!;
    // 1 female out of 3 finishers = 33.3%
    expect(row50.femaleFinishers).toBe(1);
    expect(row50.femalePercent).toBe(33.3);
  });
});

// ─── Edge cases / data quality ─────────────────────────────────────────────────

describe('computeResultsStats — edge cases', () => {
  it('does not throw on special characters in string fields', () => {
    const r = makeResultRecord({ bib: '<script>alert(1)</script>', city: '"; DROP TABLE--' });
    expect(() => computeResultsStats([r])).not.toThrow();
  });

  it('does not throw on a very large result set', () => {
    const results = makeResultRecords(1000, { finishStatus: 1, distanceMiles: 50, timeSeconds: 14400 });
    expect(() => computeResultsStats(results)).not.toThrow();
  });

  it('does not throw on records with all nulls for optional fields', () => {
    const r = makeResultRecord({
      age: null, distanceMiles: null, timeSeconds: null,
      state: '', country: '', city: '', divisionName: '',
    });
    expect(() => computeResultsStats([r])).not.toThrow();
  });

  it('handles a mix of status codes without error', () => {
    const statuses: Array<1|2|3|4|5|6> = [1, 2, 3, 4, 5, 6];
    const results = statuses.map((s, i) =>
      makeResultRecord({ bib: String(i), finishStatus: s, distanceMiles: s === 1 ? 50 : null }),
    );
    expect(() => computeResultsStats(results)).not.toThrow();
  });

  it('handles duplicate bib numbers without error', () => {
    const results = [
      makeResultRecord({ bib: '1', finishStatus: 1, distanceMiles: 50, timeSeconds: 14400 }),
      makeResultRecord({ bib: '1', finishStatus: 1, distanceMiles: 50, timeSeconds: 16200 }),
      makeResultRecord({ bib: '1', finishStatus: 1, distanceMiles: 50, timeSeconds: 18000 }),
    ];
    expect(() => computeResultsStats(results)).not.toThrow();
  });

  it('handles a single participant correctly', () => {
    const s = computeResultsStats([makeResultRecord({ finishStatus: 1, distanceMiles: 50, timeSeconds: 14400 })]).summary;
    expect(s.totalEntrants).toBe(1);
    expect(s.finishers).toBe(1);
    expect(s.finishRate).toBe(100);
  });

  it('handles extreme time values (near-zero finish)', () => {
    const results = recs(3, { finishStatus: 1, distanceMiles: 50, timeSeconds: 1 });
    expect(() => computeResultsStats(results)).not.toThrow();
  });
});

// ─── Age Group Performance — consistent selected-event scope ──────────────────

describe('computeResultsStats — ageGroupPerformance co-event isolation', () => {
  // Multi-event race: 50-mile primary (3 M finishers) + 25-mile co-event (1 NB finisher).
  // All runners are in the 30–39 age group.
  // After scope fix, Age Group Performance is based on the primary event only.
  // The co-event NB finisher must NOT appear in the primary-event row.
  const primary50 = [
    finisher({ bib: '1', gender: 'M', age: 32, distanceMiles: 50, timeSeconds: 18000 }),
    finisher({ bib: '2', gender: 'M', age: 34, distanceMiles: 50, timeSeconds: 19800 }),
    finisher({ bib: '3', gender: 'M', age: 36, distanceMiles: 50, timeSeconds: 21600 }),
  ];
  const coEvent25 = [
    finisher({ bib: '4', gender: 'NB', age: 35, distanceMiles: 25, timeSeconds: 10800 }),
  ];
  const stats = computeResultsStats([...primary50, ...coEvent25]);
  const agp = stats.ageGroupPerformance!;
  const row3039 = agp.rows.find(r => r.ageGroup === '30–39')!;

  it('ageGroupPerformance is not null', () => expect(agp).not.toBeNull());
  it('30–39 row exists', () => expect(row3039).toBeDefined());
  it('co-event NB finisher does not leak into nonBinaryFinishers', () =>
    expect(row3039.nonBinaryFinishers).toBe(0));
  it('nonBinaryPaceSecsPerMile is null — no NB in primary event', () =>
    expect(row3039.nonBinaryPaceSecsPerMile).toBeNull());
  it('maleFinishers counts primary-event M finishers', () =>
    expect(row3039.maleFinishers).toBe(3));
  it('total finishers counts primary-event participants only', () =>
    expect(row3039.finishers).toBe(3));
});

describe('computeResultsStats — ageGroupPerformance primary-event NB finisher', () => {
  // Single-event race where NB is a primary-event finisher.
  // NB must appear in nonBinaryFinishers and produce a valid pace.
  const records = [
    finisher({ bib: '1', gender: 'M',  age: 32, distanceMiles: 50, timeSeconds: 18000 }),
    finisher({ bib: '2', gender: 'M',  age: 34, distanceMiles: 50, timeSeconds: 19800 }),
    finisher({ bib: '3', gender: 'M',  age: 36, distanceMiles: 50, timeSeconds: 21600 }),
    finisher({ bib: '4', gender: 'NB', age: 35, distanceMiles: 50, timeSeconds: 20000 }),
  ];
  const stats = computeResultsStats(records);
  const agp = stats.ageGroupPerformance!;
  const row3039 = agp.rows.find(r => r.ageGroup === '30–39')!;

  it('nonBinaryFinishers is 1', () => expect(row3039.nonBinaryFinishers).toBe(1));
  it('nonBinaryPaceSecsPerMile is non-null', () =>
    expect(row3039.nonBinaryPaceSecsPerMile).not.toBeNull());
  it('total finishers is 4', () => expect(row3039.finishers).toBe(4));
});

// ─── Division Performance — consistent selected-event scope ───────────────────

describe('computeResultsStats — divisionPerformance co-event isolation', () => {
  const primary50 = [
    finisher({ bib: '1', gender: 'M',  age: 35, divisionName: 'Open',   distanceMiles: 50, timeSeconds: 18000 }),
    finisher({ bib: '2', gender: 'F',  age: 35, divisionName: 'Open',   distanceMiles: 50, timeSeconds: 19800 }),
    finisher({ bib: '3', gender: 'NB', age: 35, divisionName: 'Open',   distanceMiles: 50, timeSeconds: null }),
    finisher({ bib: '4', gender: 'M',  age: 35, divisionName: 'Masters', distanceMiles: 50, timeSeconds: 21600 }),
  ];
  const coEvent25 = [
    finisher({ bib: '5', gender: 'F', age: 35, divisionName: 'Open',    distanceMiles: 25, timeSeconds: 9000 }),
    finisher({ bib: '6', gender: 'M', age: 35, divisionName: 'Co Event', distanceMiles: 25, timeSeconds: 8000 }),
    finisher({ bib: '7', gender: 'M', age: 35, divisionName: 'Co Event', distanceMiles: 25, timeSeconds: 7000 }),
  ];

  const stats = computeResultsStats([...primary50, ...coEvent25]);
  const divPerf = stats.divisionPerformance!;
  const male3039 = divPerf.rows.find(r => r.division === 'Male 30–39')!;
  const female3039 = divPerf.rows.find(r => r.division === 'Female 30–39')!;
  const nb3039 = divPerf.rows.find(r => r.division === 'Non-Binary 30–39')!;

  it('divisionPerformance is not null', () => expect(divPerf).not.toBeNull());
  it('excludes divisions that exist only in co-events', () => {
    expect(divPerf.rows.some(r => r.division === 'Co Event')).toBe(false);
  });
  it('generates true gender-age division rows for the primary event', () => {
    expect(male3039.total).toBe(2);
    expect(female3039.total).toBe(1);
    expect(nb3039.total).toBe(1);
  });
  it('does not map Non-Binary participants into Female or Male division labels', () => {
    expect(nb3039.finishers).toBe(1);
    expect(nb3039.nonBinaryFinishers).toBe(1);
    expect(female3039.nonBinaryFinishers).toBe(0);
    expect(male3039.nonBinaryFinishers).toBe(0);
  });
  it('does not narrow finisher counts to pace-eligible records', () => {
    expect(nb3039.finishers).toBe(1);
    expect(nb3039.medianPaceSecsPerMile).toBeNull();
  });
  it('keeps pace metrics based on valid primary-event performance data', () => {
    expect(male3039.fastestPaceSecsPerMile).toBe(360);
    expect(male3039.medianPaceSecsPerMile).toBe(396);
    expect(male3039.slowestPaceSecsPerMile).toBe(432);
  });
});

describe('computeResultsStats — divisionPerformance Non-Binary division rows', () => {
  const stats = computeResultsStats([
    finisher({ bib: '1', gender: 'NB', age: 35, divisionName: 'Female 30-39', distanceMiles: 50, timeSeconds: 20000 }),
    makeResultRecord({ bib: '2', gender: 'NB', age: 35, divisionName: 'Female 30-39', distanceMiles: 50, timeSeconds: null, finishStatus: 2 }),
    makeResultRecord({ bib: '3', gender: 'NB', age: 35, divisionName: 'Female 30-39', distanceMiles: null, timeSeconds: null, finishStatus: 3 }),
    finisher({ bib: '4', gender: 'M', age: 35, divisionName: 'Male 30-39', distanceMiles: 50, timeSeconds: 18000 }),
    finisher({ bib: '5', gender: 'M', age: 36, divisionName: 'Male 30-39', distanceMiles: 50, timeSeconds: 19000 }),
  ]);
  const row = stats.divisionPerformanceByEvent[0].rows.find(r => r.division === 'Non-Binary 30–39')!;

  it('creates a Non-Binary age-division row even when the source division label is wrong', () => {
    expect(row).toBeDefined();
    expect(stats.divisionPerformanceByEvent[0].rows.some(r => r.division === 'Female 30-39')).toBe(false);
  });
  it('counts Non-Binary total, finishers, DNS, DNF, and finish rate in that true division row', () => {
    expect(row.total).toBe(3);
    expect(row.finishers).toBe(1);
    expect(row.dnf).toBe(1);
    expect(row.dns).toBe(1);
    expect(row.finishRate).toBe(50);
    expect(row.nonBinaryFinishers).toBe(1);
  });
  it('computes pace from valid Non-Binary finisher performance only', () => {
    expect(row.medianPaceSecsPerMile).toBe(400);
    expect(row.fastestPaceSecsPerMile).toBe(400);
    expect(row.slowestPaceSecsPerMile).toBe(400);
  });
});

describe('computeResultsStats — divisionPerformance Non-Binary missing pace', () => {
  const stats = computeResultsStats([
    finisher({ bib: '1', gender: 'NB', age: 35, divisionName: 'Female 30-39', distanceMiles: 50, timeSeconds: null }),
    finisher({ bib: '2', gender: 'M', age: 35, divisionName: 'Male 30-39', distanceMiles: 50, timeSeconds: 18000 }),
    finisher({ bib: '3', gender: 'M', age: 36, divisionName: 'Male 30-39', distanceMiles: 50, timeSeconds: 19000 }),
    finisher({ bib: '4', gender: 'F', age: 37, divisionName: 'Female 30-39', distanceMiles: 50, timeSeconds: 20000 }),
  ]);
  const row = stats.divisionPerformanceByEvent[0].rows.find(r => r.division === 'Non-Binary 30–39')!;

  it('preserves the Non-Binary division row and finisher count when pace is missing', () => {
    expect(row.total).toBe(1);
    expect(row.finishers).toBe(1);
    expect(row.nonBinaryFinishers).toBe(1);
  });
  it('leaves missing pace fields null, not zero', () => {
    expect(row.medianPaceSecsPerMile).toBeNull();
    expect(row.fastestPaceSecsPerMile).toBeNull();
    expect(row.slowestPaceSecsPerMile).toBeNull();
  });
});

describe('computeResultsStats — divisionPerformance division label fallbacks', () => {
  it('uses uploaded divisionName when age is missing', () => {
    const stats = computeResultsStats([
      finisher({ bib: '1', gender: 'NB', age: null, divisionName: 'Open NB', distanceMiles: 50, timeSeconds: 18000 }),
      finisher({ bib: '2', gender: 'M', age: 35, divisionName: 'Male 30-39', distanceMiles: 50, timeSeconds: 19000 }),
      finisher({ bib: '3', gender: 'F', age: 35, divisionName: 'Female 30-39', distanceMiles: 50, timeSeconds: 20000 }),
    ]);
    const fallback = stats.divisionPerformanceByEvent[0].rows.find(r => r.division === 'Open NB')!;

    expect(fallback).toBeDefined();
    expect(stats.divisionPerformanceByEvent[0].rows.some(r => r.division.startsWith('Non-Binary '))).toBe(false);
    expect(fallback.total).toBe(1);
    expect(fallback.finishers).toBe(1);
    expect(fallback.nonBinaryFinishers).toBe(1);
    expect(fallback.medianPaceSecsPerMile).toBe(360);
  });

  it('uses uploaded divisionName when gender is unknown', () => {
    const stats = computeResultsStats([
      finisher({ bib: '1', gender: 'Unknown', age: 35, divisionName: 'Awards Pending', distanceMiles: 50, timeSeconds: 18000 }),
      finisher({ bib: '2', gender: 'M', age: 35, divisionName: 'Male 30-39', distanceMiles: 50, timeSeconds: 19000 }),
      finisher({ bib: '3', gender: 'F', age: 35, divisionName: 'Female 30-39', distanceMiles: 50, timeSeconds: 20000 }),
    ]);
    const fallback = stats.divisionPerformanceByEvent[0].rows.find(r => r.division === 'Awards Pending')!;

    expect(fallback).toBeDefined();
    expect(fallback.total).toBe(1);
    expect(fallback.finishers).toBe(1);
    expect(fallback.maleFinishers).toBe(0);
    expect(fallback.femaleFinishers).toBe(0);
    expect(fallback.nonBinaryFinishers).toBe(0);
  });

  it('supports generated and fallback labels in the same event', () => {
    const stats = computeResultsStats([
      finisher({ bib: '1', gender: 'M', age: 35, divisionName: 'Open', distanceMiles: 50, timeSeconds: 18000 }),
      finisher({ bib: '2', gender: 'NB', age: null, divisionName: 'Open NB', distanceMiles: 50, timeSeconds: 19000 }),
      finisher({ bib: '3', gender: 'F', age: 45, divisionName: 'Open', distanceMiles: 50, timeSeconds: 20000 }),
    ]);
    const labels = stats.divisionPerformanceByEvent[0].rows.map(r => r.division);

    expect(labels).toContain('Male 30–39');
    expect(labels).toContain('Female 40–49');
    expect(labels).toContain('Open NB');
  });
});

describe('computeResultsStats — divisionPerformance DNS/DNF event isolation', () => {
  it('keeps shared division label DNS/DNF scoped to each event', () => {
    const stats = computeResultsStats([
      makeResultRecord({ bib: '1', gender: 'Unknown', age: null, divisionName: 'Open', distanceMiles: 50, timeSeconds: 18000, finishStatus: 1 }),
      makeResultRecord({ bib: '2', gender: 'Unknown', age: null, divisionName: 'Open', distanceMiles: 50, timeSeconds: 19000, finishStatus: 1 }),
      makeResultRecord({ bib: '3', gender: 'Unknown', age: null, divisionName: 'Open', distanceMiles: 50, timeSeconds: 20000, finishStatus: 1 }),
      makeResultRecord({ bib: '4', gender: 'Unknown', age: null, divisionName: 'Open', distanceMiles: 50, timeSeconds: null, finishStatus: 2 }),
      makeResultRecord({ bib: '5', gender: 'Unknown', age: null, divisionName: 'Open', distanceMiles: 50, timeSeconds: null, finishStatus: 3 }),
      makeResultRecord({ bib: '6', gender: 'Unknown', age: null, divisionName: 'Open', distanceMiles: 25, timeSeconds: 9000, finishStatus: 1 }),
      makeResultRecord({ bib: '7', gender: 'Unknown', age: null, divisionName: 'Open', distanceMiles: 25, timeSeconds: 10000, finishStatus: 1 }),
      makeResultRecord({ bib: '8', gender: 'Unknown', age: null, divisionName: 'Open', distanceMiles: 25, timeSeconds: 11000, finishStatus: 1 }),
      makeResultRecord({ bib: '9', gender: 'Unknown', age: null, divisionName: 'Open', distanceMiles: 25, timeSeconds: null, finishStatus: 2 }),
    ]);
    const open50 = stats.divisionPerformanceByEvent.find(e => e.eventName === '50 mi')!.rows.find(r => r.division === 'Open')!;
    const open25 = stats.divisionPerformanceByEvent.find(e => e.eventName === '25 mi')!.rows.find(r => r.division === 'Open')!;

    expect(open50.total).toBe(5);
    expect(open50.finishers).toBe(3);
    expect(open50.dnf).toBe(1);
    expect(open50.dns).toBe(1);
    expect(open25.total).toBe(4);
    expect(open25.finishers).toBe(3);
    expect(open25.dnf).toBe(1);
    expect(open25.dns).toBe(0);
  });
});

describe('computeResultsStats — divisionPerformance fixed-time NB isolation', () => {
  it('preserves fixed-time Non-Binary division rows and null distance fields when distance is missing', () => {
    const stats = computeResultsStats([
      finisher({ bib: '1', gender: 'NB', age: 35, divisionName: 'Female 30-39', distanceMiles: null, timeSeconds: null }),
      finisher({ bib: '2', gender: 'M', age: 35, divisionName: 'Male 30-39', distanceMiles: 41, timeSeconds: null }),
      finisher({ bib: '3', gender: 'F', age: 35, divisionName: 'Female 30-39', distanceMiles: 44, timeSeconds: null }),
      finisher({ bib: '4', gender: 'M', age: 45, divisionName: 'Male 40-49', distanceMiles: 47, timeSeconds: null }),
    ]);
    const nbRow = stats.divisionPerformanceByEvent[0].rows.find(r => r.division === 'Non-Binary 30–39')!;

    expect(stats.divisionPerformanceByEvent).toHaveLength(1);
    expect(stats.divisionPerformanceByEvent[0].eventType).toBe('fixed-time');
    expect(nbRow.total).toBe(1);
    expect(nbRow.finishers).toBe(1);
    expect(nbRow.nonBinaryFinishers).toBe(1);
    expect(nbRow.medianMiles).toBeNull();
    expect(nbRow.maxMiles).toBeNull();
    expect(nbRow.minMiles).toBeNull();
  });
});

describe('computeResultsStats — ageGroupPerformanceByEvent and divisionPerformanceByEvent', () => {
  const primary50 = [
    finisher({ bib: '1', gender: 'M',  age: 32, divisionName: 'Open',    distanceMiles: 50, timeSeconds: 18000 }),
    finisher({ bib: '2', gender: 'NB', age: 35, divisionName: 'Open',    distanceMiles: 50, timeSeconds: 20000 }),
    finisher({ bib: '3', gender: 'F',  age: 42, divisionName: 'Masters', distanceMiles: 50, timeSeconds: 22000 }),
    finisher({ bib: '4', gender: 'M',  age: 34, divisionName: 'Open',    distanceMiles: 50, timeSeconds: null }),
  ];
  const coEvent25 = [
    finisher({ bib: '5', gender: 'M',  age: 32, divisionName: 'Open',    distanceMiles: 25, timeSeconds: 10000 }),
    finisher({ bib: '6', gender: 'F',  age: 37, divisionName: 'Co Only', distanceMiles: 25, timeSeconds: 12000 }),
    finisher({ bib: '7', gender: 'NB', age: 36, divisionName: 'Co Only', distanceMiles: 25, timeSeconds: 14000 }),
    makeResultRecord({ bib: '8', gender: 'M', age: 34, divisionName: 'Open', distanceMiles: 25, timeSeconds: null, finishStatus: 2 }),
    makeResultRecord({ bib: '9', gender: 'F', age: 34, divisionName: 'Open', distanceMiles: 25, timeSeconds: null, finishStatus: 3 }),
  ];

  const stats = computeResultsStats([...primary50, ...coEvent25]);

  it('emits age group performance for each event in event order', () => {
    expect(stats.ageGroupPerformanceByEvent.map(e => e.eventName)).toEqual(['50 mi', '25 mi']);
    expect(stats.ageGroupPerformanceByEvent.map(e => e.eventType)).toEqual(['fixed-distance', 'fixed-distance']);
  });

  it('keeps age group counts and NB finishers scoped to each fixed-distance event', () => {
    const row50 = stats.ageGroupPerformanceByEvent
      .find(e => e.eventName === '50 mi')!
      .rows.find(r => r.ageGroup === '30–39')!;
    const row25 = stats.ageGroupPerformanceByEvent
      .find(e => e.eventName === '25 mi')!
      .rows.find(r => r.ageGroup === '30–39')!;

    expect(row50.total).toBe(3);
    expect(row50.finishers).toBe(3);
    expect(row50.nonBinaryFinishers).toBe(1);
    expect(row50.medianPaceSecsPerMile).toBe(380);
    expect(row50.nonBinaryPaceSecsPerMile).toBe(400);

    expect(row25.total).toBe(5);
    expect(row25.finishers).toBe(3);
    expect(row25.dnf).toBe(1);
    expect(row25.dns).toBe(1);
    expect(row25.nonBinaryFinishers).toBe(1);
    expect(row25.medianPaceSecsPerMile).toBe(480);
  });

  it('emits division performance for each event in event order', () => {
    expect(stats.divisionPerformanceByEvent.map(e => e.eventName)).toEqual(['50 mi', '25 mi']);
    expect(stats.divisionPerformanceByEvent.map(e => e.eventType)).toEqual(['fixed-distance', 'fixed-distance']);
  });

  it('aligns by-event analytics entries with performance event ordering', () => {
    const eventNames = stats.performance.events.map(e => e.eventName);
    expect(stats.ageGroupPerformanceByEvent).toHaveLength(eventNames.length);
    expect(stats.divisionPerformanceByEvent).toHaveLength(eventNames.length);
    expect(stats.ageDistributionByEvent).toHaveLength(eventNames.length);
    expect(stats.geographicDistributionByEvent).toHaveLength(eventNames.length);
    expect(stats.ageGroupPerformanceByEvent.map(e => e.eventName)).toEqual(eventNames);
    expect(stats.divisionPerformanceByEvent.map(e => e.eventName)).toEqual(eventNames);
    expect(stats.ageDistributionByEvent.map(e => e.eventName)).toEqual(eventNames);
    expect(stats.geographicDistributionByEvent.map(e => e.eventName)).toEqual(eventNames);
  });

  it('keeps division counts, attrition, and pace scoped to each fixed-distance event', () => {
    const div50 = stats.divisionPerformanceByEvent.find(e => e.eventName === '50 mi')!;
    const div25 = stats.divisionPerformanceByEvent.find(e => e.eventName === '25 mi')!;
    const male50 = div50.rows.find(r => r.division === 'Male 30–39')!;
    const nb50 = div50.rows.find(r => r.division === 'Non-Binary 30–39')!;
    const male25 = div25.rows.find(r => r.division === 'Male 30–39')!;
    const female25 = div25.rows.find(r => r.division === 'Female 30–39')!;
    const nb25 = div25.rows.find(r => r.division === 'Non-Binary 30–39')!;

    expect(div50.rows.some(r => r.division === 'Co Only')).toBe(false);
    expect(male50.total).toBe(2);
    expect(male50.finishers).toBe(2);
    expect(male50.medianPaceSecsPerMile).toBe(360);
    expect(nb50.total).toBe(1);
    expect(nb50.finishers).toBe(1);
    expect(nb50.nonBinaryFinishers).toBe(1);
    expect(nb50.medianPaceSecsPerMile).toBe(400);

    expect(male25.total).toBe(2);
    expect(male25.finishers).toBe(1);
    expect(male25.dnf).toBe(1);
    expect(male25.medianPaceSecsPerMile).toBe(400);
    expect(female25.total).toBe(2);
    expect(female25.finishers).toBe(1);
    expect(female25.dns).toBe(1);
    expect(nb25.total).toBe(1);
    expect(nb25.finishers).toBe(1);
    expect(nb25.nonBinaryFinishers).toBe(1);
    expect(nb25.medianPaceSecsPerMile).toBe(560);
  });
});

describe('computeResultsStats — event-scoped fixed-time performance fields', () => {
  const stats = computeResultsStats([
    finisher({ bib: '1', gender: 'M',  age: 32, divisionName: 'Timed', distanceMiles: 45, timeSeconds: null }),
    finisher({ bib: '2', gender: 'NB', age: 35, divisionName: 'Timed', distanceMiles: 47, timeSeconds: null }),
    finisher({ bib: '3', gender: 'F',  age: 37, divisionName: 'Timed', distanceMiles: 49, timeSeconds: null }),
    finisher({ bib: '4', gender: 'M',  age: 42, divisionName: 'Timed', distanceMiles: 51, timeSeconds: null }),
    finisher({ bib: '5', gender: 'NB', age: 35, divisionName: 'Timed', distanceMiles: null, timeSeconds: null }),
  ]);

  it('preserves fixed-time distance fields by event for age groups and divisions', () => {
    expect(stats.ageGroupPerformanceByEvent).toHaveLength(1);
    expect(stats.divisionPerformanceByEvent).toHaveLength(1);
    expect(stats.ageGroupPerformanceByEvent[0].eventType).toBe('fixed-time');
    expect(stats.divisionPerformanceByEvent[0].eventType).toBe('fixed-time');

    const ageRow = stats.ageGroupPerformanceByEvent[0].rows.find(r => r.ageGroup === '30–39')!;
    const divRow = stats.divisionPerformanceByEvent[0].rows.find(r => r.division === 'Non-Binary 30–39')!;

    expect(ageRow.total).toBe(4);
    expect(ageRow.finishers).toBe(4);
    expect(ageRow.nonBinaryFinishers).toBe(2);
    expect(ageRow.medianMiles).toBe(47);
    expect(ageRow.nonBinaryMiles).toBe(47);

    expect(divRow.total).toBe(2);
    expect(divRow.finishers).toBe(2);
    expect(divRow.nonBinaryFinishers).toBe(2);
    expect(divRow.medianMiles).toBe(47);
    expect(divRow.maxMiles).toBe(47);
    expect(divRow.minMiles).toBe(47);
  });
});

describe('generateResultsCSV — Non-Binary division labels', () => {
  it('assigns generated Non-Binary participants to Non-Binary division labels', () => {
    let nbRows = 0;
    for (const sampleId of Object.keys(RESULTS_SAMPLE_CONFIGS)) {
      const [header, ...rows] = generateResultsCSV(sampleId).split('\n');
      const columns = header.split(',');
      const genderIdx = columns.indexOf('gender');
      const divisionIdx = columns.indexOf('division');

      for (const row of rows) {
        const fields = row.split(',');
        if (fields[genderIdx] === 'NB') {
          nbRows++;
          expect(fields[divisionIdx].startsWith('Non-Binary ')).toBe(true);
        }
      }
    }

    expect(nbRows).toBeGreaterThan(0);
  });
});
