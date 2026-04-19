import { describe, it, expect } from 'vitest';
import { computeResultsStats, formatTime } from '../../stats/results.js';
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

  it('internationalParticipants is total minus US count', () => {
    const results = [
      ...recs(3, { state: 'MA', country: 'USA' }),
      makeResultRecord({ bib: 'x1', state: 'ON', country: 'CAN' }),
    ].map((r, i) => ({ ...r, bib: String(i) }));
    const g = computeResultsStats(results).geographic;
    expect(g.usParticipants).toBe(3);
    expect(g.internationalParticipants).toBe(1);
  });

  it('records with empty state are still counted in byCountry', () => {
    const results = [makeResultRecord({ bib: '1', state: '', country: 'GBR' })];
    const g = computeResultsStats(results).geographic;
    expect(g.byCountry['GBR']).toBe(1);
    expect(g.byState).toEqual({});
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
