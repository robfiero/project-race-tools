import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { parseResultsFile } from '../parser/resultsParser.js';
import { ParseError } from '../parser/fileParser.js';
import { saveResultsSession } from '../session/resultsStore.js';
import {
  generateResultsCSV,
  generateResultsWeather,
  getSampleResultsRaceName,
  isValidResultsSampleId,
} from '../sample/resultsGenerator.js';
import type { ResultsSessionData } from '../types.js';

const router = Router();

// POST /api/results/sample
// Body: { sampleId: string }
router.post('/', async (req: Request, res: Response) => {
  const { sampleId } = req.body as { sampleId?: string };

  if (!sampleId || typeof sampleId !== 'string') {
    res.status(400).json({ error: 'sampleId is required.' });
    return;
  }

  if (!isValidResultsSampleId(sampleId)) {
    res.status(404).json({ error: `Unknown results sample: ${sampleId}` });
    return;
  }

  let csvContent: string;
  try {
    csvContent = generateResultsCSV(sampleId);
  } catch (err) {
    console.error('[results/sample] generation error', err);
    res.status(500).json({ error: 'Failed to generate sample data.' });
    return;
  }

  const buffer = Buffer.from(csvContent, 'utf-8');

  let results;
  let adapterName;
  try {
    const parsed = await parseResultsFile(buffer, `${sampleId}.csv`, buffer.length);
    results = parsed.results;
    adapterName = parsed.adapterName;
  } catch (err) {
    if (err instanceof ParseError) {
      res.status(422).json({ error: err.message });
    } else {
      console.error('[results/sample] parse error', err);
      res.status(500).json({ error: 'Failed to process sample data.' });
    }
    return;
  }

  const raceName = getSampleResultsRaceName(sampleId);
  const weatherData = generateResultsWeather(sampleId);

  const sessionData: ResultsSessionData = {
    sessionId: uuidv4(),
    createdAt: new Date(),
    raceName,
    results,
    ...(weatherData ? { weatherData } : {}),
  };

  await saveResultsSession(sessionData);

  res.json({
    sessionId: sessionData.sessionId,
    raceName,
    adapterName,
    resultCount: results.length,
    hasWeather: !!weatherData,
  });
});

export default router;
