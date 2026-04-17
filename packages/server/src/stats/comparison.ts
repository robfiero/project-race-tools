import type {
  SessionData,
  ComparisonStats,
  ComparisonTrends,
  IntervalStats,
  TrendPoint,
} from '../types.js';
import { computeStats } from './index.js';

export const MAX_COMPARISON_INTERVALS = 5;

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
    stateCount: trend(iv => Object.keys(iv.stats.geographic.byState).length),
    countryCount: trend(iv => Object.keys(iv.stats.geographic.byCountry).length),
    internationalPercent: trend(iv => {
      const total = iv.stats.summary.totalParticipants;
      return total > 0
        ? round2(iv.stats.geographic.internationalParticipants / total * 100)
        : 0;
    }),
    compedPercent: trend(iv => iv.stats.participation.compedPercent),
    couponUsagePercent: trend(iv => iv.stats.registration.couponUsagePercent),
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
    destinationPercent: hasDistanceTrend
      ? trend(iv => {
          const d = iv.stats.distance!;
          const total = d.local + d.regional + d.destination || 1;
          return round2(d.destination / total * 100);
        })
      : [],
  };

  return { intervals, trends, hasDistanceTrend };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
