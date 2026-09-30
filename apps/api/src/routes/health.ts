import { Router } from 'express';

export interface Queryable {
  query(sql: string): Promise<unknown>;
}

export function createHealthRouter(db: Queryable): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    const dbStatus = await db.query('SELECT 1').then(
      () => 'ok' as const,
      () => 'down' as const,
    );
    res.json({ status: 'ok', db: dbStatus });
  });

  return router;
}
