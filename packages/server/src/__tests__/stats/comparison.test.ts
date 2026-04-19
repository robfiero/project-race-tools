import { describe, it, expect } from 'vitest';
import { computeComparisonStats, MAX_COMPARISON_INTERVALS } from '../../stats/comparison.js';
import { makeParticipant, makeParticipants } from '../helpers.js';
import type { ParticipantRecord, SessionData } from '../../types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _sid = 0;

function makeSession(
  participants: ParticipantRecord[],
  overrides: Partial<SessionData> = {},
): SessionData {
  return {
    sessionId: `session-${++_sid}`,
    createdAt: new Date(),
    raceName: 'Test Race',
    venueAddress: null,
    venueLat: null,
    venueLng: null,
    timezone: 'America/New_York',
    events: ['50 Mile'],
    participants,
    ...overrides,
  };
}

/** Session with a mix of genders, ages, and states. */
function richSession(count = 20): SessionData {
  const participants = [
    ...makeParticipants(Math.floor(count * 0.55), { gender: 'M', age: 38, state: 'MA', country: 'USA' }),
    ...makeParticipants(Math.floor(count * 0.40), { gender: 'F', age: 34, state: 'NH', country: 'USA' }),
    ...makeParticipants(Math.ceil(count * 0.05), { gender: 'NB', age: 29, state: 'VT', country: 'USA' }),
  ].map((p, i) => ({ ...p, orderId: String(10001 + i) }));
  return makeSession(participants);
}

// ─── MAX_COMPARISON_INTERVALS ─────────────────────────────────────────────────

describe('MAX_COMPARISON_INTERVALS', () => {
  it('is defined and equals 5', () => expect(MAX_COMPARISON_INTERVALS).toBe(5));
});

// ─── Single session ────────────────────────────────────────────────────────────

describe('computeComparisonStats — single session', () => {
  const session = richSession(20);
  const result = computeComparisonStats([session], ['2024']);

  it('produces one interval', () => expect(result.intervals).toHaveLength(1));
  it('assigns the correct label', () => expect(result.intervals[0].label).toBe('2024'));
  it('assigns the correct sessionId', () => expect(result.intervals[0].sessionId).toBe(session.sessionId));
  it('assigns the correct raceName', () => expect(result.intervals[0].raceName).toBe('Test Race'));
  it('participantCount matches session participant count', () => {
    expect(result.intervals[0].participantCount).toBe(session.participants.length);
  });

  it('each trend has exactly 1 data point', () => {
    expect(result.trends.participantCount).toHaveLength(1);
    expect(result.trends.femalePercent).toHaveLength(1);
    expect(result.trends.malePercent).toHaveLength(1);
    expect(result.trends.nonBinaryPercent).toHaveLength(1);
    expect(result.trends.medianAge).toHaveLength(1);
    expect(result.trends.stateCount).toHaveLength(1);
    expect(result.trends.countryCount).toHaveLength(1);
    expect(result.trends.internationalPercent).toHaveLength(1);
  });

  it('trend labels match the input label', () => {
    expect(result.trends.participantCount[0].label).toBe('2024');
    expect(result.trends.femalePercent[0].label).toBe('2024');
  });

  it('participantCount trend value matches session count', () => {
    expect(result.trends.participantCount[0].value).toBe(session.participants.length);
  });

  it('gender trend values are non-null', () => {
    expect(result.trends.femalePercent[0].value).not.toBeNull();
    expect(result.trends.malePercent[0].value).not.toBeNull();
  });

  it('medianAge trend value reflects the participant ages', () => {
    // Most participants have age 38 or 34, so median should be in that range
    expect(result.trends.medianAge[0].value).toBeGreaterThan(0);
  });

  it('stateCount reflects distinct states', () => {
    // MA, NH, VT → 3 states
    expect(result.trends.stateCount[0].value).toBe(3);
  });

  it('countryCount reflects distinct countries', () => {
    expect(result.trends.countryCount[0].value).toBe(1); // only USA
  });

  it('internationalPercent is 0 when all participants are domestic', () => {
    expect(result.trends.internationalPercent[0].value).toBe(0);
  });
});

