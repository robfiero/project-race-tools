import { describe, it, expect } from 'vitest';
import { haversineDistance } from '../../geo/haversine.js';

// Tolerance helpers
const WITHIN = (miles: number) => (val: number, expected: number) =>
  expect(Math.abs(val - expected)).toBeLessThan(miles);

describe('haversineDistance', () => {

  // ── Identity ──────────────────────────────────────────────────────────────

  it('returns 0 for the same point', () => {
    expect(haversineDistance(42.36, -71.06, 42.36, -71.06)).toBe(0);
  });

  it('returns 0 for the equator origin (0, 0) to itself', () => {
    expect(haversineDistance(0, 0, 0, 0)).toBe(0);
  });

  // ── Symmetry ──────────────────────────────────────────────────────────────

  it('is symmetric: dist(A, B) === dist(B, A)', () => {
    const ab = haversineDistance(42.36, -71.06, 34.05, -118.24);
    const ba = haversineDistance(34.05, -118.24, 42.36, -71.06);
    expect(ab).toBeCloseTo(ba, 6);
  });

  // ── Known distances ───────────────────────────────────────────────────────

  it('Boston → Los Angeles is approximately 2,590 miles', () => {
    // Boston: 42.3601°N, 71.0589°W  |  LA: 34.0522°N, 118.2437°W
    const dist = haversineDistance(42.3601, -71.0589, 34.0522, -118.2437);
    WITHIN(10)(dist, 2590);
  });

  it('New York City → Chicago is approximately 713 miles', () => {
    // NYC: 40.7128°N, 74.0060°W  |  Chicago: 41.8781°N, 87.6298°W
    const dist = haversineDistance(40.7128, -74.0060, 41.8781, -87.6298);
    WITHIN(10)(dist, 713);
  });

  it('Boston → Portland ME is approximately 99 miles great-circle (short regional distance)', () => {
    // Boston: 42.3601, -71.0589  |  Portland ME: 43.6591, -70.2568
    // Great-circle ~99 mi; driving distance is ~107 mi via roads
    const dist = haversineDistance(42.3601, -71.0589, 43.6591, -70.2568);
    WITHIN(5)(dist, 99);
  });

  it('North Pole → South Pole is approximately 12,437 miles (half circumference)', () => {
    const dist = haversineDistance(90, 0, -90, 0);
    WITHIN(5)(dist, 12437);
  });

  // ── Edge: negative coordinates (southern/western hemisphere) ─────────────

  it('handles negative latitude (southern hemisphere)', () => {
    // Sydney, AU (-33.87, 151.21) → Melbourne, AU (-37.81, 144.96) ≈ 440 miles
    const dist = haversineDistance(-33.87, 151.21, -37.81, 144.96);
    WITHIN(10)(dist, 440);
  });

  it('handles coordinates that cross the prime meridian (lng 0)', () => {
    // London (51.51, -0.13) → Paris (48.86, 2.35) ≈ 214 miles
    const dist = haversineDistance(51.51, -0.13, 48.86, 2.35);
    WITHIN(10)(dist, 214);
  });

  // ── Return type ───────────────────────────────────────────────────────────

  it('always returns a non-negative number', () => {
    expect(haversineDistance(10, 20, -10, -20)).toBeGreaterThan(0);
  });

  it('returns a finite number for any valid lat/lng inputs', () => {
    const result = haversineDistance(0, -180, 0, 180);
    expect(Number.isFinite(result)).toBe(true);
  });
});
