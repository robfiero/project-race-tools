import { describe, expect, it } from 'vitest';
import {
  generateResultsCSV,
  generateResultsWeather,
  isValidResultsSampleId,
} from '../../sample/resultsGenerator.js';
import { parseResultsFile } from '../../parser/resultsParser.js';
import { computeResultsStats } from '../../stats/results.js';
import { computeResultsComparisonStats } from '../../stats/resultsComparison.js';
import { makeResultRecord, makeResultRecords } from '../helpers.js';
import type { ResultRecord, ResultsSessionData, ResultsStats, WeatherData, WeatherSnapshot } from '../../types.js';

async function statsForSample(sampleId: string): Promise<ResultsStats> {
  const csv = generateResultsCSV(sampleId);
  const parsed = await parseResultsFile(Buffer.from(csv, 'utf8'), `${sampleId}.csv`, Buffer.byteLength(csv));
  return computeResultsStats(parsed.results);
}

async function sessionForSample(sampleId: string, label: string): Promise<ResultsSessionData> {
  const csv = generateResultsCSV(sampleId);
  const parsed = await parseResultsFile(Buffer.from(csv, 'utf8'), `${sampleId}.csv`, Buffer.byteLength(csv));
  const weatherData = generateResultsWeather(sampleId);
  return {
    sessionId: sampleId,
    createdAt: new Date(`${label}-01-01T00:00:00Z`),
    raceName: sampleId,
    results: parsed.results,
    ...(weatherData ? { weatherData } : {}),
  };
}

function finiteNumbers(values: number[]): boolean {
  return values.every(value => Number.isFinite(value));
}

function uniqueNonNull(values: Array<number | null | undefined>): Set<number> {
  return new Set(values.filter((value): value is number => value != null));
}

function genderTotal(gender: ResultsStats['demographics']['gender']): number {
  return gender.male + gender.female + gender.nonBinary + gender.unknown;
}

function makeWeather(label: string, snapshots: WeatherSnapshot[]): WeatherData {
  return {
    venueAddress: '1 Test Road, Testville, MA',
    raceStartIso: snapshots[0]?.timeIso ?? `${label}-05-01T08:00`,
    raceEndIso: snapshots[snapshots.length - 1]?.timeIso ?? `${label}-05-01T10:00`,
    snapshots,
  };
}

const startOnlySnapshot: WeatherSnapshot = {
  timeIso: '2024-05-01T08:00',
  label: 'Race Start',
  tempF: 52,
  feelsLikeF: 51,
  weatherCode: 2,
  weatherDesc: 'Partly cloudy',
  cloudCoverPct: 35,
  windMph: 5.2,
  windGustMph: 9.4,
  windDir: 'NW',
  precipInch: 0,
  precipType: '',
  precipIntensity: '',
};

