import { describe, it, expect } from 'vitest';
import { computeStats, filterByEvents } from '../../stats/index.js';
import { makeParticipant, makeParticipants } from '../helpers.js';
import type { ParticipantRecord } from '../../types.js';

// Convenience: run computeStats with no venue (distance stats omitted)
function stats(participants: ParticipantRecord[], timezone = 'America/New_York') {
  return computeStats(participants, null, null, null, timezone);
}

// ─── filterByEvents ───────────────────────────────────────────────────────────

describe('filterByEvents', () => {
  const participants = [
    makeParticipant({ orderId: '1', event: '50 Mile' }),
    makeParticipant({ orderId: '2', event: '50 Mile' }),
    makeParticipant({ orderId: '3', event: '100 Mile' }),
  ];

  it('returns all participants when event list is empty', () => {
    expect(filterByEvents(participants, [])).toHaveLength(3);
  });

  it('filters to only the specified event', () => {
    const result = filterByEvents(participants, ['50 Mile']);
    expect(result).toHaveLength(2);
    expect(result.every(p => p.event === '50 Mile')).toBe(true);
  });

  it('filters to multiple specified events', () => {
    const result = filterByEvents(participants, ['50 Mile', '100 Mile']);
    expect(result).toHaveLength(3);
  });

  it('returns empty array for an event name that does not exist', () => {
    expect(filterByEvents(participants, ['Marathon'])).toHaveLength(0);
  });

  it('returns empty array when participants list is empty', () => {
    expect(filterByEvents([], ['50 Mile'])).toHaveLength(0);
  });
});

// ─── Summary stats ────────────────────────────────────────────────────────────

describe('computeStats — summary', () => {
  it('counts total and active participants', () => {
    const participants = [
      makeParticipant({ orderId: '1' }),
      makeParticipant({ orderId: '2', removed: true }),
      makeParticipant({ orderId: '3', droppingFromRace: true }),
    ];
    const s = stats(participants).summary;
    expect(s.totalParticipants).toBe(3);
    expect(s.activeParticipants).toBe(1);
  });

  it('reports one event entry per distinct event name', () => {
    const participants = [
      makeParticipant({ orderId: '1', event: '50 Mile' }),
      makeParticipant({ orderId: '2', event: '50 Mile' }),
      makeParticipant({ orderId: '3', event: '100 Mile' }),
    ];
    const { events } = stats(participants).summary;
    expect(events).toHaveLength(2);
    const fifty = events.find(e => e.name === '50 Mile')!;
    expect(fifty.count).toBe(2);
    expect(fifty.activeCount).toBe(2);
  });

  it('activeCount excludes removed participants within an event', () => {
    const participants = [
      makeParticipant({ orderId: '1', event: '50 Mile' }),
      makeParticipant({ orderId: '2', event: '50 Mile', removed: true }),
    ];
    const fifty = stats(participants).summary.events[0];
    expect(fifty.count).toBe(2);
    expect(fifty.activeCount).toBe(1);
  });
});

// ─── Gender stats ─────────────────────────────────────────────────────────────

describe('computeStats — gender', () => {
  it('correctly counts each gender category', () => {
    const participants = [
      makeParticipant({ orderId: '1', gender: 'M' }),
      makeParticipant({ orderId: '2', gender: 'M' }),
      makeParticipant({ orderId: '3', gender: 'F' }),
      makeParticipant({ orderId: '4', gender: 'NB' }),
      makeParticipant({ orderId: '5', gender: 'Unknown' }),
    ];
    const g = stats(participants).gender;
    expect(g.male).toBe(2);
    expect(g.female).toBe(1);
    expect(g.nonBinary).toBe(1);
    expect(g.unknown).toBe(1);
  });

  it('computes malePercent and femalePercent as rounded values out of total', () => {
    const participants = makeParticipants(4, { gender: 'M' });
    participants[0] = makeParticipant({ orderId: '10001', gender: 'F' });
    const g = stats(participants).gender;
    expect(g.femalePercent).toBeCloseTo(25, 1);
    expect(g.malePercent).toBeCloseTo(75, 1);
  });

  it('does not divide by zero for a single participant', () => {
    const g = stats([makeParticipant()]).gender;
    expect(g.malePercent).toBe(100);
    expect(g.femalePercent).toBe(0);
  });

  it('handles all-female participants', () => {
    const g = stats(makeParticipants(3, { gender: 'F' })).gender;
    expect(g.female).toBe(3);
    expect(g.male).toBe(0);
    expect(g.femalePercent).toBe(100);
  });
});

