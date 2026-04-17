import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { parseFile, ParseError } from '../parser/fileParser.js';
import { saveSession } from '../session/store.js';
import { generateCSV, getSampleRaceName, isValidSampleId } from '../sample/generator.js';
import type { SessionData } from '../types.js';

const router = Router();

// POST /api/sample
// Body: { sampleId: string, timezone?: string }
// Generates a synthetic UltraSignup CSV in-memory and processes it through the
// normal parse + session pipeline, returning an UploadResponse.
router.post('/', async (req: Request, res: Response) => {
  const { sampleId, timezone = 'America/New_York' } = req.body as {
    sampleId?: string;
    timezone?: string;
  };

  if (!sampleId || typeof sampleId !== 'string') {
    res.status(400).json({ error: 'sampleId is required.' });
    return;
  }

  if (!isValidSampleId(sampleId)) {
    res.status(404).json({ error: `Unknown sample: ${sampleId}` });
    return;
  }

  let csvContent: string;
  try {
    csvContent = generateCSV(sampleId);
  } catch (err) {
    console.error('[sample] generation error', err);
    res.status(500).json({ error: 'Failed to generate sample data.' });
    return;
  }

  const buffer = Buffer.from(csvContent, 'utf-8');

  let participants;
  let adapterName;
  try {
    const result = parseFile(buffer, `${sampleId}.csv`, buffer.length);
    participants = result.participants;
    adapterName = result.adapterName;
  } catch (err) {
    if (err instanceof ParseError) {
      res.status(422).json({ error: err.message });
    } else {
      console.error('[sample] parse error', err);
      res.status(500).json({ error: 'Failed to process sample data.' });
    }
    return;
  }

  const raceName = getSampleRaceName(sampleId);
  const events = [...new Set(participants.map(p => p.event))].sort();

  const sessionData: SessionData = {
    sessionId: uuidv4(),
    createdAt: new Date(),
    raceName,
    venueAddress: null,
    venueLat: null,
    venueLng: null,
    timezone,
    events,
    participants,
  };

  await saveSession(sessionData);

  res.json({
    sessionId: sessionData.sessionId,
    raceName,
    adapterName,
    participantCount: participants.length,
    events,
    venueGeocoded: false,
    timezone,
  });
});

export default router;
