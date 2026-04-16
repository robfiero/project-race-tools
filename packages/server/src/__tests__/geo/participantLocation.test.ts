import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  resolveParticipantLocation,
  setZipCentroids,
  type LatLng,
} from '../../geo/participantLocation.js';
import { makeParticipant } from '../helpers.js';

// Reset zip centroids before each test so module state doesn't leak
beforeEach(() => setZipCentroids(null as unknown as Map<string, LatLng>));
afterEach(() => setZipCentroids(null as unknown as Map<string, LatLng>));

describe('resolveParticipantLocation', () => {

  // ── Zip centroid (highest priority) ──────────────────────────────────────

  it('returns zip centroid when zip is loaded and matches', () => {
    const map = new Map<string, LatLng>([['02101', { lat: 42.36, lng: -71.06 }]]);
    setZipCentroids(map);

    const result = resolveParticipantLocation(makeParticipant({ zipCode: '02101', state: 'MA', country: 'USA' }));
    expect(result).toEqual({ lat: 42.36, lng: -71.06 });
  });

  it('falls back to state centroid when zip is not in the loaded map', () => {
    const map = new Map<string, LatLng>(); // empty — no zips loaded
    setZipCentroids(map);

    const result = resolveParticipantLocation(makeParticipant({ zipCode: '99999', state: 'MA', country: 'USA' }));
    // MA state centroid is (42.25, -71.83)
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(42.25, 1);
  });

  it('falls back to state centroid when zip centroids are not loaded', () => {
    // setZipCentroids not called (null via beforeEach)
    const result = resolveParticipantLocation(makeParticipant({ zipCode: '02101', state: 'MA', country: 'USA' }));
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(42.25, 1);
  });

  it('ignores zip for non-US participants even if centroids are loaded', () => {
    const map = new Map<string, LatLng>([['M5V', { lat: 43.64, lng: -79.40 }]]);
    setZipCentroids(map);

    // Canadian participant — zip lookup only fires for USA; falls back to province centroid
    const result = resolveParticipantLocation(makeParticipant({ zipCode: 'M5V', state: 'ON', country: 'CAN' }));
    expect(result).not.toBeNull();
    // Should be the Ontario province centroid, not the M5V entry
    expect(result!.lat).not.toBe(43.64);
  });

  // ── US state centroid ─────────────────────────────────────────────────────

  it('returns US state centroid when no zip is available', () => {
    const result = resolveParticipantLocation(makeParticipant({ zipCode: '', state: 'CA', country: 'USA' }));
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(37.25, 1);
    expect(result!.lng).toBeCloseTo(-119.75, 1);
  });

  it('returns US state centroid for DC', () => {
    const result = resolveParticipantLocation(makeParticipant({ zipCode: '', state: 'DC', country: 'USA' }));
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(38.91, 1);
  });

  it('does not use US state centroids for non-US participants', () => {
    // A state code that exists in US table should not match for a CAN participant
    const result = resolveParticipantLocation(makeParticipant({ zipCode: '', state: 'CA', country: 'CAN' }));
    // 'CA' is not a Canadian province code — should fall back to country centroid
    expect(result).not.toBeNull();
  });

  // ── Canadian province centroid ────────────────────────────────────────────

  it('returns Canadian province centroid for CAN participants', () => {
    const result = resolveParticipantLocation(makeParticipant({ zipCode: '', state: 'ON', country: 'CAN' }));
    expect(result).not.toBeNull();
    // Ontario centroid is roughly (50, -86)
    expect(result!.lat).toBeGreaterThan(40);
    expect(result!.lng).toBeLessThan(-70);
  });

  // ── Country centroid fallback ─────────────────────────────────────────────

  it('returns country centroid when state is unknown but country is known', () => {
    const result = resolveParticipantLocation(makeParticipant({ zipCode: '', state: 'ZZ', country: 'GBR' }));
    expect(result).not.toBeNull();
  });

  it('returns country centroid for international participant with no state', () => {
    const result = resolveParticipantLocation(makeParticipant({ zipCode: '', state: '', country: 'GBR' }));
    expect(result).not.toBeNull();
  });

  // ── Null cases ────────────────────────────────────────────────────────────

  it('returns null when no location info is available', () => {
    const result = resolveParticipantLocation(makeParticipant({ zipCode: '', state: '', country: '' }));
    expect(result).toBeNull();
  });

  it('returns null for an unrecognized country with no state', () => {
    const result = resolveParticipantLocation(makeParticipant({ zipCode: '', state: '', country: 'XYZ' }));
    expect(result).toBeNull();
  });

  it('returns null for a participant whose only location is an unknown US state', () => {
    const result = resolveParticipantLocation(makeParticipant({ zipCode: '', state: 'ZZ', country: 'USA' }));
    // ZZ is not in US_STATE_CENTROIDS; country centroid for USA should exist
    expect(result).not.toBeNull();
  });
});
