import type {
  ResultRecord,
  ResultsStats,
  ResultsSummaryStats,
  ResultsEventSummary,
  PerformanceStats,
  EventPerformanceStats,
  FinishTimeStats,
  DistanceAchievedStats,
  ResultsDemographicsStats,
  GenderStats,
  AgeStats,
  AgeBucket,
  GeographicStats,
  AttritionStats,
  AttritionRow,
  ResultsCrossEventStats,
  ResultsCrossEventRow,
  GenderAgeGroupRow,
  EventType,
  PerformanceValue,
  FinishStatus,
} from '../types.js';

// ─── Utilities ────────────────────────────────────────────────────────────────

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function percentileValue(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Remove UltraSignup fractional sort hacks (.001/.002 etc.)
function cleanDist(d: number): number {
  const frac = d % 1;
  if (frac > 0 && frac < 0.01) return Math.floor(d);
  return d;
}

// ─── Event group detection ────────────────────────────────────────────────────

interface EventGroup {
  name: string;
  type: EventType;
  records: ResultRecord[];
}

function detectEventGroups(results: ResultRecord[]): EventGroup[] {
  const finishersWithDist = results.filter(
    r => (r.finishStatus === 1 || r.finishStatus === 4) && r.distanceMiles !== null,
  );

  if (finishersWithDist.length === 0) {
    return [{ name: 'Event', type: 'fixed-distance', records: results }];
  }

  // Count finishers per rounded-distance bucket
  const bucketCounts = new Map<number, number>();
  for (const r of finishersWithDist) {
    const key = Math.round(cleanDist(r.distanceMiles!));
    bucketCounts.set(key, (bucketCounts.get(key) ?? 0) + 1);
  }

  // Fixed-distance groups: ≥ 3 finishers at the same rounded mile value
  const fixedGroups = [...bucketCounts.entries()]
    .filter(([, cnt]) => cnt >= 3)
    .sort(([a], [b]) => b - a); // descending distance

  if (fixedGroups.length === 0) {
    // No clear clusters → fixed-time event (e.g. 24-hour race)
    return [{ name: 'Event', type: 'fixed-time', records: results }];
  }

  const fixedDistances = fixedGroups.map(([k]) => k);
  const fixedKeys = new Set(fixedDistances);
  // Find the most populated group for assigning records without a distance value
  const modeKey = fixedGroups[0][0];

  // Assign each record to a group:
  //   • exact rounded match → that fixed group
  //   • within 1.5 mi of a fixed group → nearest fixed group (GPS drift / minor variation)
  //   • farther than 1.5 mi from every fixed group → its own group by rounded distance
  //   • no distance → mode group
  const groupMap = new Map<number, ResultRecord[]>(fixedGroups.map(([k]) => [k, []]));

  for (const r of results) {
    if (r.distanceMiles === null) {
      groupMap.get(modeKey)!.push(r);
      continue;
    }
    const d = cleanDist(r.distanceMiles);
    const rounded = Math.round(d);

    if (fixedKeys.has(rounded)) {
      groupMap.get(rounded)!.push(r);
      continue;
    }

    // Find nearest fixed group and its distance
    let nearestKey = fixedDistances[0];
    let nearestDiff = Math.abs(d - nearestKey);
    for (const fd of fixedDistances) {
      const diff = Math.abs(d - fd);
      if (diff < nearestDiff) { nearestKey = fd; nearestDiff = diff; }
    }

    if (nearestDiff <= 1.5) {
      groupMap.get(nearestKey)!.push(r);
    } else {
      if (!groupMap.has(rounded)) groupMap.set(rounded, []);
      groupMap.get(rounded)!.push(r);
    }
  }

  return [...groupMap.entries()]
    .sort(([a], [b]) => b - a)
    .map(([dist, records]) => ({
      name: `${dist} mi`,
      type: 'fixed-distance' as EventType,
      records,
    }));
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function isFinisher(status: FinishStatus): boolean {
  return status === 1 || status === 4; // Finished or Unofficial
}

function countByStatus(records: ResultRecord[]) {
  let finishers = 0, dnf = 0, dns = 0, unofficial = 0, dq = 0, belowThreshold = 0;
  for (const r of records) {
    switch (r.finishStatus) {
      case 1: finishers++; break;
      case 2: dnf++; break;
      case 3: dns++; break;
      case 4: unofficial++; break;
      case 5: dq++; break;
      case 6: belowThreshold++; break;
    }
  }
  return { finishers, dnf, dns, unofficial, dq, belowThreshold };
}

function pct(num: number, denom: number): number {
  return denom === 0 ? 0 : Math.round((num / denom) * 1000) / 10;
}

// ─── Course record / last finisher ───────────────────────────────────────────

function courseRecord(group: EventGroup, gender?: ResultRecord['gender']): PerformanceValue | null {
  const finishers = group.records.filter(r => isFinisher(r.finishStatus));
  const pool = gender ? finishers.filter(r => r.gender === gender) : finishers;
  if (pool.length === 0) return null;

  if (group.type === 'fixed-distance') {
    const withTime = pool.filter(r => r.timeSeconds !== null);
    if (withTime.length === 0) return null;
    const fastest = withTime.reduce((a, b) => a.timeSeconds! < b.timeSeconds! ? a : b);
    return {
      display: formatTime(fastest.timeSeconds!),
      seconds: fastest.timeSeconds!,
      miles: null,
      gender: fastest.gender,
    };
  } else {
    const withDist = pool.filter(r => r.distanceMiles !== null);
    if (withDist.length === 0) return null;
    const farthest = withDist.reduce((a, b) => a.distanceMiles! > b.distanceMiles! ? a : b);
    return {
      display: `${cleanDist(farthest.distanceMiles!).toFixed(1)} mi`,
      seconds: null,
      miles: cleanDist(farthest.distanceMiles!),
      gender: farthest.gender,
    };
  }
}

function lastFinisher(group: EventGroup): PerformanceValue | null {
  const finishers = group.records.filter(r => isFinisher(r.finishStatus));
  if (finishers.length === 0) return null;

  if (group.type === 'fixed-distance') {
    const withTime = finishers.filter(r => r.timeSeconds !== null);
    if (withTime.length === 0) return null;
    const slowest = withTime.reduce((a, b) => a.timeSeconds! > b.timeSeconds! ? a : b);
    return {
      display: formatTime(slowest.timeSeconds!),
      seconds: slowest.timeSeconds!,
      miles: null,
      gender: slowest.gender,
    };
  } else {
    const withDist = finishers.filter(r => r.distanceMiles !== null);
    if (withDist.length === 0) return null;
    const nearest = withDist.reduce((a, b) => a.distanceMiles! < b.distanceMiles! ? a : b);
    return {
      display: `${cleanDist(nearest.distanceMiles!).toFixed(1)} mi`,
      seconds: null,
      miles: cleanDist(nearest.distanceMiles!),
      gender: nearest.gender,
    };
  }
}

// ─── Summary stats ────────────────────────────────────────────────────────────

function computeSummary(groups: EventGroup[]): ResultsSummaryStats {
  const all = groups.flatMap(g => g.records);
  const counts = countByStatus(all);
  const total = all.length;

  const events: ResultsEventSummary[] = groups.map(g => {
    const gc = countByStatus(g.records);
    const gt = g.records.length;
    return {
      name: g.name,
      eventType: g.type,
      totalEntrants: gt,
      finishers: gc.finishers + gc.unofficial,
      dnf: gc.dnf,
      dns: gc.dns,
      finishRate: pct(gc.finishers + gc.unofficial, gt - gc.dns),
      courseRecord: courseRecord(g),
      lastFinisher: lastFinisher(g),
    };
  });

  const finishers = counts.finishers + counts.unofficial;
  const starters = total - counts.dns;

  return {
    totalEntrants: total,
    finishers,
    dnf: counts.dnf,
    dns: counts.dns,
    unofficial: counts.unofficial,
    dq: counts.dq,
    belowThreshold: counts.belowThreshold,
    finishRate: pct(finishers, starters),
    dnfRate: pct(counts.dnf, starters),
    events,
  };
}

// ─── Performance stats (finish time / distance achieved) ─────────────────────

const PERCENTILE_LABELS = ['10th', '25th', '50th', '75th', '90th'];
const PERCENTILE_VALUES = [10, 25, 50, 75, 90];

function buildBuckets<T extends number>(
  values: T[],
  labelFn: (v: T) => string,
  recordsWithValues: Array<{ value: T; gender: ResultRecord['gender'] }>,
  numBuckets = 10,
): Array<{ label: string; total: number; male: number; female: number; nonBinary: number }> {
  if (values.length === 0) return [];
  const min = values[0];
  const max = values[values.length - 1];
  if (min === max) {
    const g = recordsWithValues.reduce(
      (acc, r) => {
        if (r.gender === 'M') acc.male++;
        else if (r.gender === 'F') acc.female++;
        else if (r.gender === 'NB') acc.nonBinary++;
        return acc;
      },
      { male: 0, female: 0, nonBinary: 0 },
    );
    return [{ label: labelFn(min), total: values.length, ...g }];
  }
  const step = (max - min) / numBuckets;
  const buckets = Array.from({ length: numBuckets }, (_, i) => ({
    label: labelFn((min + step * i) as T),
    total: 0, male: 0, female: 0, nonBinary: 0,
  }));
  for (const { value, gender } of recordsWithValues) {
    const idx = Math.min(Math.floor((value - min) / step), numBuckets - 1);
    buckets[idx].total++;
    if (gender === 'M') buckets[idx].male++;
    else if (gender === 'F') buckets[idx].female++;
    else if (gender === 'NB') buckets[idx].nonBinary++;
  }
  return buckets.filter(b => b.total > 0);
}

function computeFinishTimeStats(finishers: ResultRecord[]): FinishTimeStats | null {
  const withTime = finishers
    .filter(r => r.timeSeconds !== null)
    .sort((a, b) => a.timeSeconds! - b.timeSeconds!);
  if (withTime.length === 0) return null;

  const times = withTime.map(r => r.timeSeconds!);
  const med = median(times)!;
  const avg = mean(times)!;

  const percentiles = PERCENTILE_VALUES.map((p, i) => ({
    label: PERCENTILE_LABELS[i],
    seconds: Math.round(percentileValue(times, p)),
  }));

  const buckets = buildBuckets(
    times,
    v => formatTime(Math.round(v)),
    withTime.map(r => ({ value: r.timeSeconds!, gender: r.gender })),
  );

  const genderGroups = (['M', 'F', 'NB', 'Unknown'] as const).map(g => {
    const pool = withTime.filter(r => r.gender === g);
    const gt = pool.map(r => r.timeSeconds!);
    return {
      gender: g,
      finishers: pool.length,
      medianSeconds: pool.length > 0 ? median(gt) : null,
      fastestSeconds: pool.length > 0 ? Math.min(...gt) : null,
      slowestSeconds: pool.length > 0 ? Math.max(...gt) : null,
    };
  }).filter(g => g.finishers > 0);

  return {
    medianSeconds: Math.round(med),
    meanSeconds: Math.round(avg),
    fastestSeconds: times[0],
    slowestSeconds: times[times.length - 1],
    percentiles,
    buckets,
    byGender: genderGroups,
  };
}

function computeDistanceStats(finishers: ResultRecord[]): DistanceAchievedStats | null {
  const withDist = finishers
    .filter(r => r.distanceMiles !== null)
    .map(r => ({ ...r, distanceMiles: cleanDist(r.distanceMiles!) }))
    .sort((a, b) => a.distanceMiles - b.distanceMiles);
  if (withDist.length === 0) return null;

  const dists = withDist.map(r => r.distanceMiles);
  const med = median(dists)!;
  const avg = mean(dists)!;

  const percentiles = PERCENTILE_VALUES.map((p, i) => ({
    label: PERCENTILE_LABELS[i],
    miles: Math.round(percentileValue(dists, p) * 10) / 10,
  }));

  const buckets = buildBuckets(
    dists,
    v => `${v.toFixed(1)} mi`,
    withDist.map(r => ({ value: r.distanceMiles, gender: r.gender })),
  );

  const genderGroups = (['M', 'F', 'NB', 'Unknown'] as const).map(g => {
    const pool = withDist.filter(r => r.gender === g);
    const gd = pool.map(r => r.distanceMiles);
    return {
      gender: g,
      finishers: pool.length,
      medianMiles: pool.length > 0 ? median(gd) : null,
      maxMiles: pool.length > 0 ? Math.max(...gd) : null,
      minMiles: pool.length > 0 ? Math.min(...gd) : null,
    };
  }).filter(g => g.finishers > 0);

  return {
    medianMiles: Math.round(med * 10) / 10,
    meanMiles: Math.round(avg * 10) / 10,
    maxMiles: dists[dists.length - 1],
    percentiles,
    buckets,
    byGender: genderGroups,
  };
}

function computePerformance(groups: EventGroup[]): PerformanceStats {
  const events: EventPerformanceStats[] = groups.map(g => {
    const finishers = g.records.filter(r => isFinisher(r.finishStatus));
    return {
      eventName: g.name,
      eventType: g.type,
      finishTime: g.type === 'fixed-distance' ? computeFinishTimeStats(finishers) : null,
      distanceAchieved: g.type === 'fixed-time' ? computeDistanceStats(finishers) : null,
    };
  });
  return { events };
}

// ─── Demographics ─────────────────────────────────────────────────────────────

const AGE_GROUPS = [
  { label: 'Under 20', min: 0,  max: 19  },
  { label: '20–29',    min: 20, max: 29  },
  { label: '30–39',    min: 30, max: 39  },
  { label: '40–49',    min: 40, max: 49  },
  { label: '50–59',    min: 50, max: 59  },
  { label: '60–69',    min: 60, max: 69  },
  { label: '70+',      min: 70, max: 999 },
];

function computeGenderStats(records: ResultRecord[]): GenderStats {
  let male = 0, female = 0, nonBinary = 0, unknown = 0;
  for (const r of records) {
    if (r.gender === 'M') male++;
    else if (r.gender === 'F') female++;
    else if (r.gender === 'NB') nonBinary++;
    else unknown++;
  }
  const total = records.length || 1;
  return {
    male, female, nonBinary, unknown,
    malePercent: Math.round((male / total) * 1000) / 10,
    femalePercent: Math.round((female / total) * 1000) / 10,
    nonBinaryPercent: Math.round((nonBinary / total) * 1000) / 10,
  };
}

function computeAgeStats(records: ResultRecord[]): AgeStats {
  const ages = records.map(r => r.age).filter((a): a is number => a !== null).sort((a, b) => a - b);
  const buckets: AgeBucket[] = AGE_GROUPS.map(g => ({
    label: g.label,
    count: ages.filter(a => a >= g.min && a <= g.max).length,
  }));
  return {
    min: ages.length > 0 ? ages[0] : null,
    max: ages.length > 0 ? ages[ages.length - 1] : null,
    mean: mean(ages) !== null ? Math.round(mean(ages)! * 10) / 10 : null,
    median: median(ages),
    buckets: buckets.filter(b => b.count > 0),
  };
}

function computeGenderAndAgeRows(records: ResultRecord[]): GenderAgeGroupRow[] {
  return AGE_GROUPS.map(g => {
    const inGroup = records.filter(r => r.age !== null && r.age >= g.min && r.age <= g.max);
    const male = inGroup.filter(r => r.gender === 'M');
    const female = inGroup.filter(r => r.gender === 'F');
    const nb = inGroup.filter(r => r.gender === 'NB');
    return {
      ageGroup: g.label,
      total: inGroup.length,
      male: male.length,
      female: female.length,
      nonBinary: nb.length,
      maleFinishCount: male.filter(r => isFinisher(r.finishStatus)).length,
      femaleFinishCount: female.filter(r => isFinisher(r.finishStatus)).length,
    };
  }).filter(row => row.total > 0);
}

function computeFinisherAgeByGender(finishers: ResultRecord[]) {
  return (['M', 'F', 'NB'] as const)
    .map(g => {
      const pool = finishers.filter(r => r.gender === g);
      const ages = pool.map(r => r.age).filter((a): a is number => a !== null).sort((a, b) => a - b);
      return {
        gender: g,
        min: ages.length > 0 ? ages[0] : null,
        max: ages.length > 0 ? ages[ages.length - 1] : null,
        median: ages.length > 0 ? median(ages) : null,
      };
    })
    .filter(g => g.min !== null || g.max !== null);
}

function computeDemographics(results: ResultRecord[]): ResultsDemographicsStats {
  const finishers = results.filter(r => isFinisher(r.finishStatus));
  return {
    gender: computeGenderStats(results),
    age: computeAgeStats(results),
    finisherGender: computeGenderStats(finishers),
    finisherAge: computeAgeStats(finishers),
    byGenderAndAge: computeGenderAndAgeRows(results),
    finisherAgeByGender: computeFinisherAgeByGender(finishers),
  };
}

// ─── Geographic ───────────────────────────────────────────────────────────────

// US state + territory abbreviations
const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC','PR','VI','GU','AS','MP',
]);

