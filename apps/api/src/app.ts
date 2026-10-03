import express from 'express';
import type pg from 'pg';
import { IMAGE_MAX_BYTES } from '@describe-ia/shared';
import { defaultDeps, generateDescriptions } from './generation/service.js';
import { createImageStore, type ImageStore } from './images/storage.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { demoUser } from './middleware/demo-user.js';
import { createRateLimit, type RateLimitOptions } from './middleware/rate-limit.js';
import { requestId } from './middleware/request-id.js';
import { uploadImage } from './middleware/upload.js';
import { createDescriptionsRouter } from './routes/descriptions.js';
import { createGenerationsRouter, type GenerateFn } from './routes/generations.js';
import { createHealthRouter } from './routes/health.js';
import { createProductsRouter } from './routes/products.js';
import { createUsageRouter } from './routes/usage.js';

export interface AppOptions {
  generate?: GenerateFn; // replaced in tests to stub the LLM
  rateLimit?: RateLimitOptions;
  imageStore?: ImageStore; // where photos are saved and served from
  maxImageBytes?: number;
}

export function createApp(pool: pg.Pool, options: AppOptions = {}): express.Express {
  const imageStore = options.imageStore ?? createImageStore('uploads');
  const generate =
    options.generate ??
    ((input) => generateDescriptions(pool, input, { ...defaultDeps(), imageStore }));
  const limiter = createRateLimit(options.rateLimit ?? { max: 10, windowMs: 60_000 });

  const app = express();
  app.use(requestId);
  app.use(express.json({ limit: '10kb' }));
  app.use(demoUser);

  app.use(createHealthRouter(pool));
  const upload = uploadImage(options.maxImageBytes ?? IMAGE_MAX_BYTES);
  app.use('/api', createGenerationsRouter(generate, limiter, upload));
  app.use('/api', createProductsRouter(pool, imageStore));
  app.use('/api', createDescriptionsRouter(pool));
  app.use('/api', createUsageRouter(pool));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