// ─── Age stats ────────────────────────────────────────────────────────────────

describe('computeStats — age', () => {
  it('returns nulls when no participant has a valid age', () => {
    const a = stats(makeParticipants(3, { age: null })).age;
    expect(a.min).toBeNull();
    expect(a.max).toBeNull();
    expect(a.mean).toBeNull();
    expect(a.median).toBeNull();
    expect(a.buckets).toHaveLength(0);
  });

  it('computes min and max across participants', () => {
    const participants = [
      makeParticipant({ orderId: '1', age: 22 }),
      makeParticipant({ orderId: '2', age: 45 }),
      makeParticipant({ orderId: '3', age: 33 }),
    ];
    const a = stats(participants).age;
    expect(a.min).toBe(22);
    expect(a.max).toBe(45);
  });

  it('computes mean correctly', () => {
    const participants = [
      makeParticipant({ orderId: '1', age: 20 }),
      makeParticipant({ orderId: '2', age: 30 }),
      makeParticipant({ orderId: '3', age: 40 }),
    ];
    const a = stats(participants).age;
    expect(a.mean).toBeCloseTo(30, 2);
  });

  it('computes median for an odd number of participants', () => {
    const participants = [
      makeParticipant({ orderId: '1', age: 20 }),
      makeParticipant({ orderId: '2', age: 30 }),
      makeParticipant({ orderId: '3', age: 40 }),
    ];
    expect(stats(participants).age.median).toBe(30);
  });

  it('computes median for an even number of participants (interpolated)', () => {
    const participants = [
      makeParticipant({ orderId: '1', age: 20 }),
      makeParticipant({ orderId: '2', age: 30 }),
      makeParticipant({ orderId: '3', age: 40 }),
      makeParticipant({ orderId: '4', age: 50 }),
    ];
    expect(stats(participants).age.median).toBe(35); // (30+40)/2
  });

  it('excludes null ages from statistical calculation but not from total count', () => {
    const participants = [
      makeParticipant({ orderId: '1', age: 30 }),
      makeParticipant({ orderId: '2', age: null }),
      makeParticipant({ orderId: '3', age: 50 }),
    ];
    const a = stats(participants).age;
    expect(a.min).toBe(30);
    expect(a.max).toBe(50);
    expect(a.mean).toBeCloseTo(40, 2);
  });

  it('places participants into correct age buckets', () => {
    const participants = [
      makeParticipant({ orderId: '1', age: 19 }), // Under 20
      makeParticipant({ orderId: '2', age: 25 }), // 20–29
      makeParticipant({ orderId: '3', age: 35 }), // 30–39
      makeParticipant({ orderId: '4', age: 72 }), // 70+
    ];
    const buckets = stats(participants).age.buckets;
    expect(buckets.find(b => b.label === 'Under 20')!.count).toBe(1);
    expect(buckets.find(b => b.label === '20–29')!.count).toBe(1);
    expect(buckets.find(b => b.label === '30–39')!.count).toBe(1);
    expect(buckets.find(b => b.label === '70+')!.count).toBe(1);
  });

  it('single participant stats are correct', () => {
    const a = stats([makeParticipant({ age: 42 })]).age;
    expect(a.min).toBe(42);
    expect(a.max).toBe(42);
    expect(a.mean).toBe(42);
    expect(a.median).toBe(42);
  });
});

// ─── Geographic stats ─────────────────────────────────────────────────────────

describe('computeStats — geographic', () => {
  it('counts US vs international participants', () => {
    const participants = [
      makeParticipant({ orderId: '1', country: 'USA' }),
      makeParticipant({ orderId: '2', country: 'USA' }),
      makeParticipant({ orderId: '3', country: 'CAN' }),
    ];
    const g = stats(participants).geographic;
    expect(g.usParticipants).toBe(2);
    expect(g.internationalParticipants).toBe(1);
  });

  it('groups participants by state', () => {
    const participants = [
      makeParticipant({ orderId: '1', state: 'MA' }),
      makeParticipant({ orderId: '2', state: 'MA' }),
      makeParticipant({ orderId: '3', state: 'NY' }),
    ];
    const g = stats(participants).geographic;
    expect(g.byState['MA']).toBe(2);
    expect(g.byState['NY']).toBe(1);
  });

  it('topStates is sorted by count descending', () => {
    const participants = [
      makeParticipant({ orderId: '1', state: 'MA' }),
      makeParticipant({ orderId: '2', state: 'NY' }),
      makeParticipant({ orderId: '3', state: 'NY' }),
    ];
    const top = stats(participants).geographic.topStates;
    expect(top[0].state).toBe('NY');
    expect(top[0].count).toBe(2);
  });

  it('topStates is capped at 20 entries', () => {
    const participants = Array.from({ length: 25 }, (_, i) =>
      makeParticipant({ orderId: String(i + 1), state: `S${String(i).padStart(2, '0')}` }),
    );
    expect(stats(participants).geographic.topStates.length).toBeLessThanOrEqual(20);
  });
});

