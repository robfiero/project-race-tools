import type { SessionData } from '../types.js';

// In-memory session store used in local development.
// Sessions auto-expire after TTL_MS to keep memory bounded.

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface StoredSession {
  data: SessionData;
  expiresAt: number;
}

const store = new Map<string, StoredSession>();

// Purge expired sessions every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of store) {
    if (session.expiresAt <= now) store.delete(id);
  }
}, 30 * 60 * 1000).unref();

export async function saveSession(data: SessionData): Promise<void> {
  store.set(data.sessionId, {
    data,
    expiresAt: Date.now() + TTL_MS,
  });
}

export async function getSession(sessionId: string): Promise<SessionData | null> {
  const entry = store.get(sessionId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(sessionId);
    return null;
  }
  return entry.data;
}

export async function deleteSession(sessionId: string): Promise<void> {
  store.delete(sessionId);
}
