import express from 'express';
import cors from 'cors';
import uploadRouter from './routes/upload.js';
import statsRouter from './routes/stats.js';
import { loadZipCentroids } from './geo/zipLoader.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

async function main() {
  await loadZipCentroids();

  const app = express();

  app.use(cors({
    origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
    methods: ['GET', 'POST'],
  }));

  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/upload', uploadRouter);
  app.use('/api/stats', statsRouter);

  app.listen(PORT, () => {
    console.info(`[server] RaceStats API listening on http://localhost:${PORT}`);
  });
}

main().catch(err => {
  console.error('[server] fatal startup error', err);
  process.exit(1);
});
