import type {
  ResultsSessionData,
  ResultsComparisonStats,
  ResultsComparisonTrends,
  ResultsIntervalStats,
  TrendPoint,
} from '../types.js';
import { computeResultsStats } from './results.js';

export const MAX_RESULTS_COMPARISON_INTERVALS = 5;

export function computeResultsComparisonStats(
  sessions: ResultsSessionData[],
  labels: string[],
): ResultsComparisonStats {
  const intervals: ResultsIntervalStats[] = sessions.map((session, i) => ({
    sessionId: session.sessionId,
    label: labels[i],
    raceName: session.raceName,
    resultCount: session.results.length,
    stats: computeResultsStats(session.results),
    ...(session.weatherData ? { weatherData: session.weatherData } : {}),
  }));

  // Use the primary event type from the first interval's first event group
  const primaryEventType =
    intervals[0]?.stats.performance.events[0]?.eventType ?? 'fixed-distance';

  const isFixedDist = primaryEventType === 'fixed-distance';

  function trend(fn: (iv: ResultsIntervalStats) => number | null): TrendPoint[] {
    return intervals.map(iv => ({ label: iv.label, value: fn(iv) }));
  }

  const trends: ResultsComparisonTrends = {
    totalEntrants: trend(iv => iv.stats.summary.totalEntrants),
    finishers: trend(iv => iv.stats.summary.finishers),
    finishRate: trend(iv => iv.stats.summary.finishRate),
    dnfRate: trend(iv => iv.stats.summary.dnfRate),
    medianFinishTimeSeconds: isFixedDist
      ? trend(iv => iv.stats.performance.events[0]?.finishTime?.medianSeconds ?? null)
      : [],
    medianDistanceMiles: !isFixedDist
      ? trend(iv => iv.stats.performance.events[0]?.distanceAchieved?.medianMiles ?? null)
      : [],
    femaleFinisherPercent: trend(iv => iv.stats.demographics.finisherGender.femalePercent),
    nbFinisherPercent: trend(iv => iv.stats.demographics.finisherGender.nonBinaryPercent),
    medianFinisherAge: trend(iv => iv.stats.demographics.finisherAge.median),
  };

  return { intervals, trends, primaryEventType };
}
