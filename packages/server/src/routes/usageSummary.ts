import { Router, type Request, type Response } from 'express';
import { getReportRunCounts } from '../usage/reportUsage.js';

const router = Router();

// GET /api/usage-summary
router.get('/', (_req: Request, res: Response) => {
  res.json({ reportRuns: getReportRunCounts() });
});

export default router;