describe('Race Results demo samples — multi-year event coverage', () => {
  it('keeps the existing Mountain Endurance demo as a multi-event fixed-distance comparison', async () => {
    const years = ['2022', '2023', '2024'];
    const statsByYear = await Promise.all(
      years.map(year => statsForSample(`mountain-endurance-results-${year}`)),
    );

    for (const stats of statsByYear) {
      expect(stats.performance.events.length).toBeGreaterThan(1);
      expect(new Set(stats.performance.events.map(event => event.eventType))).toEqual(new Set(['fixed-distance']));
      expect(stats.attrition.byEvent.length).toBeGreaterThan(1);
    }

    const eventNames = statsByYear.map(stats => stats.performance.events.map(event => event.eventName));
    expect(eventNames[0]).toEqual(eventNames[1]);
    expect(eventNames[1]).toEqual(eventNames[2]);
  });

  it('generates Riverside Community 5K as a five-year single-event fixed-distance comparison with useful variation', async () => {
    const years = ['2020', '2021', '2022', '2023', '2024'];
    const sampleIds = years.map(year => `riverside-5k-results-${year}`);
    const statsByYear = await Promise.all(sampleIds.map(statsForSample));
    const sessions = await Promise.all(sampleIds.map((id, index) => sessionForSample(id, years[index])));
    const comparison = computeResultsComparisonStats(sessions, years);

    expect(sampleIds.every(isValidResultsSampleId)).toBe(true);
    expect(comparison.intervals.map(interval => interval.label)).toEqual(years);
    expect(comparison.intervals).toHaveLength(5);
    expect(comparison.primaryEventType).toBe('fixed-distance');

    for (const stats of statsByYear) {
      expect(stats.performance.events).toHaveLength(1);
      expect(stats.performance.events[0].eventName).toBe('3 mi');
      expect(stats.performance.events[0].eventType).toBe('fixed-distance');
      expect(stats.performance.events[0].finishTime).not.toBeNull();
      expect(stats.performance.events[0].distanceAchieved).toBeNull();

      // Regression condition for single-event UI: byEvent can be empty while other
      // event-scoped stats still expose the selected event.
      expect(stats.attrition.byEvent).toHaveLength(0);
      expect(stats.ageDistributionByEvent.map(event => event.eventName)).toEqual(['3 mi']);
      expect(stats.geographicDistributionByEvent.map(event => event.eventName)).toEqual(['3 mi']);

      expect(stats.summary.totalEntrants).toBeGreaterThanOrEqual(280);
      expect(stats.summary.totalEntrants).toBeLessThanOrEqual(340);
      expect(stats.demographics.gender.nonBinary).toBeGreaterThan(0);
      expect(genderTotal(stats.demographics.gender)).toBe(stats.summary.totalEntrants);
      expect(genderTotal(stats.demographics.finisherGender)).toBe(stats.summary.finishers);
      expect(stats.geographic.internationalParticipants).toBe(0);
      expect(Object.keys(stats.geographic.byCountry)).toEqual(['USA']);
    }

    expect(uniqueNonNull(comparison.trends.totalEntrants.map(point => point.value)).size).toBeGreaterThan(1);
    expect(uniqueNonNull(comparison.trends.finishers.map(point => point.value)).size).toBeGreaterThan(1);
    expect(uniqueNonNull(comparison.trends.dnfRate.map(point => point.value)).size).toBeGreaterThan(1);
    expect(new Set(comparison.intervals.map(interval => interval.stats.summary.dns)).size).toBeGreaterThan(1);
    expect(uniqueNonNull(comparison.trends.medianFinishTimeSeconds.map(point => point.value)).size).toBeGreaterThan(1);
    expect(uniqueNonNull(comparison.trends.medianFinisherAge.map(point => point.value)).size).toBeGreaterThan(1);

    const startTemps = sampleIds.map(id => generateResultsWeather(id)?.snapshots[0]?.tempF);
    const peakTemps = sampleIds.map(id => Math.max(...(generateResultsWeather(id)?.snapshots.map(s => s.tempF) ?? [])));
    expect(uniqueNonNull(startTemps).size).toBeGreaterThan(1);
    expect(uniqueNonNull(peakTemps).size).toBeGreaterThan(1);
  });

  it('generates Foothill 6-Hour Challenge as a two-year single-event fixed-time comparison', async () => {
    const years = ['2023', '2024'];
    const sampleIds = years.map(year => `foothill-6hr-results-${year}`);
    const statsByYear = await Promise.all(sampleIds.map(statsForSample));
    const sessions = await Promise.all(sampleIds.map((id, index) => sessionForSample(id, years[index])));
    const comparison = computeResultsComparisonStats(sessions, years);

    expect(sampleIds.every(isValidResultsSampleId)).toBe(true);
    expect(comparison.intervals.map(interval => interval.label)).toEqual(years);
    expect(comparison.primaryEventType).toBe('fixed-time');
    expect(comparison.trends.medianFinishTimeSeconds).toHaveLength(0);
    expect(comparison.trends.medianDistanceMiles).toHaveLength(2);

    for (const stats of statsByYear) {
      expect(stats.performance.events).toHaveLength(1);
      expect(stats.performance.events[0].eventName).toBe('Event');
      expect(stats.performance.events[0].eventType).toBe('fixed-time');
      expect(stats.performance.events[0].finishTime).toBeNull();
      expect(stats.performance.events[0].distanceAchieved).not.toBeNull();
      expect(stats.performance.events[0].distanceAchieved?.medianMiles).toBeGreaterThan(0);
      expect(stats.attrition.byEvent).toHaveLength(0);
      expect(stats.ageDistributionByEvent.map(event => event.eventName)).toEqual(['Event']);
      expect(stats.geographicDistributionByEvent.map(event => event.eventName)).toEqual(['Event']);
      expect(stats.summary.totalEntrants).toBeGreaterThanOrEqual(115);
      expect(stats.summary.totalEntrants).toBeLessThanOrEqual(130);
      expect(stats.demographics.gender.nonBinary).toBeGreaterThan(0);
    }

    expect(uniqueNonNull(comparison.trends.totalEntrants.map(point => point.value)).size).toBeGreaterThan(1);
    expect(uniqueNonNull(comparison.trends.medianDistanceMiles.map(point => point.value)).size).toBeGreaterThan(1);
  });

  it('keeps added or discontinued events distinguishable from zero-participation years', () => {
    const tenMile = makeResultRecords(5, { finishStatus: 1, distanceMiles: 10, timeSeconds: 3600 });
    const tenAndTwenty = [
      ...makeResultRecords(5, { finishStatus: 1, distanceMiles: 10, timeSeconds: 3600 }),
      ...makeResultRecords(5, { finishStatus: 1, distanceMiles: 20, timeSeconds: 7200 }).map((record, index) => ({ ...record, bib: `20-${index}` })),
    ];
    const comparison = computeResultsComparisonStats([
      { sessionId: 'year-1', createdAt: new Date('2023-01-01T00:00:00Z'), raceName: 'Changing Race', results: tenMile },
      { sessionId: 'year-2', createdAt: new Date('2024-01-01T00:00:00Z'), raceName: 'Changing Race', results: tenAndTwenty },
    ], ['2023', '2024']);

    const firstYearEvents = comparison.intervals[0].stats.performance.events.map(event => event.eventName);
    const secondYearEvents = comparison.intervals[1].stats.performance.events.map(event => event.eventName);
    expect(firstYearEvents).toEqual(['10 mi']);
    expect(secondYearEvents).toEqual(['20 mi', '10 mi']);
    expect(firstYearEvents).not.toContain('20 mi');
  });
});

