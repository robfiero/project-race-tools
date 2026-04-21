import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { parseFile, ParseError } from '../parser/fileParser.js';
import { geocodeVenueAddress } from '../geo/geocode.js';
import { saveSession } from '../session/store.js';
import type { SessionData } from '../types.js';

const ACCEPTED_MIMETYPES = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream', // some browsers send this for .csv/.xlsx
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB hard limit at the transport layer
  fileFilter(_req, file, cb) {
    const ext = file.originalname.toLowerCase().split('.').pop() ?? '';
    const extOk = ext === 'csv' || ext === 'xlsx';
    const mimeOk = ACCEPTED_MIMETYPES.has(file.mimetype);
    if (extOk || mimeOk) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel (.xlsx) files are accepted.'));
    }
  },
});

const router = Router();

// POST /api/upload
// Multipart form fields:
//   file         — CSV or Excel file (required)
//   raceName     — display name for the race (optional)
//   venueAddress — plain text address (optional)
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded.' });
    return;
  }

  let participants;
  let adapterName;

  try {
    const result = await parseFile(req.file.buffer, req.file.originalname, req.file.size);
    participants = result.participants;
    adapterName = result.adapterName;
  } catch (err) {
    if (err instanceof ParseError) {
      res.status(422).json({ error: err.message });
    } else {
      console.error('[upload] unexpected parse error', err);
      res.status(500).json({ error: 'An unexpected error occurred while reading the file.' });
    }
    return;
  }

  // Race name for display purposes (optional, defaults to filename without extension)
  const raceName: string =
    (req.body.raceName as string)?.trim() ||
    req.file.originalname.replace(/\.(csv|xlsx)$/i, '');

  // Timezone for interpreting registration timestamps (IANA name, e.g. "America/New_York")
  const timezone: string = (req.body.timezone as string)?.trim() || 'America/New_York';

  // Geocode venue address if provided
  let venueLat: number | null = null;
  let venueLng: number | null = null;
  const venueAddress: string | null = (req.body.venueAddress as string)?.trim() || null;

  if (venueAddress) {
    const geo = await geocodeVenueAddress(venueAddress);
    if (geo) {
      venueLat = geo.lat;
      venueLng = geo.lng;
    }
    // If geocoding fails we still proceed — distance stats will be omitted
  }

  const events = [...new Set(participants.map(p => p.event))].sort();

  const sessionData: SessionData = {
    sessionId: uuidv4(),
    createdAt: new Date(),
    raceName,
    venueAddress,
    venueLat,
    venueLng,
    timezone,
    events,
    participants,
  };

  try {
    await saveSession(sessionData);
  } catch (err) {
    console.error('[upload] failed to save session', err);
    res.status(500).json({ error: 'Failed to store session data.' });
    return;
  }

  res.json({
    sessionId: sessionData.sessionId,
    raceName,
    adapterName,
    participantCount: participants.length,
    events,
    venueGeocoded: venueLat !== null,
    timezone,
  });
});

export default router;
