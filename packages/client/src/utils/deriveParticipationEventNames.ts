// Minimal shape needed for event-name derivation — avoids coupling to the full ResultsIntervalStats type.
interface EventNameSources {
  stats: {
    attrition: { byEvent: Array<{ name: string }> };
    performance: { events: Array<{ eventName: string }> };
    ageDistributionByEvent: Array<{ eventName: string }>;
    geographicDistributionByEvent: Array<{ eventName: string }>;
  };
}

function eventDistanceMiles(name: string): number {
  const lower = name.toLowerCase();
  if (/\bhalf[\s-]marathon\b/.test(lower)) return 13.1;
  if (/\bmarathon\b/.test(lower)) return 26.2;
  const km = name.match(/(\d+(?:\.\d+)?)\s*k(?:m\b|\b)/i);
  if (km) return parseFloat(km[1]) * 0.621371;
  const mi = name.match(/(\d+(?:\.\d+)?)\s*(?:mile[rs]?|mi)\b/i);
  if (mi) return parseFloat(mi[1]);
  return Infinity;
}

export function sortEventNames(events: string[]): string[] {
  return [...events].sort((a, b) => {
    const da = eventDistanceMiles(a);
    const db = eventDistanceMiles(b);
    if (da !== db) return da - db;
    return a.localeCompare(b);
  });
}

/**
 * Collects the unique event names visible across all intervals of a multi-year
 * report.  Unions four sources so single-event races (where attrition.byEvent
 * is intentionally empty) still surface the event via performance.events.
 */
export function deriveParticipationEventNames(intervals: EventNameSources[]): string[] {
  return sortEventNames(Array.from(new Set(intervals.flatMap(iv => [
    ...iv.stats.attrition.byEvent.map(r => r.name),
    ...iv.stats.performance.events.map(r => r.eventName),
    ...iv.stats.ageDistributionByEvent.map(r => r.eventName),
    ...iv.stats.geographicDistributionByEvent.map(r => r.eventName),
  ]))));
}
