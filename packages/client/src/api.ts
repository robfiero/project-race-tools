// In development the Vite proxy forwards /api/* to localhost:3001, so the
// base URL is empty and relative paths work as-is.
//
// In production VITE_API_BASE_URL is set to the App Runner origin
// (e.g. https://api.racestats.robfiero.net) at build time by release-ui.sh.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