// ─── Distance trends absent without venue ─────────────────────────────────────

describe('computeComparisonStats — no venue (no distance data)', () => {
  const session = richSession(10);
  const result = computeComparisonStats([session], ['2024']);

  it('hasDistanceTrend is false when no venue is provided', () => {
    expect(result.hasDistanceTrend).toBe(false);
  });

  it('medianDistanceMiles trend is empty when hasDistanceTrend is false', () => {
    expect(result.trends.medianDistanceMiles).toHaveLength(0);
  });

  it('localPercent trend is empty when hasDistanceTrend is false', () => {
    expect(result.trends.localPercent).toHaveLength(0);
  });

  it('destinationPercent trend is empty when hasDistanceTrend is false', () => {
    expect(result.trends.destinationPercent).toHaveLength(0);
  });
});

// ─── Two sessions ──────────────────────────────────────────────────────────────

describe('computeComparisonStats — two sessions', () => {
  const s1Participants = [
    ...makeParticipants(8, { gender: 'M', age: 35, state: 'MA', country: 'USA' }),
    ...makeParticipants(4, { gender: 'F', age: 30, state: 'NH', country: 'USA' }),
  ].map((p, i) => ({ ...p, orderId: String(10001 + i) }));

  const s2Participants = [
    ...makeParticipants(6, { gender: 'M', age: 40, state: 'MA', country: 'USA' }),
    ...makeParticipants(6, { gender: 'F', age: 36, state: 'NH', country: 'USA' }),
    ...makeParticipants(3, { gender: 'NB', age: 28, state: 'VT', country: 'USA' }),
  ].map((p, i) => ({ ...p, orderId: String(20001 + i) }));

  const s1 = makeSession(s1Participants);
  const s2 = makeSession(s2Participants);
  const result = computeComparisonStats([s1, s2], ['2023', '2024']);

  it('produces two intervals', () => expect(result.intervals).toHaveLength(2));

  it('labels are correctly ordered', () => {
    expect(result.intervals[0].label).toBe('2023');
    expect(result.intervals[1].label).toBe('2024');
  });

  it('each trend has exactly 2 data points', () => {
    for (const [, trend] of Object.entries(result.trends)) {
      if ((trend as unknown[]).length > 0) {
        expect((trend as unknown[]).length).toBe(2);
      }
    }
  });

  it('participantCount trend reflects both session sizes', () => {
    expect(result.trends.participantCount[0].value).toBe(12);
    expect(result.trends.participantCount[1].value).toBe(15);
  });

  it('femalePercent increases when more women are in s2', () => {
    // s1: 4/12 = 33.3%, s2: 6/15 = 40%
    const v1 = result.trends.femalePercent[0].value!;
    const v2 = result.trends.femalePercent[1].value!;
    expect(v2).toBeGreaterThan(v1);
  });

  it('nonBinaryPercent is 0 in s1 and positive in s2', () => {
    expect(result.trends.nonBinaryPercent[0].value).toBe(0);
    expect(result.trends.nonBinaryPercent[1].value).toBeGreaterThan(0);
  });

  it('stateCount grows when new states are present in s2', () => {
    // Both have MA and NH; s2 also has VT → s2 has 3 states
    const sc1 = result.trends.stateCount[0].value!;
    const sc2 = result.trends.stateCount[1].value!;
    expect(sc2).toBeGreaterThanOrEqual(sc1);
  });
});

// ─── International participants ────────────────────────────────────────────────

describe('computeComparisonStats — international participants', () => {
  it('internationalPercent is > 0 when some participants are from other countries', () => {
    const participants = [
      ...makeParticipants(8, { country: 'USA', state: 'MA' }),
      ...makeParticipants(2, { country: 'CAN', state: 'ON' }),
    ].map((p, i) => ({ ...p, orderId: String(i) }));
    const result = computeComparisonStats([makeSession(participants)], ['2024']);
    // 2 international out of 10 = 20%
    expect(result.trends.internationalPercent[0].value).toBeCloseTo(20, 0);
  });

  it('countryCount is 2 when participants come from two countries', () => {
    const participants = [
      ...makeParticipants(5, { country: 'USA', state: 'MA' }),
      ...makeParticipants(3, { country: 'CAN', state: 'ON' }),
    ].map((p, i) => ({ ...p, orderId: String(i) }));
    const result = computeComparisonStats([makeSession(participants)], ['2024']);
    expect(result.trends.countryCount[0].value).toBe(2);
  });
});