// ─── Participation stats ──────────────────────────────────────────────────────

describe('computeStats — participation', () => {
  it('counts paid participants (total − comped − relayJoins)', () => {
    const participants = [
      makeParticipant({ orderId: '1' }),                               // paid
      makeParticipant({ orderId: '2', isComped: true }),               // comped
      makeParticipant({ orderId: '3', isRelayJoin: true, isComped: true }), // relay join
    ];
    const p = stats(participants).participation;
    expect(p.totalRegistered).toBe(3);
    expect(p.comped).toBe(1);
    expect(p.relayJoins).toBe(1);
    expect(p.paid).toBe(1);
  });

  it('does not double-count relay joins as comped', () => {
    const participants = [
      makeParticipant({ orderId: '1', isComped: true, isRelayJoin: true }),
    ];
    const p = stats(participants).participation;
    expect(p.comped).toBe(0);
    expect(p.relayJoins).toBe(1);
  });

  it('computes compedPercent and relayJoinsPercent', () => {
    const participants = [
      makeParticipant({ orderId: '1' }),
      makeParticipant({ orderId: '2', isComped: true }),
    ];
    const p = stats(participants).participation;
    expect(p.compedPercent).toBeCloseTo(50, 1);
  });

  it('counts dropped participants', () => {
    const participants = [
      makeParticipant({ orderId: '1', droppingFromRace: true }),
      makeParticipant({ orderId: '2' }),
    ];
    const p = stats(participants).participation;
    expect(p.dropped).toBe(1);
    expect(p.droppedPercent).toBeCloseTo(50, 1);
  });

  it('counts removed participants', () => {
    const participants = [
      makeParticipant({ orderId: '1', removed: true }),
      makeParticipant({ orderId: '2' }),
      makeParticipant({ orderId: '3' }),
    ];
    const p = stats(participants).participation;
    expect(p.removed).toBe(1);
    expect(p.removedPercent).toBeCloseTo(33.33, 1);
  });

  it('handles all-paid participants', () => {
    const p = stats(makeParticipants(5)).participation;
    expect(p.paid).toBe(5);
    expect(p.comped).toBe(0);
    expect(p.relayJoins).toBe(0);
  });
});

// ─── Team stats ───────────────────────────────────────────────────────────────

describe('computeStats — teams', () => {
  it('returns hasTeams: false when no participant has a team name', () => {
    expect(stats(makeParticipants(3)).teams.hasTeams).toBe(false);
  });

  it('counts distinct teams correctly', () => {
    const participants = [
      makeParticipant({ orderId: '1', teamName: 'Alpha' }),
      makeParticipant({ orderId: '2', teamName: 'Alpha' }),
      makeParticipant({ orderId: '3', teamName: 'Beta' }),
      makeParticipant({ orderId: '4', teamName: '' }), // solo
    ];
    const t = stats(participants).teams;
    expect(t.hasTeams).toBe(true);
    expect(t.totalTeams).toBe(2);
    expect(t.soloParticipants).toBe(1);
    expect(t.teamParticipants).toBe(3);
  });

  it('computes average team size', () => {
    // Two teams of 2 → avg 2
    const participants = [
      makeParticipant({ orderId: '1', teamName: 'Alpha' }),
      makeParticipant({ orderId: '2', teamName: 'Alpha' }),
      makeParticipant({ orderId: '3', teamName: 'Beta' }),
      makeParticipant({ orderId: '4', teamName: 'Beta' }),
    ];
    expect(stats(participants).teams.avgTeamSize).toBe(2);
  });

  it('classifies all-male, all-female, and mixed teams', () => {
    const participants = [
      // All-male team
      makeParticipant({ orderId: '1', teamName: 'MaleTeam', gender: 'M' }),
      makeParticipant({ orderId: '2', teamName: 'MaleTeam', gender: 'M' }),
      // All-female team
      makeParticipant({ orderId: '3', teamName: 'FemTeam', gender: 'F' }),
      makeParticipant({ orderId: '4', teamName: 'FemTeam', gender: 'F' }),
      // Mixed team
      makeParticipant({ orderId: '5', teamName: 'Mixed', gender: 'M' }),
      makeParticipant({ orderId: '6', teamName: 'Mixed', gender: 'F' }),
    ];
    const t = stats(participants).teams;
    expect(t.allMaleTeams).toBe(1);
    expect(t.allFemaleTeams).toBe(1);
    expect(t.mixedTeams).toBe(1);
  });
});

