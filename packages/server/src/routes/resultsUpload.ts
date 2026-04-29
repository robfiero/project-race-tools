import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { parseResultsFile } from '../parser/resultsParser.js';
import { ParseError } from '../parser/fileParser.js';
import { saveResultsSession } from '../session/resultsStore.js';
import { geocodeVenueAddress } from '../geo/geocode.js';
import { fetchRaceWeather } from '../weather/openMeteo.js';
import type { ResultsSessionData } from '../types.js';

const ACCEPTED_MIMETYPES = new Set([
  'text/csv',
  'application/csv',
  'application/octet-stream',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ext = file.originalname.toLowerCase().split('.').pop() ?? '';
    const extOk = ext === 'csv';
    const mimeOk = ACCEPTED_MIMETYPES.has(file.mimetype);
    if (extOk || mimeOk) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are accepted. To use an Excel export, open it in Excel or Google Sheets and save as CSV.'));
    }
  },
});

// Re-export ParseError so the import in resultsParser.ts resolves cleanly
export { ParseError };

// datetime-local values from <input type="datetime-local"> are "YYYY-MM-DDTHH:MM"
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const router = Router();

// POST /api/results/upload
// Multipart form fields:
//   file         — CSV or Excel results file (required)
//   raceName     — display name for the race (optional)
//   venueAddress — street address of the venue (optional, needed for weather)
//   raceStart    — local datetime-local string "YYYY-MM-DDTHH:MM" (optional)
//   raceEnd      — local datetime-local string "YYYY-MM-DDTHH:MM" (optional)
router.post('/', (req: Request, res: Response, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      res.status(422).json({ error: err.message });
      return;
    }
    next();
  });
});

router.post('/', async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded.' });
    return;
  }

  let results;
  let adapterName;

  try {
    const parsed = await parseResultsFile(req.file.buffer, req.file.originalname, req.file.size);
    results = parsed.results;
    adapterName = parsed.adapterName;
  } catch (err) {
    if (err instanceof ParseError) {
      res.status(422).json({ error: err.message });
    } else {
      console.error('[results/upload] unexpected parse error', err);
      res.status(500).json({ error: 'An unexpected error occurred while reading the file.' });
    }
    return;
  }

  const raceName: string =
    (req.body.raceName as string)?.trim() ||
    req.file.originalname.replace(/\.csv$/i, '');

  const venueAddress = (req.body.venueAddress as string | undefined)?.trim() ?? '';

  // Validate datetime format before passing to weather API
  const rawStart = (req.body.raceStart as string | undefined)?.trim() ?? '';
  const rawEnd   = (req.body.raceEnd   as string | undefined)?.trim() ?? '';
  const raceStart = ISO_DATETIME_RE.test(rawStart) ? rawStart : '';
  const raceEnd   = ISO_DATETIME_RE.test(rawEnd)   ? rawEnd   : '';

  const sessionData: ResultsSessionData = {
    sessionId: uuidv4(),
    createdAt: new Date(),
    raceName,
    results,
  };

  // Fetch weather only when all three optional fields are provided and valid
  if (venueAddress && raceStart && raceEnd) {
    const geo = await geocodeVenueAddress(venueAddress);
    if (geo) {
      const weather = await fetchRaceWeather(geo.lat, geo.lng, venueAddress, raceStart, raceEnd);
      if (weather) {
        sessionData.weatherData = weather;
      }
    }
  }

  try {
    await saveResultsSession(sessionData);
  } catch (err) {
    console.error('[results/upload] failed to save session', err);
    res.status(500).json({ error: 'Failed to store session data.' });
    return;
  }

  res.json({
    sessionId: sessionData.sessionId,
    raceName,
    adapterName,
    resultCount: results.length,
    hasWeather: !!sessionData.weatherData,
  });
});

export default router;
