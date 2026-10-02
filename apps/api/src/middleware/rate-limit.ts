import type { RequestHandler } from 'express';
import { RateLimitedError } from '../http-errors.js';

export interface RateLimitOptions {
  max: number;
  windowMs: number;
  now?: () => number; // replaceable in tests
}

// Fixed-window limit per user, kept in this process's memory. It protects the LLM API key (and the
// bill) from a runaway client. The counters are NOT shared: if the API ever runs on more than one
// instance, replace this with a shared store (e.g. Redis) or the real limit becomes max x instances.
// Until real authentication exists every request is the demo user, so the limit is global.
export function createRateLimit({
  max,
  windowMs,
  now = Date.now,
}: RateLimitOptions): RequestHandler {
  const windows = new Map<string, { count: number; resetAt: number }>();

  return (req, _res, next) => {
    const time = now();
    const current = windows.get(req.user.id);

    if (!current || current.resetAt <= time) {
      windows.set(req.user.id, { count: 1, resetAt: time + windowMs });
      return next();
    }
    if (current.count >= max)
      throw new RateLimitedError(Math.ceil((current.resetAt - time) / 1000));
    current.count++;
    next();
  };
}
