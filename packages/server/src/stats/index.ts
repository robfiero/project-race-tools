import type {
  ParticipantRecord,
  RaceStats,
  SummaryStats,
  GenderStats,
  AgeStats,
  AgeBucket,
  GeographicStats,
  DistanceStats,
  RegistrationStats,
  EventRegistrationStats,
  RegistrantProfile,
  CrossEventStats,
  CrossEventRow,
  ParticipationStats,
  ParticipantStatusStats,
  ParticipantStatusCounts,
  TeamStats,
} from '../types.js';
import { resolveParticipantLocation } from '../geo/participantLocation.js';
import { haversineDistance } from '../geo/haversine.js';

// Filter participants by selected event names. Empty array = all events.
export function filterByEvents(
  participants: ParticipantRecord[],
  events: string[]
): ParticipantRecord[] {
  if (events.length === 0) return participants;
  const set = new Set(events);
  return participants.filter(p => set.has(p.event));
}

export function computeStats(
  participants: ParticipantRecord[],
  venueLat: number | null,
  venueLng: number | null,
  venueAddress: string | null,
  timezone: string,
): RaceStats {
  const hasVenue = venueLat !== null && venueLng !== null && venueAddress !== null;

  return {
    summary: computeSummary(participants),
    gender: computeGender(participants),
    age: computeAge(participants),
    geographic: computeGeographic(participants),
    distance: hasVenue
      ? computeDistance(participants, venueLat!, venueLng!, venueAddress!)
      : null,
    registration: computeRegistration(
      participants,
      hasVenue ? venueLat! : null,
      hasVenue ? venueLng! : null,
      timezone,
    ),
    crossEvent: computeCrossEvent(
      participants,
      hasVenue ? venueLat! : null,
      hasVenue ? venueLng! : null,
    ),
    participation: computeParticipation(participants),
    teams: computeTeams(participants),
  };
}

// ─── Summary ────────────────────────────────────────────────────────────────

function computeSummary(participants: ParticipantRecord[]): SummaryStats {
  const eventMap = new Map<string, { count: number; activeCount: number }>();
  for (const p of participants) {
    const e = eventMap.get(p.event) ?? { count: 0, activeCount: 0 };
    e.count++;
    if (!p.removed && !p.droppingFromRace) e.activeCount++;
    eventMap.set(p.event, e);
  }
  return {
    totalParticipants: participants.length,
    activeParticipants: participants.filter(p => !p.removed && !p.droppingFromRace).length,
    events: [...eventMap.entries()].map(([name, v]) => ({ name, ...v })),
  };
}

// ─── Gender ─────────────────────────────────────────────────────────────────

function computeGender(participants: ParticipantRecord[]): GenderStats {
  let male = 0, female = 0, nonBinary = 0, unknown = 0;
  for (const p of participants) {
    if (p.gender === 'M') male++;
    else if (p.gender === 'F') female++;
    else if (p.gender === 'NB') nonBinary++;
    else unknown++;
  }
  const total = participants.length || 1;
  return {
    male, female, nonBinary, unknown,
    malePercent: round2(male / total * 100),
    femalePercent: round2(female / total * 100),
    nonBinaryPercent: round2(nonBinary / total * 100),
  };
}

// ─── Age ────────────────────────────────────────────────────────────────────

const AGE_BUCKETS = [
  { label: 'Under 20', min: 0,  max: 19 },
  { label: '20–29',    min: 20, max: 29 },
  { label: '30–39',    min: 30, max: 39 },
  { label: '40–49',    min: 40, max: 49 },
  { label: '50–59',    min: 50, max: 59 },
  { label: '60–69',    min: 60, max: 69 },
  { label: '70+',      min: 70, max: Infinity },
];

function computeAge(participants: ParticipantRecord[]): AgeStats {
  const ages = participants.map(p => p.age).filter((a): a is number => a !== null);
  if (ages.length === 0) {
    return { min: null, max: null, mean: null, median: null, buckets: [] };
  }
  ages.sort((a, b) => a - b);
  const sum = ages.reduce((s, a) => s + a, 0);

  const buckets: AgeBucket[] = AGE_BUCKETS.map(b => ({
    label: b.label,
    count: ages.filter(a => a >= b.min && a <= b.max).length,
  }));

  return {
    min: ages[0],
    max: ages[ages.length - 1],
    mean: round2(sum / ages.length),
    median: round2(medianOf(ages)),
    buckets,
  };
}

