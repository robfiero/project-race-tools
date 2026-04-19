import * as memory from './inMemoryStore.js';
import * as s3 from './s3Store.js';

const backend = process.env.SESSION_BUCKET ? s3 : memory;

export const saveResultsSession   = backend.saveResultsSession;
export const getResultsSession    = backend.getResultsSession;
export const deleteResultsSession = backend.deleteResultsSession;
