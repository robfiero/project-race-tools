import { createReadStream, existsSync } from 'fs';
import { createInterface } from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';
import { setZipCentroids } from './participantLocation.js';
import type { LatLng } from './participantLocation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ZIP_FILE = path.join(__dirname, '../../data/zip-centroids.csv');

// Loads the zip centroid file (zip,lat,lng CSV) into memory.
// The file is ~3MB and contains ~33,000 US zip codes.
// If the file is absent, distance stats will degrade gracefully to state centroids.
export async function loadZipCentroids(): Promise<void> {
  if (!existsSync(ZIP_FILE)) {
    console.warn('[geo] zip-centroids.csv not found — distance stats will use state centroids as fallback');
    return;
  }

  const map = new Map<string, LatLng>();
  const rl = createInterface({ input: createReadStream(ZIP_FILE) });
  let firstLine = true;

  for await (const line of rl) {
    if (firstLine) { firstLine = false; continue; } // skip header
    // Format: code,city,state,county,area_code,lat,lon
    const parts = line.split(',');
    if (parts.length < 7) continue;
    const zip = parts[0].trim().padStart(5, '0');
    const lat = parseFloat(parts[5]);
    const lng = parseFloat(parts[6]);
    if (!isNaN(lat) && !isNaN(lng)) {
      map.set(zip, { lat, lng });
    }
  }

  setZipCentroids(map);
  console.info(`[geo] Loaded ${map.size.toLocaleString()} zip centroids`);
}
