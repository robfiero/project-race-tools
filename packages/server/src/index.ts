import express from 'express';
import cors from 'cors';
import uploadRouter from './routes/upload.js';
import statsRouter from './routes/stats.js';
import compareRouter from './routes/compare.js';
import { loadZipCentroids } from './geo/zipLoader.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

async function main() {
  await loadZipCentroids();

  const app = express();
  const allowedOrigins = new Set<string>(['http://localhost:5173']);
  if (process.env.CLIENT_ORIGIN) {
    allowedOrigins.add(process.env.CLIENT_ORIGIN);
  }

  // Temporary broader CORS handling for deployment diagnosis.
  const corsOptions: cors.CorsOptions = {
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
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

  app.listen(PORT, () => {
    console.info(`[server] RaceStats API listening on http://localhost:${PORT}`);
  });
}

main().catch(err => {
  console.error('[server] fatal startup error', err);
  process.exit(1);
});
