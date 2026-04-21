import { describe, it, expect } from 'vitest';
import { buildAllowedOrigins, makeOriginCallback } from '../corsOrigins.js';

// ─── buildAllowedOrigins ──────────────────────────────────────────────────────

describe('buildAllowedOrigins', () => {
  it('always includes localhost:5173', () => {
    const origins = buildAllowedOrigins(undefined);
    expect(origins.has('http://localhost:5173')).toBe(true);
  });

  it('adds a single origin from CLIENT_ORIGIN', () => {
    const origins = buildAllowedOrigins('https://raceops.robfiero.net');
    expect(origins.has('https://raceops.robfiero.net')).toBe(true);
  });

  it('splits a comma-separated CLIENT_ORIGIN into individual entries', () => {
    const origins = buildAllowedOrigins(
      'https://racestats.robfiero.net,https://raceops.robfiero.net',
    );
    expect(origins.has('https://racestats.robfiero.net')).toBe(true);
    expect(origins.has('https://raceops.robfiero.net')).toBe(true);
  });

  it('trims whitespace around each origin', () => {
    const origins = buildAllowedOrigins(
      '  https://racestats.robfiero.net , https://raceops.robfiero.net  ',
    );
    expect(origins.has('https://racestats.robfiero.net')).toBe(true);
    expect(origins.has('https://raceops.robfiero.net')).toBe(true);
  });

  it('ignores empty values produced by trailing commas', () => {
    const origins = buildAllowedOrigins('https://raceops.robfiero.net,');
    expect(origins.size).toBe(2); // localhost + raceops
    expect(origins.has('https://raceops.robfiero.net')).toBe(true);
  });

  it('does not add the raw comma-separated string as a single entry', () => {
    const raw = 'https://racestats.robfiero.net,https://raceops.robfiero.net';
    const origins = buildAllowedOrigins(raw);
    expect(origins.has(raw)).toBe(false);
  });
});

// ─── makeOriginCallback ───────────────────────────────────────────────────────

function allow(
  origins: Set<string>,
  isDev: boolean,
  origin: string | undefined,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    makeOriginCallback(origins, isDev)(origin, (err, ok) => {
      if (err) reject(err);
      else resolve(ok ?? false);
    });
  });
}

function deny(
  origins: Set<string>,
  isDev: boolean,
  origin: string,
): Promise<Error> {
  return new Promise((resolve, reject) => {
    makeOriginCallback(origins, isDev)(origin, (err) => {
      if (err) resolve(err);
      else reject(new Error('Expected callback to be called with an error'));
    });
  });
}

describe('makeOriginCallback — production mode', () => {
  const origins = buildAllowedOrigins(
    'https://racestats.robfiero.net,https://raceops.robfiero.net',
  );
  const isDev = false;

  it('allows https://raceops.robfiero.net', async () => {
    expect(await allow(origins, isDev, 'https://raceops.robfiero.net')).toBe(true);
  });

  it('allows https://racestats.robfiero.net', async () => {
    expect(await allow(origins, isDev, 'https://racestats.robfiero.net')).toBe(true);
  });

  it('allows requests with no Origin header (same-origin / non-browser)', async () => {
    expect(await allow(origins, isDev, undefined)).toBe(true);
  });

  it('rejects an unlisted origin', async () => {
    const err = await deny(origins, isDev, 'https://evil.example.com');
    expect(err.message).toMatch(/CORS/);
  });

  it('rejects the raw comma-separated string as an origin', async () => {
    const raw = 'https://racestats.robfiero.net,https://raceops.robfiero.net';
    const err = await deny(origins, isDev, raw);
    expect(err.message).toMatch(/CORS/);
  });

  it('rejects localhost origins in production mode', async () => {
    const err = await deny(origins, isDev, 'http://localhost:3000');
    expect(err.message).toMatch(/CORS/);
  });
});

describe('makeOriginCallback — development mode', () => {
  const origins = buildAllowedOrigins(undefined); // no CLIENT_ORIGIN
  const isDev = true;

  it('allows http://localhost:5173 (in Set)', async () => {
    expect(await allow(origins, isDev, 'http://localhost:5173')).toBe(true);
  });

  it('allows any localhost port via regex fallback', async () => {
    expect(await allow(origins, isDev, 'http://localhost:5174')).toBe(true);
    expect(await allow(origins, isDev, 'http://127.0.0.1:3001')).toBe(true);
  });

  it('rejects non-localhost origins in dev mode', async () => {
    const err = await deny(origins, isDev, 'https://evil.example.com');
    expect(err.message).toMatch(/CORS/);
  });
});
