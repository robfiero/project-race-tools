import type {
  ResultRecord,
  ResultsStats,
  ResultsSummaryStats,
  ResultsEventSummary,
  PerformanceStats,
  EventPerformanceStats,
  FinishTimeStats,
  DistanceAchievedStats,
  PaceStats,
  PaceBucket,
  PaceGenderStats,
  PaceAgeGroupStats,
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
  AgeGroupPerformanceRow,
  AgeGroupPerformanceStats,
  AgeGroupPerformanceByEvent,
  DivisionPerformanceRow,
  DivisionPerformanceStats,
  DivisionPerformanceByEvent,
  PerformanceBandRow,
  PerformanceBandStats,
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
      participantAge: computeAgeStats(g.records),
      gender: computeGenderStats(g.records),
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
      meanSeconds: pool.length > 0 ? Math.round(mean(gt)!) : null,
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

function buildDistanceBuckets(dists: number[]): Array<{ label: string; count: number }> {
  if (dists.length === 0) return [];
  const minD = dists[0];
  const maxD = dists[dists.length - 1];
  const spread = maxD - minD;
  const width = spread <= 25 ? 5 : spread <= 60 ? 10 : 15;
  const firstStart = Math.floor(minD / width) * width;
  const lastEnd = Math.ceil(maxD / width) * width;
  const buckets: Array<{ label: string; count: number }> = [];
  for (let start = firstStart; start < lastEnd; start += width) {
    const end = start + width;
    buckets.push({
      label: `${start}–${end - 1} mi`,
      count: dists.filter(d => d >= start && d < end).length,
    });
  }
  return buckets.filter(b => b.count > 0);
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
  const minD = dists[0];
  const maxD = dists[dists.length - 1];

  const percentiles = PERCENTILE_VALUES.map((p, i) => ({
    label: PERCENTILE_LABELS[i],
    miles: Math.round(percentileValue(dists, p) * 10) / 10,
  }));

  const buckets = buildBuckets(
    dists,
    v => `${v.toFixed(1)} mi`,
    withDist.map(r => ({ value: r.distanceMiles, gender: r.gender })),
  );

  const distBuckets = buildDistanceBuckets(dists);

  const genderGroups = (['M', 'F', 'NB', 'Unknown'] as const).map(g => {
    const pool = withDist.filter(r => r.gender === g);
    const gd = pool.map(r => r.distanceMiles);
    return {
      gender: g,
      finishers: pool.length,
      medianMiles: pool.length > 0 ? Math.round(median(gd)! * 10) / 10 : null,
      meanMiles: pool.length > 0 ? Math.round(mean(gd)! * 10) / 10 : null,
      maxMiles: pool.length > 0 ? Math.round(Math.max(...gd) * 10) / 10 : null,
      minMiles: pool.length > 0 ? Math.round(Math.min(...gd) * 10) / 10 : null,
    };
  }).filter(g => g.finishers > 0);

  const ageGroups = AGE_GROUPS.flatMap(g => {
    const pool = withDist.filter(r => r.age !== null && r.age >= g.min && r.age <= g.max);
    if (pool.length === 0) return [];
    const ad = pool.map(r => r.distanceMiles).sort((a, b) => a - b);
    return [{
      ageGroup: g.label,
      finishers: pool.length,
      medianMiles: Math.round(median(ad)! * 10) / 10,
      meanMiles: Math.round(mean(ad)! * 10) / 10,
      maxMiles: Math.round(Math.max(...ad) * 10) / 10,
      minMiles: Math.round(Math.min(...ad) * 10) / 10,
    }];
  });

  return {
    medianMiles: Math.round(med * 10) / 10,
    meanMiles: Math.round(avg * 10) / 10,
    maxMiles: Math.round(maxD * 10) / 10,
    minMiles: Math.round(minD * 10) / 10,
    spreadMiles: Math.round((maxD - minD) * 10) / 10,
    percentiles,
    buckets,
    distBuckets,
    byGender: genderGroups,
    byAgeGroup: ageGroups,
  };
}

function computePaceStats(finishers: ResultRecord[], distanceMiles: number): PaceStats | null {
  if (finishers.length === 0 || distanceMiles <= 0) return null;

  const paces = finishers
    .filter(r => r.timeSeconds !== null && r.timeSeconds > 0)
    .map(r => r.timeSeconds! / distanceMiles)
    .sort((a, b) => a - b);

  if (paces.length === 0) return null;

  const fastestSecsPerMile = paces[0];
  const slowestSecsPerMile = paces[paces.length - 1];
  const spreadSecsPerMile = slowestSecsPerMile - fastestSecsPerMile;
  const medianVal = median(paces)!;
  const meanVal = mean(paces)!;

  // Determine bucket width based on spread in minutes
  const spreadMinutes = spreadSecsPerMile / 60;
  const bucketWidthSecs = spreadMinutes <= 10 ? 60 : spreadMinutes <= 20 ? 120 : 300;

  // Align buckets to minute boundaries
  const firstBucketStart = Math.floor(fastestSecsPerMile / bucketWidthSecs) * bucketWidthSecs;
  const lastBucketEnd = Math.ceil(slowestSecsPerMile / bucketWidthSecs) * bucketWidthSecs;

  const buckets: PaceBucket[] = [];
  for (let start = firstBucketStart; start < lastBucketEnd; start += bucketWidthSecs) {
    const end = start + bucketWidthSecs;
    const startMin = Math.floor(start / 60);
    const endMin = Math.floor(end / 60);
    const label = `${startMin}–${endMin}`;
    buckets.push({
      label,
      count: paces.filter(p => p >= start && p < end).length,
      minSecsPerMile: start,
      maxSecsPerMile: end,
    });
  }

  // By gender
  const genderKeys: Array<'M' | 'F' | 'NB'> = ['M', 'F', 'NB'];
  const byGender: PaceGenderStats[] = genderKeys.flatMap(g => {
    const gFinishers = finishers.filter(r => r.gender === g && r.timeSeconds !== null && r.timeSeconds > 0);
    if (gFinishers.length === 0) return [];
    const gPaces = gFinishers.map(r => r.timeSeconds! / distanceMiles).sort((a, b) => a - b);
    return [{
      gender: g,
      finishers: gPaces.length,
      medianSecsPerMile: median(gPaces)!,
      fastestSecsPerMile: gPaces[0],
      slowestSecsPerMile: gPaces[gPaces.length - 1],
    }];
  });

  // By age group
  const byAgeGroup: PaceAgeGroupStats[] = AGE_GROUPS.flatMap(g => {
    const agFinishers = finishers.filter(
      r => r.age !== null && r.age >= g.min && r.age <= g.max && r.timeSeconds !== null && r.timeSeconds > 0,
    );
    if (agFinishers.length === 0) return [];
    const agPaces = agFinishers.map(r => r.timeSeconds! / distanceMiles).sort((a, b) => a - b);
    return [{
      ageGroup: g.label,
      finishers: agPaces.length,
      medianSecsPerMile: median(agPaces)!,
      fastestSecsPerMile: agPaces[0],
      slowestSecsPerMile: agPaces[agPaces.length - 1],
    }];
  });

  return {
    medianSecsPerMile: medianVal,
    meanSecsPerMile: meanVal,
    fastestSecsPerMile,
    slowestSecsPerMile,
    spreadSecsPerMile,
    buckets,
    byGender,
    byAgeGroup,
  };
}

function computePerformance(groups: EventGroup[]): PerformanceStats {
  const events: EventPerformanceStats[] = groups.map(g => {
    const finishers = g.records.filter(r => isFinisher(r.finishStatus));

    let paceStats: PaceStats | null = null;
    if (g.type === 'fixed-distance') {
      const distanceMiles = finishers.find(r => r.distanceMiles !== null)?.distanceMiles ?? null;
      if (distanceMiles !== null && distanceMiles > 0) {
        paceStats = computePaceStats(finishers, distanceMiles);
      }
    }

    return {
      eventName: g.name,
      eventType: g.type,
      finishTime: g.type === 'fixed-distance' ? computeFinishTimeStats(finishers) : null,
      distanceAchieved: g.type === 'fixed-time' ? computeDistanceStats(finishers) : null,
      paceStats,
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

function ageGroupLabelForAge(age: number): string {
  return AGE_GROUPS.find(g => age >= g.min && age <= g.max)?.label ?? '70+';
}

// Division Performance is an award-division view, distinct from Age Group
// Performance. When gender and age are known, derive gender+age rows such as
// Male 30–39, Female 30–39, and Non-Binary 30–39. Fall back to the uploaded
// divisionName when a generated label is unsafe; Non-Binary entrants must never
// be collapsed into Male/Female labels.
function divisionPerformanceLabel(record: ResultRecord): string {
  if ((record.gender === 'M' || record.gender === 'F' || record.gender === 'NB') && record.age !== null) {
    const genderLabel = record.gender === 'M'
      ? 'Male'
      : record.gender === 'F'
        ? 'Female'
        : 'Non-Binary';
    return `${genderLabel} ${ageGroupLabelForAge(record.age)}`;
  }

  return record.divisionName.trim();
}

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

function computeAgeDistributionByEvent(groups: EventGroup[]) {
  return groups.map(group => ({
    eventName: group.name,
    eventType: group.type,
    finisherAge: computeAgeStats(group.records.filter(r => isFinisher(r.finishStatus))),
  }));
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
  return '';
}

function computeGeographic(results: ResultRecord[]): GeographicStats {
  const byState: Record<string, number> = {};
  const byCountry: Record<string, number> = {};

  for (const r of results) {
    if (r.state && r.state !== 'Unknown') byState[r.state] = (byState[r.state] ?? 0) + 1;
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
  const internationalParticipants = Object.entries(byCountry)
    .filter(([country]) => country !== 'USA')
    .reduce((sum, [, count]) => sum + count, 0);
  const unknownLocationParticipants = results.length - usParticipants - internationalParticipants;

  return { byState, byCountry, topStates, topCountries, usParticipants, internationalParticipants, unknownLocationParticipants };
}

function computeGeographicDistributionByEvent(groups: EventGroup[]) {
  return groups.map(group => ({
    eventName: group.name,
    eventType: group.type,
    geographic: computeGeographic(group.records),
  }));
}

// ─── Attrition ────────────────────────────────────────────────────────────────

function makeAttritionRow(name: string, records: ResultRecord[]): AttritionRow {
  const c = countByStatus(records);
  const finishers = c.finishers + c.unofficial;
  const starters = records.length - c.dns;
  return {
    name,
    total: records.length,
    starters,
    finished: finishers,
    dnf: c.dnf,
    dns: c.dns,
    startRate: pct(starters, records.length),
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

    let fastestSeconds: number | null = null;
    let medianSeconds: number | null = null;
    let lastSeconds: number | null = null;
    let avgPaceSecsPerMile: number | null = null;
    let medianPaceSecsPerMile: number | null = null;
    let farthestMiles: number | null = null;
    let medianMiles: number | null = null;
    let meanMiles: number | null = null;
    let shortestMiles: number | null = null;
    let spreadMiles: number | null = null;

    if (g.type === 'fixed-distance') {
      const ft = computeFinishTimeStats(finishers);
      if (ft) {
        fastestSeconds = ft.fastestSeconds;
        medianSeconds = Math.round(ft.medianSeconds);
        lastSeconds = ft.slowestSeconds;
      }
      const rawDist = finishers.map(r => r.distanceMiles).find((d): d is number => d !== null) ?? null;
      const distMiles = rawDist !== null ? cleanDist(rawDist) : null;
      if (distMiles !== null && distMiles > 0) {
        const ps = computePaceStats(finishers, distMiles);
        if (ps) {
          avgPaceSecsPerMile = ps.meanSecsPerMile;
          medianPaceSecsPerMile = ps.medianSecsPerMile;
        }
      }
    } else {
      const ds = computeDistanceStats(finishers);
      if (ds) {
        farthestMiles = ds.maxMiles;
        medianMiles = ds.medianMiles;
        meanMiles = ds.meanMiles;
        shortestMiles = ds.minMiles;
        spreadMiles = ds.spreadMiles;
      }
    }

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
      fastestSeconds,
      medianSeconds,
      lastSeconds,
      avgPaceSecsPerMile,
      medianPaceSecsPerMile,
      farthestMiles,
      medianMiles,
      meanMiles,
      shortestMiles,
      spreadMiles,
    };
  });

  return { rows };
}

// ─── Age group performance ────────────────────────────────────────────────────

function genderMedianPace(finishers: ResultRecord[], distanceMiles: number): number | null {
  const paces = finishers
    .filter(r => r.timeSeconds !== null && r.timeSeconds > 0)
    .map(r => r.timeSeconds! / distanceMiles)
    .sort((a, b) => a - b);
  return paces.length > 0 ? median(paces) : null;
}

function genderMedianMiles(finishers: ResultRecord[]): number | null {
  const miles = finishers
    .filter(r => r.distanceMiles !== null)
    .map(r => cleanDist(r.distanceMiles!))
    .sort((a, b) => a - b);
  return miles.length > 0 ? median(miles) : null;
}

function computeAgeGroupPerformanceForGroup(group: EventGroup): AgeGroupPerformanceStats {
  const eventType = group.type;

  const paceByAgeGroup = new Map<string, { medianSecsPerMile: number; fastestSecsPerMile: number; slowestSecsPerMile: number }>();
  const distByAgeGroup = new Map<string, { medianMiles: number | null; maxMiles: number | null; minMiles: number | null }>();

  // Hoisted so gender-pace computation inside the flatMap can access it.
  let eventDistanceMiles: number | null = null;

  if (eventType === 'fixed-distance') {
    const finishers = group.records.filter(r => isFinisher(r.finishStatus));
    const distanceMiles = finishers.find(r => r.distanceMiles !== null)?.distanceMiles ?? null;
    eventDistanceMiles = distanceMiles;
    if (distanceMiles !== null && distanceMiles > 0) {
      const ps = computePaceStats(finishers, distanceMiles);
      if (ps) {
        for (const row of ps.byAgeGroup) {
          paceByAgeGroup.set(row.ageGroup, row);
        }
      }
    }
  } else {
    const finishers = group.records.filter(r => isFinisher(r.finishStatus));
    const ds = computeDistanceStats(finishers);
    if (ds) {
      for (const row of ds.byAgeGroup) {
        distByAgeGroup.set(row.ageGroup, { medianMiles: row.medianMiles, maxMiles: row.maxMiles, minMiles: row.minMiles });
      }
    }
  }

  const rows: AgeGroupPerformanceRow[] = AGE_GROUPS.flatMap(g => {
    const inGroup = group.records.filter(r => r.age !== null && r.age >= g.min && r.age <= g.max);
    if (inGroup.length === 0) return [];
    const attrRow = makeAttritionRow(g.label, inGroup);
    const groupFinishers = inGroup.filter(r => isFinisher(r.finishStatus));

    // Gender sub-groups (entrants)
    const maleGroup    = inGroup.filter(r => r.gender === 'M');
    const femaleGroup  = inGroup.filter(r => r.gender === 'F');
    const nbGroup      = inGroup.filter(r => r.gender === 'NB');

    // Gender finish rates
    const maleAtr   = makeAttritionRow(g.label, maleGroup);
    const femaleAtr = makeAttritionRow(g.label, femaleGroup);
    const nbAtr     = makeAttritionRow(g.label, nbGroup);

    // Gender finisher counts — same scope as pace/distance
    const maleFinishers   = groupFinishers.filter(r => r.gender === 'M');
    const femaleFinishers = groupFinishers.filter(r => r.gender === 'F');
    const nbFinishers     = groupFinishers.filter(r => r.gender === 'NB');

    // Gender-specific performance
    let malePaceSecsPerMile:    number | null = null;
    let femalePaceSecsPerMile:  number | null = null;
    let nonBinaryPaceSecsPerMile: number | null = null;
    let maleMiles:    number | null = null;
    let femaleMiles:  number | null = null;
    let nonBinaryMiles: number | null = null;

    if (eventType === 'fixed-distance' && eventDistanceMiles !== null && eventDistanceMiles > 0) {
      malePaceSecsPerMile      = genderMedianPace(maleFinishers,   eventDistanceMiles);
      femalePaceSecsPerMile    = genderMedianPace(femaleFinishers, eventDistanceMiles);
      nonBinaryPaceSecsPerMile = genderMedianPace(nbFinishers,     eventDistanceMiles);
    } else if (eventType === 'fixed-time') {
      maleMiles      = genderMedianMiles(maleFinishers);
      femaleMiles    = genderMedianMiles(femaleFinishers);
      nonBinaryMiles = genderMedianMiles(nbFinishers);
    }

    const pace = paceByAgeGroup.get(g.label) ?? null;
    const dist = distByAgeGroup.get(g.label) ?? null;
    return [{
      ageGroup: g.label,
      total: attrRow.total,
      finishers: attrRow.finished,
      maleFinishers: maleFinishers.length,
      femaleFinishers: femaleFinishers.length,
      nonBinaryFinishers: nbFinishers.length,
      finishRate: attrRow.finishRate,
      dnf: attrRow.dnf,
      dnfRate: attrRow.dnfRate,
      dns: attrRow.dns,
      dnsRate: attrRow.dnsRate,
      maleTotal: maleGroup.length,
      femaleTotal: femaleGroup.length,
      nonBinaryTotal: nbGroup.length,
      maleFinishRate: maleAtr.finishRate,
      femaleFinishRate: femaleAtr.finishRate,
      nonBinaryFinishRate: nbAtr.finishRate,
      malePaceSecsPerMile,
      femalePaceSecsPerMile,
      nonBinaryPaceSecsPerMile,
      maleMiles,
      femaleMiles,
      nonBinaryMiles,
      medianPaceSecsPerMile: pace?.medianSecsPerMile ?? null,
      fastestPaceSecsPerMile: pace?.fastestSecsPerMile ?? null,
      slowestPaceSecsPerMile: pace?.slowestSecsPerMile ?? null,
      medianMiles: dist?.medianMiles ?? null,
      maxMiles: dist?.maxMiles ?? null,
      minMiles: dist?.minMiles ?? null,
    }];
  });

  return { rows, eventType };
}

function computeAgeGroupPerformance(groups: EventGroup[]): AgeGroupPerformanceStats | null {
  if (groups.length === 0) return null;
  const stats = computeAgeGroupPerformanceForGroup(groups[0]);
  return stats.rows.length > 0 ? stats : null;
}

function computeAgeGroupPerformanceByEvent(groups: EventGroup[]): AgeGroupPerformanceByEvent[] {
  return groups.map(group => {
    const stats = computeAgeGroupPerformanceForGroup(group);
    return {
      eventName: group.name,
      eventType: stats.eventType,
      rows: stats.rows,
    };
  });
}

function computeDivisionPerformanceForGroup(group: EventGroup): DivisionPerformanceStats {
  const eventType = group.type;

  // Scope division rows to this event so counts and performance metrics
  // describe the same runner set.
  const divisionNames = [...new Set(group.records.map(divisionPerformanceLabel).filter(d => d !== ''))].sort();

  // Precompute pace or distance per division for event finishers.
  const paceByDivision = new Map<string, { medianSecsPerMile: number; fastestSecsPerMile: number; slowestSecsPerMile: number }>();
  const distByDivision = new Map<string, { medianMiles: number | null; maxMiles: number | null; minMiles: number | null }>();

  if (eventType === 'fixed-distance') {
    const rawDist = group.records.find(r => r.distanceMiles !== null)?.distanceMiles ?? null;
    const distanceMiles = rawDist !== null ? cleanDist(rawDist) : null;
    if (distanceMiles !== null && distanceMiles > 0) {
      const groupFinishers = group.records.filter(r => isFinisher(r.finishStatus));
      for (const div of divisionNames) {
        const divFinishers = groupFinishers.filter(r => divisionPerformanceLabel(r) === div && r.timeSeconds !== null && r.timeSeconds > 0);
        if (divFinishers.length === 0) continue;
        const paces = divFinishers.map(r => r.timeSeconds! / distanceMiles).sort((a, b) => a - b);
        const med = median(paces);
        if (med !== null) {
          paceByDivision.set(div, {
            medianSecsPerMile: med,
            fastestSecsPerMile: paces[0],
            slowestSecsPerMile: paces[paces.length - 1],
          });
        }
      }
    }
  } else {
    const groupFinishers = group.records.filter(r => isFinisher(r.finishStatus));
    for (const div of divisionNames) {
      const divFinishers = groupFinishers.filter(r => divisionPerformanceLabel(r) === div && r.distanceMiles !== null);
      if (divFinishers.length === 0) continue;
      const miles = divFinishers.map(r => r.distanceMiles!).sort((a, b) => a - b);
      const med = median(miles);
      distByDivision.set(div, {
        medianMiles: med,
        maxMiles: miles[miles.length - 1],
        minMiles: miles[0],
      });
    }
  }

  const rows: DivisionPerformanceRow[] = divisionNames.flatMap(div => {
    const inDiv = group.records.filter(r => divisionPerformanceLabel(r) === div);
    if (inDiv.length === 0) return [];
    const attrRow = makeAttritionRow(div, inDiv);
    const divFinishers = inDiv.filter(r => isFinisher(r.finishStatus));
    const pace = paceByDivision.get(div) ?? null;
    const dist = distByDivision.get(div) ?? null;
    return [{
      division: div,
      total: attrRow.total,
      finishers: attrRow.finished,
      maleFinishers: divFinishers.filter(r => r.gender === 'M').length,
      femaleFinishers: divFinishers.filter(r => r.gender === 'F').length,
      nonBinaryFinishers: divFinishers.filter(r => r.gender === 'NB').length,
      finishRate: attrRow.finishRate,
      dnf: attrRow.dnf,
      dnfRate: attrRow.dnfRate,
      dns: attrRow.dns,
      dnsRate: attrRow.dnsRate,
      medianPaceSecsPerMile: pace?.medianSecsPerMile ?? null,
      fastestPaceSecsPerMile: pace?.fastestSecsPerMile ?? null,
      slowestPaceSecsPerMile: pace?.slowestSecsPerMile ?? null,
      medianMiles: dist?.medianMiles ?? null,
      maxMiles: dist?.maxMiles ?? null,
      minMiles: dist?.minMiles ?? null,
    }];
  });

  return { rows, eventType };
}

function computeDivisionPerformance(groups: EventGroup[]): DivisionPerformanceStats | null {
  if (groups.length === 0) return null;
  const stats = computeDivisionPerformanceForGroup(groups[0]);
  return stats.rows.length > 0 ? stats : null;
}

function computeDivisionPerformanceByEvent(groups: EventGroup[]): DivisionPerformanceByEvent[] {
  return groups.map(group => {
    const stats = computeDivisionPerformanceForGroup(group);
    return {
      eventName: group.name,
      eventType: stats.eventType,
      rows: stats.rows,
    };
  });
}

function computePerformanceBandsForGroup(group: EventGroup): PerformanceBandStats['events'][number] | null {
  const eventType = group.type;
  const allFinishers = group.records.filter(r => isFinisher(r.finishStatus));
  const n = allFinishers.length;
  if (n < 5) return null;

  type BandDef = { label: string; start: number; end: number };

  let sorted: ResultRecord[];
  let bandDefs: BandDef[];

  if (eventType === 'fixed-distance') {
    sorted = [...allFinishers].sort((a, b) => (a.timeSeconds ?? Infinity) - (b.timeSeconds ?? Infinity));
    const f10 = Math.max(1, Math.floor(n * 0.10));
    const f25 = Math.max(1, Math.floor(n * 0.25));
    const b25 = Math.max(1, Math.floor(n * 0.25));
    const b10 = Math.max(1, Math.floor(n * 0.10));
    bandDefs = [
      { label: 'Front 10%', start: 0,          end: f10 },
      { label: 'Front 25%', start: 0,          end: f25 },
      { label: 'Middle 50%', start: f25,        end: n - b25 },
      { label: 'Back 25%',  start: n - b25,    end: n },
      { label: 'Back 10%',  start: n - b10,    end: n },
    ];
  } else {
    sorted = [...allFinishers].sort((a, b) => (b.distanceMiles ?? 0) - (a.distanceMiles ?? 0));
    const f10 = Math.max(1, Math.floor(n * 0.10));
    const f25 = Math.max(1, Math.floor(n * 0.25));
    const b25 = Math.max(1, Math.floor(n * 0.25));
    const b10 = Math.max(1, Math.floor(n * 0.10));
    bandDefs = [
      { label: 'Front 10%', start: 0,          end: f10 },
      { label: 'Front 25%', start: 0,          end: f25 },
      { label: 'Middle 50%', start: f25,        end: n - b25 },
      { label: 'Back 25%',  start: n - b25,    end: n },
      { label: 'Back 10%',  start: n - b10,    end: n },
    ];
  }

  const rawDist = group.records.find(r => r.distanceMiles !== null)?.distanceMiles ?? null;
  const distanceMiles = rawDist !== null ? cleanDist(rawDist) : null;

  const rows: PerformanceBandRow[] = bandDefs.flatMap(({ label, start, end }) => {
    const band = sorted.slice(start, end);
    if (band.length === 0) return [];

    const ages = band.map(r => r.age).filter((a): a is number => a !== null).sort((a, b) => a - b);

    let fastestSeconds: number | null = null;
    let medianSeconds: number | null = null;
    let slowestSeconds: number | null = null;
    let medianPaceSecsPerMile: number | null = null;
    let farthestMiles: number | null = null;
    let medianMiles: number | null = null;
    let shortestMiles: number | null = null;

    if (eventType === 'fixed-distance') {
      const times = band.map(r => r.timeSeconds).filter((t): t is number => t !== null && t > 0).sort((a, b) => a - b);
      if (times.length > 0) {
        fastestSeconds = times[0];
        slowestSeconds = times[times.length - 1];
        medianSeconds  = median(times);
        if (distanceMiles !== null && distanceMiles > 0 && medianSeconds !== null) {
          medianPaceSecsPerMile = medianSeconds / distanceMiles;
        }
      }
    } else {
      const miles = band.map(r => r.distanceMiles).filter((d): d is number => d !== null).sort((a, b) => a - b);
      if (miles.length > 0) {
        shortestMiles  = miles[0];
        farthestMiles  = miles[miles.length - 1];
        medianMiles    = median(miles);
      }
    }

    return [{
      label,
      finishers: band.length,
      percentOfFinishers: (band.length / n) * 100,
      maleFinishers: band.filter(r => r.gender === 'M').length,
      femaleFinishers: band.filter(r => r.gender === 'F').length,
      nonBinaryFinishers: band.filter(r => r.gender === 'NB').length,
      meanAge: mean(ages.map(a => a)),
      medianAge: median(ages),
      fastestSeconds,
      medianSeconds,
      slowestSeconds,
      medianPaceSecsPerMile,
      farthestMiles,
      medianMiles,
      shortestMiles,
    }];
  });

  if (rows.length === 0) return null;
  return { eventName: group.name, rows, eventType, totalFinishers: n };
}

function computePerformanceBands(groups: EventGroup[]): PerformanceBandStats | null {
  if (groups.length === 0) return null;

  const events = groups.flatMap(g => {
    const bands = computePerformanceBandsForGroup(g);
    return bands ? [bands] : [];
  });
  if (events.length === 0) return null;

  const primary = events[0];
  return {
    rows: primary.rows,
    eventType: primary.eventType,
    totalFinishers: primary.totalFinishers,
    events,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeResultsStats(results: ResultRecord[]): ResultsStats {
  const groups = detectEventGroups(results);

  // Top-level fields remain for overall, legacy, and primary-event consumers.
  // By-event arrays let selected-event report sections avoid mixing co-event
  // records; event-scoped sections should prefer them when available.
  return {
    summary: computeSummary(groups),
    performance: computePerformance(groups),
    demographics: computeDemographics(results),
    ageDistributionByEvent: computeAgeDistributionByEvent(groups),
    geographic: computeGeographic(results),
    geographicDistributionByEvent: computeGeographicDistributionByEvent(groups),
    attrition: computeAttrition(groups, results),
    crossEvent: computeCrossEvent(groups),
    ageGroupPerformance: computeAgeGroupPerformance(groups),
    ageGroupPerformanceByEvent: computeAgeGroupPerformanceByEvent(groups),
    divisionPerformance: computeDivisionPerformance(groups),
    divisionPerformanceByEvent: computeDivisionPerformanceByEvent(groups),
    performanceBands: computePerformanceBands(groups),
  };
}