// ─── Geographic ─────────────────────────────────────────────────────────────

const US_STATES_P = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC','PR','VI','GU','AS','MP',
]);

const CA_PROVINCES_P = new Set([
  'AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT',
]);

function inferCountryP(state: string, existingCountry: string): string {
  if (existingCountry && existingCountry !== 'Unknown') return existingCountry;
  const s = state.toUpperCase().trim();
  if (US_STATES_P.has(s)) return 'USA';
  if (CA_PROVINCES_P.has(s)) return 'CAN';
  return existingCountry || '';
}

function computeGeographic(participants: ParticipantRecord[]): GeographicStats {
  const byState: Record<string, number> = {};
  const byCountry: Record<string, number> = {};

  for (const p of participants) {
    if (p.state) byState[p.state] = (byState[p.state] ?? 0) + 1;
    const country = inferCountryP(p.state, p.country);
    if (country && country !== 'Unknown') byCountry[country] = (byCountry[country] ?? 0) + 1;
  }

  const topStates = Object.entries(byState)
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const topCountries = Object.entries(byCountry)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const usParticipants = byCountry['USA'] ?? 0;

  return {
    byState,
    byCountry,
    topStates,
    topCountries,
    usParticipants,
    internationalParticipants: participants.length - usParticipants,
  };
}

// ─── Distance Traveled ──────────────────────────────────────────────────────

const DISTANCE_BUCKETS = [
  { label: 'Under 25 mi', min: 0,   max: 24.9 },
  { label: '25–49 mi',    min: 25,  max: 49.9 },
  { label: '50–99 mi',    min: 50,  max: 99.9 },
  { label: '100–199 mi',  min: 100, max: 199.9 },
  { label: '200–499 mi',  min: 200, max: 499.9 },
  { label: '500+ mi',     min: 500, max: Infinity },
];

function participantDistances(
  participants: ParticipantRecord[],
  venueLat: number,
  venueLng: number,
): number[] {
  const distances: number[] = [];
  for (const p of participants) {
    const loc = resolveParticipantLocation(p);
    if (loc) distances.push(haversineDistance(loc.lat, loc.lng, venueLat, venueLng));
  }
  return distances;
}

function computeDistance(
  participants: ParticipantRecord[],
  venueLat: number,
  venueLng: number,
  venueAddress: string,
): DistanceStats {
  const distances = participantDistances(participants, venueLat, venueLng);

  if (distances.length === 0) {
    return { venueAddress, medianMiles: 0, meanMiles: 0, local: 0, regional: 0, destination: 0, buckets: [] };
  }

  distances.sort((a, b) => a - b);
  const mean = distances.reduce((s, d) => s + d, 0) / distances.length;
  const buckets = DISTANCE_BUCKETS.map(b => ({
    label: b.label,
    count: distances.filter(d => d >= b.min && d <= b.max).length,
  }));

  return {
    venueAddress,
    medianMiles: round2(medianOf(distances)),
    meanMiles: round2(mean),
    local: distances.filter(d => d < 50).length,
    regional: distances.filter(d => d >= 50 && d < 200).length,
    destination: distances.filter(d => d >= 200).length,
    buckets,
  };
}

// ─── Registration Timing ────────────────────────────────────────────────────

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function hourLabel(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

// Extract date/time parts from a Date in the given IANA timezone.
// Falls back to UTC if the timezone name is unrecognized.
function datePartsInTz(
  date: Date,
  tz: string,
): { year: number; month: number; day: number; hour: number; dow: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      weekday: 'short',
      hour12: false,
      timeZone: tz,
    }).formatToParts(date);
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
    const dowMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    return {
      year:  parseInt(get('year'),  10),
      month: parseInt(get('month'), 10), // 1–12
      day:   parseInt(get('day'),   10),
      hour:  parseInt(get('hour'),  10) % 24,
      dow:   dowMap[get('weekday')] ?? date.getUTCDay(),
    };
  } catch {
    return {
      year:  date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day:   date.getUTCDate(),
      hour:  date.getUTCHours(),
      dow:   date.getUTCDay(),
    };
  }
}