// Canadian province/territory abbreviations
const CA_PROVINCES = new Set([
  'AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT',
]);

// Infer country from state abbreviation when the country field is missing.
// UltraSignup results often omit the country column entirely.
function inferCountry(state: string, existingCountry: string): string {
  if (existingCountry && existingCountry !== 'Unknown') return existingCountry;
  const s = state.toUpperCase().trim();
  if (US_STATES.has(s)) return 'USA';
  if (CA_PROVINCES.has(s)) return 'CAN';
  return existingCountry || '';
}

function computeGeographic(results: ResultRecord[]): GeographicStats {
  const byState: Record<string, number> = {};
  const byCountry: Record<string, number> = {};

  for (const r of results) {
    if (r.state) byState[r.state] = (byState[r.state] ?? 0) + 1;
    const country = inferCountry(r.state, r.country);
    if (country) byCountry[country] = (byCountry[country] ?? 0) + 1;
  }

  const topStates = Object.entries(byState)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([state, count]) => ({ state, count }));

  const topCountries = Object.entries(byCountry)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([country, count]) => ({ country, count }));

  const usParticipants = byCountry['USA'] ?? 0;
  const internationalParticipants = results.length - usParticipants;

  return { byState, byCountry, topStates, topCountries, usParticipants, internationalParticipants };
}

