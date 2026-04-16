import { Router, type Request, type Response } from 'express';
import { getSession } from '../session/store.js';
import { computeStats, filterByEvents } from '../stats/index.js';

const router = Router();

// GET /api/stats/:sessionId?events=EventName1,EventName2
// events query param is optional; omitting it returns stats for all events.
router.get('/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = await getSession(sessionId);

  if (!session) {
    res.status(404).json({ error: 'Session not found or expired. Please re-upload your file.' });
    return;
  }

  // Parse optional event filter from query string
  const eventsParam = req.query.events as string | undefined;
  const selectedEvents = eventsParam
    ? eventsParam.split(',').map(e => e.trim()).filter(Boolean)
    : [];

  const participants = filterByEvents(session.participants, selectedEvents);

  if (participants.length === 0) {
    res.status(400).json({ error: 'No participants match the selected event filter.' });
    return;
  }

  const stats = computeStats(
    participants,
    session.venueLat,
    session.venueLng,
    session.venueAddress,
    session.timezone,
  );

  res.json({
    sessionId,
    events: session.events,
    selectedEvents: selectedEvents.length > 0 ? selectedEvents : session.events,
    stats,
  });
});

export default router;
