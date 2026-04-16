// Geocodes a venue address using the US Census Bureau Geocoding API.
// No API key required. One call per upload session.
// https://geocoding.geo.census.gov/geocoder/

export interface GeocodedAddress {
  lat: number;
  lng: number;
  matchedAddress: string;
}

export async function geocodeVenueAddress(address: string): Promise<GeocodedAddress | null> {
  const params = new URLSearchParams({
    address,
    benchmark: 'Public_AR_Current',
    format: 'json',
  });

  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?${params}`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;

    const data = await response.json() as CensusGeocoderResponse;
    const matches = data?.result?.addressMatches;
    if (!matches || matches.length === 0) return null;

    const match = matches[0];
    return {
      lat: match.coordinates.y,
      lng: match.coordinates.x,
      matchedAddress: match.matchedAddress,
    };
  } catch {
    // Network error or timeout — distance stats will be unavailable
    return null;
  }
}

// Census Geocoder response shape (partial)
interface CensusGeocoderResponse {
  result?: {
    addressMatches?: Array<{
      matchedAddress: string;
      coordinates: { x: number; y: number };
    }>;
  };
}