// ─── Attrition ────────────────────────────────────────────────────────────────

function makeAttritionRow(name: string, records: ResultRecord[]): AttritionRow {
  const c = countByStatus(records);
  const finishers = c.finishers + c.unofficial;
  const starters = records.length - c.dns;
  return {
    name,
    total: records.length,
    finished: finishers,
    dnf: c.dnf,
    dns: c.dns,
    finishRate: pct(finishers, starters),
    dnfRate: pct(c.dnf, starters),
    dnsRate: pct(c.dns, records.length),
  };
}

function computeAttrition(groups: EventGroup[], results: ResultRecord[]): AttritionStats {
  const overall = makeAttritionRow('Overall', results);

  const byEvent = groups.length > 1
    ? groups.map(g => makeAttritionRow(g.name, g.records))
    : [];

  const byGender = (['M', 'F', 'NB'] as const).map(g => makeAttritionRow(
    g === 'M' ? 'Male' : g === 'F' ? 'Female' : 'Non-Binary',
    results.filter(r => r.gender === g),
  ));

  return { overall, byEvent, byGender };
}

// ─── Cross-event ──────────────────────────────────────────────────────────────

function computeCrossEvent(groups: EventGroup[]): ResultsCrossEventStats {
  if (groups.length <= 1) return { rows: [] };

  const rows: ResultsCrossEventRow[] = groups.map(g => {
    const finishers = g.records.filter(r => isFinisher(r.finishStatus));
    const starters = g.records.filter(r => r.finishStatus !== 3);
    const males = finishers.filter(r => r.gender === 'M');
    const females = finishers.filter(r => r.gender === 'F');
    const nonBinary = finishers.filter(r => r.gender === 'NB');
    const ages = finishers.map(r => r.age).filter((a): a is number => a !== null);
    const cr = courseRecord(g);
    const lf = lastFinisher(g);
    return {
      name: g.name,
      eventType: g.type,
      totalEntrants: g.records.length,
      finishers: finishers.length,
      finishRate: pct(finishers.length, starters.length),
      maleFinishers: males.length,
      femaleFinishers: females.length,
      nonBinaryFinishers: nonBinary.length,
      malePercent: pct(males.length, finishers.length),
      femalePercent: pct(females.length, finishers.length),
      nonBinaryPercent: pct(nonBinary.length, finishers.length),
      avgAge: ages.length > 0 ? Math.round(mean(ages)! * 10) / 10 : null,
      courseRecord: cr ? cr.display : null,
      lastFinisher: lf ? lf.display : null,
    };
  });

  return { rows };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeResultsStats(results: ResultRecord[]): ResultsStats {
  const groups = detectEventGroups(results);

  return {
    summary: computeSummary(groups),
    performance: computePerformance(groups),
    demographics: computeDemographics(results),
    geographic: computeGeographic(results),
    attrition: computeAttrition(groups, results),
    crossEvent: computeCrossEvent(groups),
  };
}