function buildRegistrantProfile(
  subset: ParticipantRecord[],
  venueLat: number | null,
  venueLng: number | null,
): RegistrantProfile {
  const count = subset.length;
  if (count === 0) return { count: 0, femalePercent: 0, malePercent: 0, nonBinaryPercent: 0, avgAge: null, medianDistanceMiles: null };

  const female = subset.filter(p => p.gender === 'F').length;
  const male = subset.filter(p => p.gender === 'M').length;
  const nonBinary = subset.filter(p => p.gender === 'NB').length;
  const ages = subset.map(p => p.age).filter((a): a is number => a !== null);
  const avgAge = ages.length > 0 ? round2(ages.reduce((s, a) => s + a, 0) / ages.length) : null;

  let medianDistanceMiles: number | null = null;
  if (venueLat !== null && venueLng !== null) {
    const dists = participantDistances(subset, venueLat, venueLng);
    if (dists.length > 0) {
      dists.sort((a, b) => a - b);
      medianDistanceMiles = round2(medianOf(dists));
    }
  }

  return {
    count,
    femalePercent: round2(female / count * 100),
    malePercent: round2(male / count * 100),
    nonBinaryPercent: round2(nonBinary / count * 100),
    avgAge,
    medianDistanceMiles,
  };
}

function computeRegistration(
  participants: ParticipantRecord[],
  venueLat: number | null,
  venueLng: number | null,
  timezone: string,
): RegistrationStats {
  // Sort by date for cumulative and early/late profiles
  const sorted = [...participants].sort(
    (a, b) => a.registrationDate.getTime() - b.registrationDate.getTime()
  );

  const pad2 = (n: number) => String(n).padStart(2, '0');

  // By month — use timezone-aware extraction
  const byMonthMap: Record<string, number> = {};
  for (const p of sorted) {
    const { year, month } = datePartsInTz(p.registrationDate, timezone);
    const key = `${year}-${pad2(month)}`;
    byMonthMap[key] = (byMonthMap[key] ?? 0) + 1;
  }
  const byMonth = Object.entries(byMonthMap)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Cumulative by day — use timezone-aware extraction
  const byDayMap: Record<string, number> = {};
  for (const p of sorted) {
    const { year, month, day } = datePartsInTz(p.registrationDate, timezone);
    const key = `${year}-${pad2(month)}-${pad2(day)}`;
    byDayMap[key] = (byDayMap[key] ?? 0) + 1;
  }
  let running = 0;
  const cumulative = Object.entries(byDayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => {
      running += count;
      return { date, count, total: running };
    });

  // By day of week and hour of day — converted to the user-specified timezone
  const dowCounts = new Array(7).fill(0);
  const hourCounts = new Array(24).fill(0);
  for (const p of participants) {
    const { hour, dow } = datePartsInTz(p.registrationDate, timezone);
    dowCounts[dow]++;
    hourCounts[hour]++;
  }
  const byDayOfWeek = DAYS.map((day, i) => ({ day, count: dowCounts[i] }));
  const byHourOfDay = hourCounts.map((count, hour) => ({ hour, label: hourLabel(hour), count }));

  // Early vs late registrant profiles (first and last 25%)
  const quartile = Math.max(1, Math.floor(sorted.length / 4));
  const earlyProfile = buildRegistrantProfile(sorted.slice(0, quartile), venueLat, venueLng);
  const lateProfile = buildRegistrantProfile(sorted.slice(-quartile), venueLat, venueLng);

  // Relay joins register at $0 via the captain-pays model — any coupon code on
  // those rows reflects the relay mechanism, not a promotional discount.
  // Exclude them from both the count and the denominator so the metric
  // represents "paying registrants who applied a discount code."
  const payingParticipants = participants.filter(p => !p.isRelayJoin);
  const couponUsers = payingParticipants.filter(p => p.hasCoupon).length;

  // Per-event breakdown
  const eventNames = [...new Set(participants.map(p => p.event))];
  const byEvent: EventRegistrationStats[] = eventNames.map(eventName => {
    const evParticipants = participants.filter(p => p.event === eventName);
    const evSorted = [...evParticipants].sort(
      (a, b) => a.registrationDate.getTime() - b.registrationDate.getTime()
    );

    const evByMonthMap: Record<string, number> = {};
    for (const p of evSorted) {
      const { year, month } = datePartsInTz(p.registrationDate, timezone);
      const key = `${year}-${pad2(month)}`;
      evByMonthMap[key] = (evByMonthMap[key] ?? 0) + 1;
    }
    const evByMonth = Object.entries(evByMonthMap)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const evByDayMap: Record<string, number> = {};
    for (const p of evSorted) {
      const { year, month, day } = datePartsInTz(p.registrationDate, timezone);
      const key = `${year}-${pad2(month)}-${pad2(day)}`;
      evByDayMap[key] = (evByDayMap[key] ?? 0) + 1;
    }
    let evRunning = 0;
    const evCumulative = Object.entries(evByDayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => {
        evRunning += count;
        return { date, count, total: evRunning };
      });

    const evQuartile = Math.max(1, Math.floor(evSorted.length / 4));
    const evPayingParticipants = evParticipants.filter(p => !p.isRelayJoin);
    const evCouponUsers = evPayingParticipants.filter(p => p.hasCoupon).length;

    return {
      eventName,
      count: evParticipants.length,
      byMonth: evByMonth,
      cumulative: evCumulative,
      earlyProfile: buildRegistrantProfile(evSorted.slice(0, evQuartile), venueLat, venueLng),
      lateProfile: buildRegistrantProfile(evSorted.slice(-evQuartile), venueLat, venueLng),
      couponUsageCount: evCouponUsers,
      couponUsagePercent: round2(evCouponUsers / (evPayingParticipants.length || 1) * 100),
    };
  });

  return {
    byMonth,
    cumulative,
    byDayOfWeek,
    byHourOfDay,
    earlyProfile,
    lateProfile,
    couponUsageCount: couponUsers,
    couponUsagePercent: round2(couponUsers / (payingParticipants.length || 1) * 100),
    byEvent,
  };
}

