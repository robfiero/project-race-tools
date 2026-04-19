import type { SessionData, ResultsSessionData } from '../types.js';

// In-memory session store used in local development.
// Sessions auto-expire after TTL_MS to keep memory bounded.

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface StoredSession<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, StoredSession<SessionData>>();
const resultsStore = new Map<string, StoredSession<ResultsSessionData>>();

// Purge expired sessions every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of store) {
    if (s.expiresAt <= now) store.delete(id);
  }
  for (const [id, s] of resultsStore) {
    if (s.expiresAt <= now) resultsStore.delete(id);
  }
}, 30 * 60 * 1000).unref();

export async function saveSession(data: SessionData): Promise<void> {
  store.set(data.sessionId, { data, expiresAt: Date.now() + TTL_MS });
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

export async function saveResultsSession(data: ResultsSessionData): Promise<void> {
  resultsStore.set(data.sessionId, { data, expiresAt: Date.now() + TTL_MS });
}

export async function getResultsSession(sessionId: string): Promise<ResultsSessionData | null> {
  const entry = resultsStore.get(sessionId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    resultsStore.delete(sessionId);
    return null;
  }
  return entry.data;
}

export async function deleteResultsSession(sessionId: string): Promise<void> {
  resultsStore.delete(sessionId);
}