// ─── Cross-event stats ────────────────────────────────────────────────────────

describe('computeStats — crossEvent', () => {
  it('returns empty rows when only one event is present', () => {
    const participants = makeParticipants(5, { event: '50 Mile' });
    expect(stats(participants).crossEvent.rows).toHaveLength(0);
  });

  it('returns one row per distinct event when multiple events exist', () => {
    const participants = [
      makeParticipant({ orderId: '1', event: '50 Mile' }),
      makeParticipant({ orderId: '2', event: '100 Mile' }),
    ];
    expect(stats(participants).crossEvent.rows).toHaveLength(2);
  });

  it('sorts cross-event rows by participant count descending', () => {
    const participants = [
      makeParticipant({ orderId: '1', event: '100 Mile' }),
      makeParticipant({ orderId: '2', event: '50 Mile' }),
      makeParticipant({ orderId: '3', event: '50 Mile' }),
    ];
    const rows = stats(participants).crossEvent.rows;
    expect(rows[0].name).toBe('50 Mile');
    expect(rows[0].count).toBe(2);
  });

  it('computes femalePercent per event', () => {
    const participants = [
      makeParticipant({ orderId: '1', event: '50 Mile', gender: 'F' }),
      makeParticipant({ orderId: '2', event: '50 Mile', gender: 'M' }),
      makeParticipant({ orderId: '3', event: '100 Mile', gender: 'F' }),
    ];
    const rows = stats(participants).crossEvent.rows;
    const fifty = rows.find(r => r.name === '50 Mile')!;
    expect(fifty.femalePercent).toBeCloseTo(50, 1);
  });
});

// ─── Registration stats — timezone handling ───────────────────────────────────

