import express from 'express';
import cors from 'cors';
import uploadRouter from './routes/upload.js';
import statsRouter from './routes/stats.js';
import compareRouter from './routes/compare.js';
import sampleRouter from './routes/sample.js';
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

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'racestats-backend',
      version: '1.0.0',
      uploadRouteMounted: true,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/debug/whoami', (_req, res) => {
    res.json({
      service: 'racestats-backend',
      uploadRouteMounted: true,
      clientOriginEnv: process.env.CLIENT_ORIGIN ?? null,
      port: PORT,
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/upload', uploadRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/compare', compareRouter);
  app.use('/api/sample', sampleRouter);

  app.listen(PORT, () => {
    console.info(`[server] RaceStats API listening on http://localhost:${PORT}`);
  });
}

main().catch(err => {
  console.error('[server] fatal startup error', err);
  process.exit(1);
});
