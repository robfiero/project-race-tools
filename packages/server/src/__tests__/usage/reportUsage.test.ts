import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getReportRunCounts,
  incrementReportRun,
  resetReportRunCountsForTests,
} from '../../usage/reportUsage.js';

describe('report usage counters', () => {
  let infoSpy: { mockRestore: () => void };

  beforeEach(() => {
    resetReportRunCountsForTests();
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
  });

  it('starts all counts at zero', () => {
    expect(getReportRunCounts()).toEqual({
      registration_single_year: 0,
      registration_multi_year: 0,
      results_single_year: 0,
      results_multi_year: 0,
    });
  });

  it('increments each known report type', () => {
    incrementReportRun('registration_single_year');
    incrementReportRun('registration_multi_year');
    incrementReportRun('results_single_year');
    incrementReportRun('results_multi_year');
    incrementReportRun('results_multi_year');

    expect(getReportRunCounts()).toEqual({
      registration_single_year: 1,
      registration_multi_year: 1,
      results_single_year: 1,
      results_multi_year: 2,
    });
  });

  it('returns a copy that cannot mutate internal counts', () => {
    const counts = getReportRunCounts();
    counts.registration_single_year = 99;

    expect(getReportRunCounts().registration_single_year).toBe(0);
  });
});
