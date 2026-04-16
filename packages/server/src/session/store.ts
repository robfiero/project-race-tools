// Selects the session store backend at startup:
//   SESSION_BUCKET set   →  S3-backed store (production / App Runner)
//   SESSION_BUCKET unset →  in-memory store (local dev)
//
// Both backends expose the same async interface so callers need no
// awareness of which is active.

import * as memory from './inMemoryStore.js';
import * as s3 from './s3Store.js';

const backend = process.env.SESSION_BUCKET ? s3 : memory;

export const saveSession = backend.saveSession;
export const getSession  = backend.getSession;
export const deleteSession = backend.deleteSession;
