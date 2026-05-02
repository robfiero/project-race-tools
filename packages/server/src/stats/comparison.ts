import type {
  SessionData,
  ComparisonStats,
  ComparisonTrends,
  CrossEventRow,
  CrossEventTrendRow,
  IntervalStats,
  StateTrendRow,
  TrendPoint,
} from '../types.js';
import { computeStats } from './index.js';

export const MAX_COMPARISON_INTERVALS = 5;

function normName(s: string): string {
  return s.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function computeComparisonStats(
  sessions: SessionData[],
  labels: string[],
): ComparisonStats {
  const intervals: IntervalStats[] = sessions.map((session, i) => {
    const stats = computeStats(
      session.participants,
      session.venueLat,
      session.venueLng,
      session.venueAddress,
      session.timezone,
    );
    return {
      sessionId: session.sessionId,
      label: labels[i],
      raceName: session.raceName,
      participantCount: session.participants.length,
      stats,
    };
  });

  const hasDistanceTrend = intervals.every(iv => iv.stats.distance !== null);

  function trend(fn: (iv: IntervalStats) => number | null): TrendPoint[] {
    return intervals.map(iv => ({ label: iv.label, value: fn(iv) }));
  }

  const trends: ComparisonTrends = {
    participantCount: trend(iv => iv.stats.summary.totalParticipants),
    activeParticipants: trend(iv => iv.stats.summary.activeParticipants),
    femalePercent: trend(iv => iv.stats.gender.femalePercent),
    nonBinaryPercent: trend(iv => iv.stats.gender.nonBinaryPercent),
    malePercent: trend(iv => iv.stats.gender.malePercent),
    medianAge: trend(iv => iv.stats.age.median),
    meanAge: trend(iv => iv.stats.age.mean),
    minAge: trend(iv => iv.stats.age.min),
    maxAge: trend(iv => iv.stats.age.max),
    stateCount: trend(iv => Object.keys(iv.stats.geographic.byState).length),
    countryCount: trend(iv => Object.keys(iv.stats.geographic.byCountry).length),
    internationalPercent: trend(iv => {
      const total = iv.stats.summary.totalParticipants;
      return total > 0
        ? round2(iv.stats.geographic.internationalParticipants / total * 100)
        : 0;
    }),
    internationalCount: trend(iv => iv.stats.geographic.internationalParticipants),
    paid: trend(iv => iv.stats.participation.paid),
    comped:          trend(iv => iv.stats.participation.comped),
    dropped:         trend(iv => iv.stats.participation.dropped),
    removed:         trend(iv => iv.stats.participation.removed),
    relayJoins:      trend(iv => iv.stats.participation.relayJoins),
    couponUsageCount: trend(iv => iv.stats.registration.couponUsageCount),
    paidActive:                trend(iv => iv.stats.participation.statusBreakdown.paidActive),
    couponActive:              trend(iv => iv.stats.participation.statusBreakdown.couponActive),
    giftCardActive:            trend(iv => iv.stats.participation.statusBreakdown.giftCardActive),
    paymentPending:            trend(iv =>
      iv.stats.participation.statusBreakdown.paymentPendingActive +
      iv.stats.participation.statusBreakdown.paymentPendingDropped
    ),
    paidDropped:               trend(iv => iv.stats.participation.statusBreakdown.paidDropped),
    waitlistNeverInvited:      trend(iv => iv.stats.participation.statusBreakdown.waitlistNeverInvited),
    waitlistWithdrawnDeclined: trend(iv => iv.stats.participation.statusBreakdown.waitlistWithdrawnDeclined),
    compedPercent: trend(iv => iv.stats.participation.compedPercent),
    droppedPercent: trend(iv => iv.stats.participation.droppedPercent),
    removedPercent: trend(iv => iv.stats.participation.removedPercent),
    relayJoinsPercent: trend(iv => iv.stats.participation.relayJoinsPercent),
    couponUsagePercent: trend(iv => iv.stats.registration.couponUsagePercent),
    earlyFemalePercent: trend(iv => iv.stats.registration.earlyProfile.femalePercent),
    lateFemalePercent:  trend(iv => iv.stats.registration.lateProfile.femalePercent),
    earlyMalePercent:   trend(iv => iv.stats.registration.earlyProfile.malePercent),
    lateMalePercent:    trend(iv => iv.stats.registration.lateProfile.malePercent),
    earlyAvgAge:        trend(iv => iv.stats.registration.earlyProfile.avgAge),
    lateAvgAge:         trend(iv => iv.stats.registration.lateProfile.avgAge),
    medianDistanceMiles: hasDistanceTrend
      ? trend(iv => iv.stats.distance!.medianMiles)
      : [],
    localPercent: hasDistanceTrend
      ? trend(iv => {
          const d = iv.stats.distance!;
          const total = d.local + d.regional + d.destination || 1;
          return round2(d.local / total * 100);
        })
      : [],
    regionalPercent: hasDistanceTrend
      ? trend(iv => {
          const d = iv.stats.distance!;
          const total = d.local + d.regional + d.destination || 1;
          return round2(d.regional / total * 100);
        })
      : [],
    destinationPercent: hasDistanceTrend
      ? trend(iv => {
          const d = iv.stats.distance!;
          const total = d.local + d.regional + d.destination || 1;
          return round2(d.destination / total * 100);
        })
      : [],
  };

  const stateTotals = new Map<string, number>();
  for (const iv of intervals) {
    for (const [state, count] of Object.entries(iv.stats.geographic.byState)) {
      stateTotals.set(state, (stateTotals.get(state) ?? 0) + count);
    }
  }
  const topStates = [...stateTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([state]) => state);
  const topStateTrends: StateTrendRow[] = topStates.map(state => ({
    state,
    counts: intervals.map(iv => ({
      label: iv.label,
      value: iv.stats.geographic.byState[state] ?? 0,
    })),
  }));

  // Build canonical event name map: normalized form → first-seen raw name
  const canonicalNames = new Map<string, string>();
  for (const iv of intervals) {
    for (const row of iv.stats.crossEvent.rows) {
      const n = normName(row.name);
      if (!canonicalNames.has(n)) canonicalNames.set(n, row.name);
    }
  }
  const allEventNames = [...canonicalNames.values()];

  const crossEventTrends: CrossEventTrendRow[] = allEventNames.map(canonical => {
    const normCanonical = normName(canonical);
    function evTrend(fn: (row: CrossEventRow) => number | null): TrendPoint[] {
      return intervals.map(iv => {
        const row = iv.stats.crossEvent.rows.find(r => normName(r.name) === normCanonical);
        return { label: iv.label, value: row ? fn(row) : null };
      });
    }
    const eventName = canonical;
    return {
      eventName,
      participantCount:    evTrend(r => r.count),
      femalePercent:       evTrend(r => r.femalePercent),
      malePercent:         evTrend(r => r.malePercent),
      nonBinaryPercent:    evTrend(r => r.nonBinaryPercent),
      avgAge:              evTrend(r => r.avgAge),
      medianAge:           evTrend(r => r.medianAge),
      medianDistanceMiles: evTrend(r => r.medianDistanceMiles),
    };
  });

  return { intervals, trends, hasDistanceTrend, crossEventTrends, topStateTrends };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
