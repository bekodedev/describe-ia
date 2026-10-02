import express from 'express';
import type pg from 'pg';
import { generateDescriptions } from './generation/service.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { demoUser } from './middleware/demo-user.js';
import { createRateLimit, type RateLimitOptions } from './middleware/rate-limit.js';
import { requestId } from './middleware/request-id.js';
import { createDescriptionsRouter } from './routes/descriptions.js';
import { createGenerationsRouter, type GenerateFn } from './routes/generations.js';
import { createHealthRouter } from './routes/health.js';
import { createProductsRouter } from './routes/products.js';

export interface AppOptions {
  generate?: GenerateFn; // replaced in tests to stub the LLM
  rateLimit?: RateLimitOptions;
}

export function createApp(pool: pg.Pool, options: AppOptions = {}): express.Express {
  const generate = options.generate ?? ((input) => generateDescriptions(pool, input));
  const limiter = createRateLimit(options.rateLimit ?? { max: 10, windowMs: 60_000 });

  const app = express();
  app.use(requestId);
  app.use(express.json({ limit: '10kb' }));
  app.use(demoUser);

  app.use(createHealthRouter(pool));
  app.use('/api', createGenerationsRouter(generate, limiter));
  app.use('/api', createProductsRouter(pool));
  app.use('/api', createDescriptionsRouter(pool));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
