/**
 * Parses CLIENT_ORIGIN (comma-separated) into a Set of allowed origins.
 * http://localhost:5173 is always included for local development.
 */
export function buildAllowedOrigins(envValue: string | undefined): Set<string> {
  const origins = new Set<string>(['http://localhost:5173']);
  if (envValue) {
    envValue
      .split(',')
      .map(o => o.trim())
      .filter(Boolean)
      .forEach(o => origins.add(o));
  }
  return origins;
}

const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * Returns a cors `origin` callback that:
 *  - allows any request with no Origin header (same-origin / non-browser)
 *  - allows origins in the allowedOrigins set
 *  - in dev mode (no CLIENT_ORIGIN set), also allows any localhost port
 *  - rejects everything else
 *
 * The cors package reflects the matched request Origin back as
 * Access-Control-Allow-Origin and adds Vary: Origin automatically.
 */
export function makeOriginCallback(
  allowedOrigins: Set<string>,
  isDev: boolean,
): (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => void {
  return function originCallback(origin, cb) {
    if (!origin || allowedOrigins.has(origin)) {
      cb(null, true);
      return;
    }
    if (isDev && LOCALHOST_RE.test(origin)) {
      cb(null, true);
      return;
    }
    cb(new Error('Not allowed by CORS'));
  };
}
