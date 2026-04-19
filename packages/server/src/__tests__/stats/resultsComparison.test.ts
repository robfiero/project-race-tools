import { describe, it, expect } from 'vitest';
import {
  computeResultsComparisonStats,
  MAX_RESULTS_COMPARISON_INTERVALS,
} from '../../stats/resultsComparison.js';
import { makeResultRecord, makeResultRecords } from '../helpers.js';
import type { ResultRecord, ResultsSessionData } from '../../types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _sid = 0;
function makeSession(results: ResultRecord[], raceName = 'Test Race'): ResultsSessionData {
  return {
    sessionId: `session-${++_sid}`,
    createdAt: new Date(),
    raceName,
    results,
  };
}

/** 5 male finishers at 50 miles with times spread across 4–6 hours. */
function fixedDistSession(count = 5, femaleCount = 0, nbCount = 0): ResultsSessionData {
  const maleFinishers = makeResultRecords(count, {
    finishStatus: 1, gender: 'M', distanceMiles: 50, timeSeconds: 14400,
  });
  const femaleFinishers = makeResultRecords(femaleCount, {
    finishStatus: 1, gender: 'F', distanceMiles: 50, timeSeconds: 18000,
  }).map((r, i) => ({ ...r, bib: `f${i}` }));
  const nbFinishers = makeResultRecords(nbCount, {
    finishStatus: 1, gender: 'NB', distanceMiles: 50, timeSeconds: 21600,
  }).map((r, i) => ({ ...r, bib: `nb${i}` }));
  return makeSession([...maleFinishers, ...femaleFinishers, ...nbFinishers]);
}

/** 5 finishers at varied distances (fixed-time event). */
function fixedTimeSession(): ResultsSessionData {
  const dists = [45, 47, 49, 51, 53];
  return makeSession(dists.map((d, i) =>
    makeResultRecord({ bib: String(i), finishStatus: 1, distanceMiles: d, timeSeconds: null }),
  ));
}

// ─── MAX_RESULTS_COMPARISON_INTERVALS ─────────────────────────────────────────

describe('MAX_RESULTS_COMPARISON_INTERVALS', () => {
  it('is defined and equals 5', () => expect(MAX_RESULTS_COMPARISON_INTERVALS).toBe(5));
});

// ─── Single session ────────────────────────────────────────────────────────────

describe('computeResultsComparisonStats — single session', () => {
  const session = fixedDistSession(5, 2, 1);
  const result = computeResultsComparisonStats([session], ['2024']);

  it('produces one interval', () => expect(result.intervals).toHaveLength(1));
  it('assigns the label to the interval', () => expect(result.intervals[0].label).toBe('2024'));
  it('assigns the sessionId', () => expect(result.intervals[0].sessionId).toBe(session.sessionId));
  it('assigns the raceName', () => expect(result.intervals[0].raceName).toBe('Test Race'));
  it('records resultCount correctly', () => expect(result.intervals[0].resultCount).toBe(8));
  it('primaryEventType is fixed-distance', () => expect(result.primaryEventType).toBe('fixed-distance'));

  it('trends have exactly 1 data point each', () => {
    expect(result.trends.totalEntrants).toHaveLength(1);
    expect(result.trends.finishers).toHaveLength(1);
    expect(result.trends.finishRate).toHaveLength(1);
    expect(result.trends.femaleFinisherPercent).toHaveLength(1);
    expect(result.trends.nbFinisherPercent).toHaveLength(1);
    expect(result.trends.medianFinisherAge).toHaveLength(1);
  });

  it('medianFinishTimeSeconds trend is populated for fixed-distance', () => {
    expect(result.trends.medianFinishTimeSeconds).toHaveLength(1);
  });

  it('medianDistanceMiles trend is empty for fixed-distance', () => {
    expect(result.trends.medianDistanceMiles).toHaveLength(0);
  });

  it('trend label matches the session label', () => {
    expect(result.trends.totalEntrants[0].label).toBe('2024');
  });

  it('totalEntrants trend value matches the result count', () => {
    expect(result.trends.totalEntrants[0].value).toBe(8);
  });

  it('finishers trend value is correct', () => {
    expect(result.trends.finishers[0].value).toBe(8);
  });

  it('finishRate trend value is 100 when all records are finishers', () => {
    expect(result.trends.finishRate[0].value).toBe(100);
  });

  it('femaleFinisherPercent reflects actual female share', () => {
    // 2F / 8 total finishers = 25.0%
    expect(result.trends.femaleFinisherPercent[0].value).toBe(25.0);
  });

  it('nbFinisherPercent reflects NB share', () => {
    // 1NB / 8 = 12.5%
    expect(result.trends.nbFinisherPercent[0].value).toBe(12.5);
  });
});

// ─── Multiple sessions (fixed-distance) ───────────────────────────────────────

