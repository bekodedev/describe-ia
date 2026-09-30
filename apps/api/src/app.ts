import express from 'express';
import { createHealthRouter, type Queryable } from './routes/health.js';

export function createApp(db: Queryable): express.Express {
  const app = express();
  app.use(createHealthRouter(db));
  return app;
}