describe('Race Results demo samples — weather resilience data', () => {
  it('Riverside weather has complete race-window start, peak, end, and condition data', () => {
    const years = ['2020', '2021', '2022', '2023', '2024'];
    for (const year of years) {
      const weather = generateResultsWeather(`riverside-5k-results-${year}`);
      expect(weather).toBeDefined();
      expect(weather?.snapshots.map(snapshot => snapshot.label)).toEqual(['Race Start', '+1h', 'Race End']);
      expect(finiteNumbers(weather?.snapshots.map(snapshot => snapshot.tempF) ?? [])).toBe(true);
      expect(finiteNumbers(weather?.snapshots.map(snapshot => snapshot.windMph) ?? [])).toBe(true);
      expect(weather?.snapshots.every(snapshot => snapshot.weatherDesc.trim().length > 0)).toBe(true);
      expect(weather?.snapshots.every(snapshot => !Number.isNaN(snapshot.tempF))).toBe(true);
    }
  });

  it('Foothill weather has real race-window condition samples and no invented empty values', () => {
    for (const year of ['2023', '2024']) {
      const weather = generateResultsWeather(`foothill-6hr-results-${year}`);
      expect(weather).toBeDefined();
      expect(weather?.snapshots.map(snapshot => snapshot.label)).toEqual(['Race Start', '+2h', '+4h', 'Race End']);
      expect(weather?.snapshots.every(snapshot => snapshot.weatherDesc.trim().length > 0)).toBe(true);
      expect(finiteNumbers(weather?.snapshots.map(snapshot => snapshot.tempF) ?? [])).toBe(true);
      expect(finiteNumbers(weather?.snapshots.map(snapshot => snapshot.windGustMph) ?? [])).toBe(true);
    }
  });

  it('comparison stats safely pass through full, sparse, start-only, missing, and no-weather intervals', () => {
    const baseResults = makeResultRecords(5, { finishStatus: 1, distanceMiles: 5, timeSeconds: 1800 });
    const fullWeather = makeWeather('2021', [
      { ...startOnlySnapshot, timeIso: '2021-05-01T08:00', label: 'Race Start', weatherDesc: 'Clear sky' },
      { ...startOnlySnapshot, timeIso: '2021-05-01T09:00', label: '+1h', tempF: 58, weatherDesc: 'Partly cloudy' },
      { ...startOnlySnapshot, timeIso: '2021-05-01T10:00', label: 'Race End', tempF: 62, weatherDesc: 'Overcast' },
    ]);
    const startOnlyWeather = makeWeather('2022', [
      { ...startOnlySnapshot, timeIso: '2022-05-01T08:00', label: 'Race Start' },
    ]);
    const sessions: ResultsSessionData[] = [
      { sessionId: 'full', createdAt: new Date('2021-01-01T00:00:00Z'), raceName: 'Weather Race', results: baseResults, weatherData: fullWeather },
      { sessionId: 'start-only', createdAt: new Date('2022-01-01T00:00:00Z'), raceName: 'Weather Race', results: baseResults, weatherData: startOnlyWeather },
      { sessionId: 'missing', createdAt: new Date('2023-01-01T00:00:00Z'), raceName: 'Weather Race', results: baseResults },
    ];

    const comparison = computeResultsComparisonStats(sessions, ['2021', '2022', '2023']);
    expect(comparison.intervals[0].weatherData?.snapshots).toHaveLength(3);
    expect(comparison.intervals[1].weatherData?.snapshots).toHaveLength(1);
    expect('weatherData' in comparison.intervals[2]).toBe(false);

    const noWeather = computeResultsComparisonStats([
      { sessionId: 'no-1', createdAt: new Date('2021-01-01T00:00:00Z'), raceName: 'Dry Race', results: baseResults },
      { sessionId: 'no-2', createdAt: new Date('2022-01-01T00:00:00Z'), raceName: 'Dry Race', results: baseResults },
    ], ['2021', '2022']);
    expect(noWeather.intervals.every(interval => !('weatherData' in interval))).toBe(true);
  });
});

