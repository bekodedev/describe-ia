import { Router } from 'express';
import { z } from 'zod';
import { monthlyUsage } from '../db/llm-calls.js';
import type { Db } from '../db/pool.js';

const query = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use the format YYYY-MM')
    .optional(),
});

const currentMonth = () => new Date().toISOString().slice(0, 7); // UTC, like the SQL

export function createUsageRouter(db: Db): Router {
  const router = Router();

  // What the demo user's AI calls cost this month (or the month in ?month=YYYY-MM).
  // Billing will read this; it is not exposed to anyone but the user.
  router.get('/usage', async (req, res) => {
    const month = query.parse(req.query).month ?? currentMonth();
    res.json({ month, ...(await monthlyUsage(db, req.user.id, month)) });
  });

  return router;
}