describe('computeResultsComparisonStats — two fixed-distance sessions', () => {
  const s1 = fixedDistSession(10, 3, 0); // 13 finishers, year 2023
  const s2 = fixedDistSession(15, 6, 1); // 22 finishers, year 2024
  const result = computeResultsComparisonStats([s1, s2], ['2023', '2024']);

  it('produces two intervals', () => expect(result.intervals).toHaveLength(2));

  it('assigns labels to intervals in order', () => {
    expect(result.intervals[0].label).toBe('2023');
    expect(result.intervals[1].label).toBe('2024');
  });

  it('each trend has exactly 2 data points', () => {
    for (const trend of Object.values(result.trends)) {
      if ((trend as unknown[]).length > 0) {
        expect((trend as unknown[]).length).toBe(2);
      }
    }
  });

  it('totalEntrants trend reflects both years', () => {
    expect(result.trends.totalEntrants[0].value).toBe(13);
    expect(result.trends.totalEntrants[1].value).toBe(22);
  });

  it('finishers trend values are non-null', () => {
    for (const pt of result.trends.finishers) {
      expect(pt.value).not.toBeNull();
    }
  });

  it('medianFinishTimeSeconds has 2 points', () => {
    expect(result.trends.medianFinishTimeSeconds).toHaveLength(2);
  });

  it('medianFinishTimeSeconds values are non-null', () => {
    for (const pt of result.trends.medianFinishTimeSeconds) {
      expect(pt.value).not.toBeNull();
    }
  });

  it('primaryEventType is fixed-distance (from first session)', () => {
    expect(result.primaryEventType).toBe('fixed-distance');
  });

  it('interval stats contain attrition data', () => {
    for (const iv of result.intervals) {
      expect(iv.stats.attrition.overall).toBeDefined();
    }
  });

  it('nbFinisherPercent grows when NB count increases', () => {
    // s1 has 0 NB, s2 has 1 NB out of 22 — value should be higher in year 2
    expect(result.trends.nbFinisherPercent[1].value).toBeGreaterThan(
      result.trends.nbFinisherPercent[0].value ?? 0,
    );
  });
});

// ─── Fixed-time event ──────────────────────────────────────────────────────────

describe('computeResultsComparisonStats — fixed-time sessions', () => {
  const s1 = fixedTimeSession();
  const s2 = fixedTimeSession();
  const result = computeResultsComparisonStats([s1, s2], ['Year1', 'Year2']);

  it('primaryEventType is fixed-time', () => expect(result.primaryEventType).toBe('fixed-time'));

  it('medianFinishTimeSeconds trend is empty for fixed-time', () => {
    expect(result.trends.medianFinishTimeSeconds).toHaveLength(0);
  });

  it('medianDistanceMiles trend is populated for fixed-time', () => {
    expect(result.trends.medianDistanceMiles).toHaveLength(2);
  });

  it('medianDistanceMiles values are non-null', () => {
    for (const pt of result.trends.medianDistanceMiles) {
      expect(pt.value).not.toBeNull();
    }
  });
});

// ─── Session with weather data ─────────────────────────────────────────────────

describe('computeResultsComparisonStats — weather data passthrough', () => {
  const session = makeSession(
    makeResultRecords(5, { finishStatus: 1, distanceMiles: 50, timeSeconds: 14400 }),
  );
  const weather = { raceStartIso: '2024-04-20T07:00:00', raceEndIso: '2024-04-20T17:00:00' };
  const sessionWithWeather: ResultsSessionData = { ...session, weatherData: weather as never };
  const result = computeResultsComparisonStats([sessionWithWeather], ['2024']);

  it('weather data is passed through to the interval', () => {
    expect(result.intervals[0].weatherData).toEqual(weather);
  });
});

describe('computeResultsComparisonStats — session without weather data', () => {
  const session = fixedDistSession(5);
  const result = computeResultsComparisonStats([session], ['2024']);

  it('interval does not have a weatherData key when session has none', () => {
    expect('weatherData' in result.intervals[0]).toBe(false);
  });
});

// ─── Trend value accuracy ──────────────────────────────────────────────────────

describe('computeResultsComparisonStats — trend value accuracy', () => {
  it('dnfRate trend reflects actual DNF share', () => {
    // 3 finishers + 1 DNF = 4 total, 4 starters (no DNS)
    // dnfRate = pct(1, 4) = 25.0
    const results = [
      ...makeResultRecords(3, { finishStatus: 1, distanceMiles: 50, timeSeconds: 14400 }),
      makeResultRecord({ bib: 'd1', finishStatus: 2, distanceMiles: null, timeSeconds: null }),
    ];
    const r = computeResultsComparisonStats([makeSession(results)], ['2024']);
    expect(r.trends.dnfRate[0].value).toBe(25.0);
  });

  it('medianFinisherAge trend returns null when no ages are recorded', () => {
    const results = makeResultRecords(5, {
      finishStatus: 1, distanceMiles: 50, timeSeconds: 14400, age: null,
    });
    const r = computeResultsComparisonStats([makeSession(results)], ['2024']);
    expect(r.trends.medianFinisherAge[0].value).toBeNull();
  });

  it('finishRate trend is 0 when all records are DNS', () => {
    const results = makeResultRecords(5, { finishStatus: 3, distanceMiles: null, timeSeconds: null });
    const r = computeResultsComparisonStats([makeSession(results)], ['2024']);
    expect(r.trends.finishRate[0].value).toBe(0);
  });
});

// ─── Edge cases ────────────────────────────────────────────────────────────────

describe('computeResultsComparisonStats — edge cases', () => {
  it('handles a session with zero results', () => {
    const r = computeResultsComparisonStats([makeSession([])], ['2024']);
    expect(r.intervals[0].resultCount).toBe(0);
    expect(r.trends.totalEntrants[0].value).toBe(0);
  });

  it('handles five sessions (maximum intervals)', () => {
    const sessions = Array.from({ length: 5 }, () => fixedDistSession(3));
    const labels = ['2020', '2021', '2022', '2023', '2024'];
    const r = computeResultsComparisonStats(sessions, labels);
    expect(r.intervals).toHaveLength(5);
    expect(r.trends.totalEntrants).toHaveLength(5);
  });

  it('primaryEventType falls back to fixed-distance when first session is empty', () => {
    const r = computeResultsComparisonStats([makeSession([])], ['2024']);
    expect(r.primaryEventType).toBe('fixed-distance');
  });
});