describe('Race Results demo samples — demographics and geography bases', () => {
  it('participant and finisher gender are distinct denominators when DNS/DNF records are present', () => {
    const results: ResultRecord[] = [
      ...makeResultRecords(6, { finishStatus: 1, gender: 'M', distanceMiles: 5, timeSeconds: 1800 }),
      ...makeResultRecords(4, { finishStatus: 1, gender: 'F', distanceMiles: 5, timeSeconds: 2100 }).map((record, index) => ({ ...record, bib: `f-${index}` })),
      makeResultRecord({ bib: 'nb-finish', finishStatus: 1, gender: 'NB', distanceMiles: 5, timeSeconds: 2400 }),
      makeResultRecord({ bib: 'nb-dns', finishStatus: 3, gender: 'NB', distanceMiles: null, timeSeconds: null }),
      makeResultRecord({ bib: 'f-dnf', finishStatus: 2, gender: 'F', distanceMiles: 5, timeSeconds: null }),
    ];
    const stats = computeResultsStats(results);

    expect(genderTotal(stats.demographics.gender)).toBe(13);
    expect(genderTotal(stats.demographics.finisherGender)).toBe(11);
    expect(stats.demographics.gender.nonBinaryPercent).toBeGreaterThan(stats.demographics.finisherGender.nonBinaryPercent);
  });

  it('age stats and selected-event age distributions tolerate missing ages without fake precision', () => {
    const results = [
      ...makeResultRecords(4, { finishStatus: 1, distanceMiles: 5, timeSeconds: 1800, age: null }),
      makeResultRecord({ bib: 'age-1', finishStatus: 1, distanceMiles: 5, timeSeconds: 2100, age: 42 }),
    ];
    const stats = computeResultsStats(results);

    expect(stats.demographics.finisherAge.median).toBe(42);
    expect(stats.ageDistributionByEvent).toHaveLength(1);
    expect(stats.ageDistributionByEvent[0].finisherAge.median).toBe(42);
  });

  it('overall geography uses all participants while event geography is scoped to each event', () => {
    const results = [
      ...makeResultRecords(4, { finishStatus: 1, distanceMiles: 10, state: 'MA', country: 'USA' }),
      ...makeResultRecords(4, { finishStatus: 1, distanceMiles: 20, state: 'ON', country: 'CAN' }).map((record, index) => ({ ...record, bib: `can-${index}` })),
    ];
    const stats = computeResultsStats(results);

    expect(stats.geographic.usParticipants).toBe(4);
    expect(stats.geographic.internationalParticipants).toBe(4);
    expect(Object.keys(stats.geographic.byCountry).sort()).toEqual(['CAN', 'USA']);
    expect(stats.geographicDistributionByEvent).toHaveLength(2);

    const tenMileGeo = stats.geographicDistributionByEvent.find(event => event.eventName === '10 mi')?.geographic;
    const twentyMileGeo = stats.geographicDistributionByEvent.find(event => event.eventName === '20 mi')?.geographic;
    expect(tenMileGeo?.usParticipants).toBe(4);
    expect(tenMileGeo?.internationalParticipants).toBe(0);
    expect(twentyMileGeo?.usParticipants).toBe(0);
    expect(twentyMileGeo?.internationalParticipants).toBe(4);
  });
});