// ─── Cross-Event Comparison ──────────────────────────────────────────────────

function computeCrossEvent(
  participants: ParticipantRecord[],
  venueLat: number | null,
  venueLng: number | null,
): CrossEventStats {
  const eventGroups = new Map<string, ParticipantRecord[]>();
  for (const p of participants) {
    const group = eventGroups.get(p.event) ?? [];
    group.push(p);
    eventGroups.set(p.event, group);
  }

  if (eventGroups.size <= 1) return { rows: [] };

  const rows: CrossEventRow[] = [];
  for (const [name, group] of eventGroups) {
    const male = group.filter(p => p.gender === 'M').length;
    const female = group.filter(p => p.gender === 'F').length;
    const nonBinary = group.filter(p => p.gender === 'NB').length;
    const ages = group.map(p => p.age).filter((a): a is number => a !== null).sort((a, b) => a - b);

    let medianDistanceMiles: number | null = null;
    let localPercent: number | null = null;
    let destinationPercent: number | null = null;

    if (venueLat !== null && venueLng !== null) {
      const dists = participantDistances(group, venueLat, venueLng);
      if (dists.length > 0) {
        dists.sort((a, b) => a - b);
        medianDistanceMiles = round2(medianOf(dists));
        localPercent = round2(dists.filter(d => d < 50).length / dists.length * 100);
        destinationPercent = round2(dists.filter(d => d >= 200).length / dists.length * 100);
      }
    }

    rows.push({
      name,
      count: group.length,
      male,
      female,
      nonBinary,
      malePercent: round2(male / (group.length || 1) * 100),
      femalePercent: round2(female / (group.length || 1) * 100),
      nonBinaryPercent: round2(nonBinary / (group.length || 1) * 100),
      avgAge: ages.length > 0 ? round2(ages.reduce((s, a) => s + a, 0) / ages.length) : null,
      medianAge: ages.length > 0 ? round2(medianOf(ages)) : null,
      medianDistanceMiles,
      localPercent,
      destinationPercent,
    });
  }

  // Sort by participant count descending
  rows.sort((a, b) => b.count - a.count);
  return { rows };
}

// ─── Participation ───────────────────────────────────────────────────────────

function classifyParticipantStatus(p: ParticipantRecord): keyof ParticipantStatusCounts {
  const orderType = p.orderType.toLowerCase();
  const hasStatement = p.statementId !== '';

  if (orderType === 'pending cc' && !hasStatement) {
    return p.removed ? 'waitlistWithdrawnDeclined' : 'waitlistNeverInvited';
  }
  if (orderType === 'credit card' && hasStatement) {
    return p.removed ? 'paidDropped' : 'paidActive';
  }
  if (orderType === '' && hasStatement) {
    return p.removed ? 'specialCaseA' : 'specialCaseB';
  }
  return 'other';
}

