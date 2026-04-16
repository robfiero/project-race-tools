import type { ParticipantRecord } from '../types.js';
import { US_STATE_CENTROIDS, CA_PROVINCE_CENTROIDS, COUNTRY_CENTROIDS } from './centroids.js';

export interface LatLng {
  lat: number;
  lng: number;
}

// Resolves a participant's approximate lat/lng for distance calculation.
// Priority: US zip centroid (if available and loaded) → US state centroid →
//           Canadian province centroid → country centroid → null
//
// Note: The zip centroid lookup is handled at server startup by loading the
// zip-centroids data file. If not loaded, falls back to state centroid.
let zipCentroids: Map<string, LatLng> | null = null;

export function setZipCentroids(map: Map<string, LatLng>): void {
  zipCentroids = map;
}

export function resolveParticipantLocation(p: ParticipantRecord): LatLng | null {
  // Try zip centroid first (US only, best precision)
  if (p.zipCode && zipCentroids && (p.country === 'USA' || p.country === 'US')) {
    const zip = zipCentroids.get(p.zipCode);
    if (zip) return zip;
  }

  // Fall back to state centroid
  if (p.state) {
    if (p.country === 'USA' || p.country === 'US') {
      const sc = US_STATE_CENTROIDS[p.state];
      if (sc) return sc;
    }
    if (p.country === 'CAN') {
      const pc = CA_PROVINCE_CENTROIDS[p.state];
      if (pc) return pc;
    }
  }

  // Fall back to country centroid
  if (p.country) {
    const cc = COUNTRY_CENTROIDS[p.country];
    if (cc) return cc;
  }

  return null;
}
