import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import uploadRouter from './routes/upload.js';
import statsRouter from './routes/stats.js';
import compareRouter from './routes/compare.js';
import sampleRouter from './routes/sample.js';
import resultsUploadRouter from './routes/resultsUpload.js';
import resultsStatsRouter from './routes/resultsStats.js';
import resultsCompareRouter from './routes/resultsCompare.js';
import resultsSampleRouter from './routes/resultsSample.js';
import { loadZipCentroids } from './geo/zipLoader.js';
import { buildAllowedOrigins, makeOriginCallback } from './corsOrigins.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

async function main() {
  await loadZipCentroids();

  const app = express();
  const allowedOrigins = buildAllowedOrigins(process.env.CLIENT_ORIGIN);
  const isDev = !process.env.CLIENT_ORIGIN;

  const corsOptions: cors.CorsOptions = {
    origin: makeOriginCallback(allowedOrigins, isDev),
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    optionsSuccessStatus: 204,
  };

  app.use(helmet());
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
  app.use(express.json({ limit: '16kb' }));

  // Tighter limit on upload and sample endpoints that trigger external API calls
  const uploadLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });
  // General read endpoints
  const apiLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 300, standardHeaders: true, legacyHeaders: false });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'racestats-backend',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/upload',          uploadLimiter, uploadRouter);
  app.use('/api/results/upload',  uploadLimiter, resultsUploadRouter);
  app.use('/api/sample',          uploadLimiter, sampleRouter);
  app.use('/api/results/sample',  uploadLimiter, resultsSampleRouter);
  app.use('/api/stats',           apiLimiter,    statsRouter);
  app.use('/api/compare',         apiLimiter,    compareRouter);
  app.use('/api/results/stats',   apiLimiter,    resultsStatsRouter);
  app.use('/api/results/compare', apiLimiter,    resultsCompareRouter);

  app.listen(PORT, () => {
    console.info(`[server] RaceStats API listening on http://localhost:${PORT}`);
  });
}

main().catch(err => {
  console.error('[server] fatal startup error', err);
  process.exit(1);
});