function computeParticipation(participants: ParticipantRecord[]): ParticipationStats {
  const total = participants.length;
  // Relay joins (captain-pays model) are separated from genuine comps so they
  // don't inflate the "comped" figure with expected free relay registrations.
  const relayJoins = participants.filter(p => p.isRelayJoin).length;
  const comped = participants.filter(p => p.isComped && !p.isRelayJoin).length;
  const dropped = participants.filter(p => p.droppingFromRace).length;
  const removed = participants.filter(p => p.removed).length;

  function zeroCounts(): ParticipantStatusCounts {
    return { paidActive: 0, paidDropped: 0, waitlistNeverInvited: 0, waitlistWithdrawnDeclined: 0, specialCaseA: 0, specialCaseB: 0, other: 0 };
  }

  const overall = zeroCounts();
  const eventCountsMap = new Map<string, ParticipantStatusCounts>();
  for (const p of participants) {
    const key = classifyParticipantStatus(p);
    overall[key]++;
    if (!eventCountsMap.has(p.event)) eventCountsMap.set(p.event, zeroCounts());
    eventCountsMap.get(p.event)![key]++;
  }

  const statusBreakdown: ParticipantStatusStats = {
    ...overall,
    hasStatementData: participants.some(p => p.statementId !== ''),
    byEvent: [...eventCountsMap.entries()].map(([eventName, counts]) => ({ eventName, ...counts })),
  };

  return {
    totalRegistered: total,
    paid: total - comped - relayJoins,
    comped,
    compedPercent: round2(comped / (total || 1) * 100),
    relayJoins,
    relayJoinsPercent: round2(relayJoins / (total || 1) * 100),
    dropped,
    droppedPercent: round2(dropped / (total || 1) * 100),
    removed,
    removedPercent: round2(removed / (total || 1) * 100),
    statusBreakdown,
  };
}

// ─── Teams ──────────────────────────────────────────────────────────────────

function computeTeams(participants: ParticipantRecord[]): TeamStats {
  const teamMembers = participants.filter(p => p.teamName !== '');
  const soloMembers = participants.filter(p => p.teamName === '');

  if (teamMembers.length === 0) {
    return {
      hasTeams: false, totalTeams: 0, avgTeamSize: 0,
      soloParticipants: participants.length, teamParticipants: 0,
      allMaleTeams: 0, allFemaleTeams: 0, mixedTeams: 0,
      teamAvgAge: null, soloAvgAge: null,
    };
  }

  // Build per-team member lists
  const teamMap = new Map<string, ParticipantRecord[]>();
  for (const p of teamMembers) {
    const list = teamMap.get(p.teamName) ?? [];
    list.push(p);
    teamMap.set(p.teamName, list);
  }

  const sizes = [...teamMap.values()].map(t => t.length);
  const avgSize = round2(sizes.reduce((s, n) => s + n, 0) / sizes.length);

  let allMale = 0, allFemale = 0, mixed = 0;
  for (const members of teamMap.values()) {
    const hasM = members.some(p => p.gender === 'M');
    const hasF = members.some(p => p.gender === 'F');
    if (hasM && !hasF) allMale++;
    else if (hasF && !hasM) allFemale++;
    else mixed++;
  }

  const teamAges = teamMembers.map(p => p.age).filter((a): a is number => a !== null);
  const soloAges = soloMembers.map(p => p.age).filter((a): a is number => a !== null);

  return {
    hasTeams: true,
    totalTeams: teamMap.size,
    avgTeamSize: avgSize,
    soloParticipants: soloMembers.length,
    teamParticipants: teamMembers.length,
    allMaleTeams: allMale,
    allFemaleTeams: allFemale,
    mixedTeams: mixed,
    teamAvgAge: teamAges.length > 0 ? round2(teamAges.reduce((s, a) => s + a, 0) / teamAges.length) : null,
    soloAvgAge: soloAges.length > 0 ? round2(soloAges.reduce((s, a) => s + a, 0) / soloAges.length) : null,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Assumes the array is already sorted ascending
function medianOf(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}
