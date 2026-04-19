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

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

async function main() {
  await loadZipCentroids();

  const app = express();
  const allowedOrigins = new Set<string>(['http://localhost:5173']);
  if (process.env.CLIENT_ORIGIN) {
    allowedOrigins.add(process.env.CLIENT_ORIGIN);
  }

  const isDev = !process.env.CLIENT_ORIGIN;
  const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

  const corsOptions: cors.CorsOptions = {
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      // In development (no CLIENT_ORIGIN set) allow any localhost port so that
      // JSON preflights work regardless of the Vite dev-server port in use.
      if (isDev && LOCALHOST_RE.test(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
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