describe('computeStats — registration timing', () => {
  // 2026-04-13T22:01:00Z = 6:01 PM EDT (April 13, 2026 = Monday)
  const EDT_6PM = new Date('2026-04-13T22:01:00.000Z');
  // 2026-01-15T15:00:00Z = 10:00 AM EST (January 15, 2026 = Thursday)
  const EST_10AM = new Date('2026-01-15T15:00:00.000Z');

  it('puts registrations in the correct month bucket (ET)', () => {
    const participants = [makeParticipant({ registrationDate: EDT_6PM })];
    const byMonth = stats(participants).registration.byMonth;
    expect(byMonth[0].month).toBe('2026-04');
    expect(byMonth[0].count).toBe(1);
  });

  it('assigns the correct hour of day in Eastern time', () => {
    const participants = [makeParticipant({ registrationDate: EDT_6PM })];
    const byHour = stats(participants).registration.byHourOfDay;
    expect(byHour[18].count).toBe(1); // 6 PM = index 18
    expect(byHour.filter(h => h.count > 0)).toHaveLength(1);
  });

  it('assigns the correct hour for a winter (EST) timestamp', () => {
    const participants = [makeParticipant({ registrationDate: EST_10AM })];
    const byHour = stats(participants).registration.byHourOfDay;
    expect(byHour[10].count).toBe(1); // 10 AM = index 10
  });

  it('assigns the correct day of week in Eastern time', () => {
    // April 13, 2026 is a Monday
    const participants = [makeParticipant({ registrationDate: EDT_6PM })];
    const byDay = stats(participants).registration.byDayOfWeek;
    expect(byDay.find(d => d.day === 'Monday')!.count).toBe(1);
    expect(byDay.find(d => d.day !== 'Monday')!.count).toBe(0);
  });

  it('hour bucket labels are formatted correctly (12-hour with AM/PM)', () => {
    const byHour = stats([makeParticipant()]).registration.byHourOfDay;
    expect(byHour[0].label).toBe('12 AM');
    expect(byHour[12].label).toBe('12 PM');
    expect(byHour[1].label).toBe('1 AM');
    expect(byHour[13].label).toBe('1 PM');
  });

  it('cumulative totals increase monotonically', () => {
    const participants = [
      makeParticipant({ orderId: '1', registrationDate: new Date('2026-01-01T14:00:00Z') }),
      makeParticipant({ orderId: '2', registrationDate: new Date('2026-02-01T14:00:00Z') }),
      makeParticipant({ orderId: '3', registrationDate: new Date('2026-03-01T14:00:00Z') }),
    ];
    const cumulative = stats(participants).registration.cumulative;
    for (let i = 1; i < cumulative.length; i++) {
      expect(cumulative[i].total).toBeGreaterThanOrEqual(cumulative[i - 1].total);
    }
  });

  it('final cumulative total equals participant count', () => {
    const participants = makeParticipants(5).map((p, i) => ({
      ...p,
      registrationDate: new Date(`2026-0${i + 1}-15T14:00:00Z`),
    }));
    const cumulative = stats(participants).registration.cumulative;
    expect(cumulative[cumulative.length - 1].total).toBe(5);
  });

  it('coupon usage count and percent are correct', () => {
    const participants = [
      makeParticipant({ orderId: '1', hasCoupon: true }),
      makeParticipant({ orderId: '2', hasCoupon: true }),
      makeParticipant({ orderId: '3', hasCoupon: false }),
    ];
    const reg = stats(participants).registration;
    expect(reg.couponUsageCount).toBe(2);
    expect(reg.couponUsagePercent).toBeCloseTo(66.67, 1);
  });

  it('early profile count is the first quartile of sorted registrations', () => {
    const participants = Array.from({ length: 8 }, (_, i) =>
      makeParticipant({
        orderId: String(i + 1),
        registrationDate: new Date(2026, 0, i + 1, 12, 0, 0),
      }),
    );
    const reg = stats(participants).registration;
    // quartile = floor(8/4) = 2
    expect(reg.earlyProfile.count).toBe(2);
    expect(reg.lateProfile.count).toBe(2);
  });

  it('uses provided timezone (UTC) for hour assignment', () => {
    // 2026-04-13T22:01:00Z = 22:01 UTC = 18:01 EDT
    const participants = [makeParticipant({ registrationDate: EDT_6PM })];
    const byHour = computeStats(participants, null, null, null, 'UTC').registration.byHourOfDay;
    expect(byHour[22].count).toBe(1); // 10 PM UTC
  });
});

// ─── Distance stats (with venue) ─────────────────────────────────────────────

describe('computeStats — distance stats (with venue)', () => {
  // Fenway Park, Boston: 42.3467, -71.0972
  const VENUE_LAT = 42.3467;
  const VENUE_LNG = -71.0972;
  const VENUE_ADDR = 'Fenway Park, Boston, MA';

  it('distance stats are null when no venue is provided', () => {
    expect(stats(makeParticipants(3)).distance).toBeNull();
  });

  it('returns a DistanceStats object when venue is provided', () => {
    const participants = [makeParticipant({ zipCode: '02134', state: 'MA', country: 'USA' })];
    const result = computeStats(participants, VENUE_LAT, VENUE_LNG, VENUE_ADDR, 'America/New_York');
    expect(result.distance).not.toBeNull();
  });

  it('includes venue address in distance stats', () => {
    const participants = [makeParticipant({ zipCode: '02134', state: 'MA', country: 'USA' })];
    const result = computeStats(participants, VENUE_LAT, VENUE_LNG, VENUE_ADDR, 'America/New_York');
    expect(result.distance!.venueAddress).toBe(VENUE_ADDR);
  });

  it('classifies local participants (< 50 miles)', () => {
    // Participant in Boston area — should be local
    const participants = [makeParticipant({ zipCode: '02134', state: 'MA', country: 'USA' })];
    const result = computeStats(participants, VENUE_LAT, VENUE_LNG, VENUE_ADDR, 'America/New_York');
    expect(result.distance!.local).toBe(1);
    expect(result.distance!.regional).toBe(0);
    expect(result.distance!.destination).toBe(0);
  });

  it('classifies destination participants (>= 200 miles)', () => {
    // LA participant from Boston venue — definitely destination
    const participants = [makeParticipant({ state: 'CA', country: 'USA', zipCode: '' })];
    const result = computeStats(participants, VENUE_LAT, VENUE_LNG, VENUE_ADDR, 'America/New_York');
    expect(result.distance!.destination).toBe(1);
  });
});
