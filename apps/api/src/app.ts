import express from 'express';
import { demoUser } from './middleware/demo-user.js';
import { createHealthRouter, type Queryable } from './routes/health.js';

export function createApp(db: Queryable): express.Express {
  const app = express();
  app.use(demoUser);
  app.use(createHealthRouter(db));
  return app;
}
