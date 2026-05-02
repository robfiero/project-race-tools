import { Router, type Request, type Response } from 'express';
import { getSession } from '../session/store.js';
import { computeComparisonStats, MAX_COMPARISON_INTERVALS } from '../stats/comparison.js';

const router = Router();

interface SessionEntry {
  sessionId?: unknown;
  label?: unknown;
}

interface CompareBody {
  sessions?: unknown;
  selectedEvent?: unknown;
}

// POST /api/compare
// Body: { sessions: Array<{ sessionId: string, label: string }> }
// Returns ComparisonStats with per-interval full stats and derived trend series.
router.post('/', async (req: Request, res: Response) => {
  const body = req.body as CompareBody;

  if (!Array.isArray(body.sessions) || body.sessions.length < 2) {
    res.status(400).json({ error: 'Provide between 2 and 5 session entries to compare.' });
    return;
  }

  if (body.sessions.length > MAX_COMPARISON_INTERVALS) {
    res.status(400).json({ error: `Maximum ${MAX_COMPARISON_INTERVALS} intervals allowed.` });
    return;
  }

  const entries = body.sessions as SessionEntry[];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (typeof entry.sessionId !== 'string' || !entry.sessionId.trim()) {
      res.status(400).json({ error: `Entry ${i + 1} is missing a sessionId.` });
      return;
    }
    if (typeof entry.label !== 'string' || !entry.label.trim()) {
      res.status(400).json({ error: `Entry ${i + 1} is missing a label.` });
      return;
    }
  }

  const sessions = await Promise.all(
    entries.map(e => getSession((e.sessionId as string).trim()))
  );

  const missingIdx = sessions.findIndex(s => s === null);
  if (missingIdx !== -1) {
    const lbl = (entries[missingIdx].label as string).trim();
    res.status(404).json({
      error: `Session "${lbl}" not found or expired. Please re-upload that file.`,
    });
    return;
  }

  const labels = entries.map(e => (e.label as string).trim());
  const selectedEvent = typeof body.selectedEvent === 'string' && body.selectedEvent.trim()
    ? body.selectedEvent.trim()
    : null;

  const norm = (s: string) => s.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
  const filteredSessions = (sessions as NonNullable<typeof sessions[number]>[]).map(s =>
    selectedEvent
      ? { ...s, participants: s.participants.filter(p => norm(p.event) === norm(selectedEvent)) }
      : s
  );

  const result = computeComparisonStats(filteredSessions, labels);

  res.json(result);
});

export default router;
