import { describe, it, expect } from 'vitest';
import { deriveParticipationEventNames, sortEventNames } from '../utils/deriveParticipationEventNames.ts';

// Minimal interval factory — only sets the four arrays that deriveParticipationEventNames reads.
function makeInterval(
  eventNames: string[],
  attritionEventNames: string[] = eventNames,
) {
  return {
    stats: {
      attrition: { byEvent: attritionEventNames.map(name => ({ name })) },
      performance: { events: eventNames.map(name => ({ eventName: name })) },
      ageDistributionByEvent: eventNames.map(name => ({ eventName: name })),
      geographicDistributionByEvent: eventNames.map(name => ({ eventName: name })),
    },
  };
}

// ─── Single-event multi-year regression ────────────────────────────────────────
//
// Single-event races have attrition.byEvent === [] by design (attrition only
// tracks multi-event breakdowns). The UI must still derive the event name and
// show all selected-event sections.  This was a production regression where the
// client previously only read attrition.byEvent, making hasEventPerformanceTrends
// false for any single-event report.

describe('deriveParticipationEventNames — single-event report', () => {
  it('returns the event name even when attrition.byEvent is empty', () => {
    const intervals = [
      makeInterval(['3 mi'], []),
      makeInterval(['3 mi'], []),
      makeInterval(['3 mi'], []),
    ];
    expect(deriveParticipationEventNames(intervals)).toEqual(['3 mi']);
  });

  it('returns length 1 so the "Change event" control is hidden (length > 1 gate is false)', () => {
    const intervals = [makeInterval(['5K'], []), makeInterval(['5K'], [])];
    const names = deriveParticipationEventNames(intervals);
    expect(names.length).toBe(1);
    // The JSX guard: participationEventNames.length > 1 — must be false for one-event reports.
    expect(names.length > 1).toBe(false);
  });

  it('returns a non-empty array so hasEventPerformanceTrends is true', () => {
    const intervals = [makeInterval(['Event'], [])];
    const names = deriveParticipationEventNames(intervals);
    // hasEventPerformanceTrends = participationEventNames.length > 0
    expect(names.length > 0).toBe(true);
  });
});

// ─── Multi-event and deduplication ────────────────────────────────────────────

describe('deriveParticipationEventNames — multi-event and deduplication', () => {
  it('deduplicates the same event name across multiple years', () => {
    const intervals = [makeInterval(['5K']), makeInterval(['5K']), makeInterval(['5K'])];
    expect(deriveParticipationEventNames(intervals)).toEqual(['5K']);
  });

  it('unions events from all intervals for added / discontinued events', () => {
    const intervals = [
      makeInterval(['10 mi']),
      makeInterval(['10 mi', '20 mi']),
    ];
    const names = deriveParticipationEventNames(intervals);
    expect(names).toContain('10 mi');
    expect(names).toContain('20 mi');
    expect(names).toHaveLength(2);
  });

  it('returns length > 1 for multi-event so the "Change event" selector is shown', () => {
    const intervals = [makeInterval(['5K', 'half marathon'])];
    expect(deriveParticipationEventNames(intervals).length > 1).toBe(true);
  });
});

// ─── Sorting ──────────────────────────────────────────────────────────────────

describe('sortEventNames', () => {
  it('orders by distance: 5K < half marathon < marathon', () => {
    const sorted = sortEventNames(['marathon', 'half marathon', '5K']);
    expect(sorted[0]).toBe('5K');
    expect(sorted[sorted.length - 1]).toBe('marathon');
  });

  it('orders numeric mile distances correctly', () => {
    const sorted = sortEventNames(['50 mi', '10 mi', '100 mi']);
    expect(sorted).toEqual(['10 mi', '50 mi', '100 mi']);
  });

  it('falls back to locale sort for events with equal or unrecognised distances', () => {
    const sorted = sortEventNames(['Event B', 'Event A']);
    expect(sorted).toEqual(['Event A', 'Event B']);
  });
});

// ─── Fallback sources ────────────────────────────────────────────────────────

describe('deriveParticipationEventNames — source fallbacks', () => {
  it('uses ageDistributionByEvent when performance.events is empty', () => {
    const interval = {
      stats: {
        attrition: { byEvent: [] },
        performance: { events: [] },
        ageDistributionByEvent: [{ eventName: '5K' }],
        geographicDistributionByEvent: [],
      },
    };
    expect(deriveParticipationEventNames([interval])).toEqual(['5K']);
  });

  it('uses geographicDistributionByEvent when other sources are empty', () => {
    const interval = {
      stats: {
        attrition: { byEvent: [] },
        performance: { events: [] },
        ageDistributionByEvent: [],
        geographicDistributionByEvent: [{ eventName: '10K' }],
      },
    };
    expect(deriveParticipationEventNames([interval])).toEqual(['10K']);
  });

  it('returns empty array when all sources are empty', () => {
    const interval = {
      stats: {
        attrition: { byEvent: [] },
        performance: { events: [] },
        ageDistributionByEvent: [],
        geographicDistributionByEvent: [],
      },
    };
    expect(deriveParticipationEventNames([interval])).toEqual([]);
  });
});
