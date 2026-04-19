import { Router, type Request, type Response } from 'express';
import { getResultsSession } from '../session/resultsStore.js';
import { computeResultsStats } from '../stats/results.js';

const router = Router();

// GET /api/results/stats/:sessionId
router.get('/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = await getResultsSession(sessionId);

  if (!session) {
    res.status(404).json({ error: 'Session not found or expired. Please re-upload your file.' });
    return;
  }

  const stats = computeResultsStats(session.results);

  res.json({ sessionId, raceName: session.raceName, stats, weatherData: session.weatherData ?? null });
});

export default router;