// ─── Comped and coupon participants ───────────────────────────────────────────

describe('computeComparisonStats — comped and coupon trends', () => {
  it('compedPercent trend is 0 when no comped participants', () => {
    const participants = makeParticipants(10, { isComped: false });
    const result = computeComparisonStats([makeSession(participants)], ['2024']);
    expect(result.trends.compedPercent[0].value).toBe(0);
  });

  it('couponUsagePercent trend is 0 when no coupons used', () => {
    const participants = makeParticipants(10, { hasCoupon: false });
    const result = computeComparisonStats([makeSession(participants)], ['2024']);
    expect(result.trends.couponUsagePercent[0].value).toBe(0);
  });

  it('compedPercent is non-zero when comped participants are present', () => {
    const participants = [
      ...makeParticipants(8, { isComped: false }),
      ...makeParticipants(2, { isComped: true }),
    ].map((p, i) => ({ ...p, orderId: String(i) }));
    const result = computeComparisonStats([makeSession(participants)], ['2024']);
    expect(result.trends.compedPercent[0].value).toBeGreaterThan(0);
  });
});

// ─── Empty session ─────────────────────────────────────────────────────────────

describe('computeComparisonStats — empty session', () => {
  it('does not throw for a session with no participants', () => {
    expect(() => computeComparisonStats([makeSession([])], ['2024'])).not.toThrow();
  });

  it('participantCount trend value is 0', () => {
    const result = computeComparisonStats([makeSession([])], ['2024']);
    expect(result.trends.participantCount[0].value).toBe(0);
  });

  it('internationalPercent is 0 for an empty session', () => {
    const result = computeComparisonStats([makeSession([])], ['2024']);
    expect(result.trends.internationalPercent[0].value).toBe(0);
  });
});

// ─── Five sessions (maximum) ───────────────────────────────────────────────────

describe('computeComparisonStats — five sessions', () => {
  const sessions = Array.from({ length: 5 }, (_, i) => {
    const parts = makeParticipants(10 + i * 2, { gender: 'M', state: 'MA', country: 'USA' });
    return makeSession(parts);
  });
  const labels = ['2020', '2021', '2022', '2023', '2024'];
  const result = computeComparisonStats(sessions, labels);

  it('produces five intervals', () => expect(result.intervals).toHaveLength(5));

  it('each trend has five data points', () => {
    expect(result.trends.participantCount).toHaveLength(5);
    expect(result.trends.femalePercent).toHaveLength(5);
  });

  it('participant counts grow across years', () => {
    for (let i = 1; i < 5; i++) {
      expect(result.trends.participantCount[i].value).toBeGreaterThan(
        result.trends.participantCount[i - 1].value ?? 0,
      );
    }
  });

  it('labels are assigned in order', () => {
    labels.forEach((lbl, i) => {
      expect(result.intervals[i].label).toBe(lbl);
    });
  });
});

// ─── activeParticipants trend ──────────────────────────────────────────────────

describe('computeComparisonStats — activeParticipants trend', () => {
  it('is less than participantCount when some are removed or dropping', () => {
    const participants = [
      ...makeParticipants(7, { removed: false, droppingFromRace: false }),
      ...makeParticipants(3, { removed: true, droppingFromRace: false }),
    ].map((p, i) => ({ ...p, orderId: String(i) }));
    const result = computeComparisonStats([makeSession(participants)], ['2024']);
    const total = result.trends.participantCount[0].value!;
    const active = result.trends.activeParticipants[0].value!;
    expect(active).toBeLessThan(total);
  });
});
