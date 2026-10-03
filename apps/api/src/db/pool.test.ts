import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type pg from 'pg';
import { DEMO_USER_ID } from '../config/demo-user.js';
import { createPool, withTransaction } from './pool.js';
import { createProduct, listProducts } from './products.js';
import { createTestSchema } from './test-schema.js';
import { seedDemoUser } from './users.js';

const databaseUrl = process.env.DATABASE_URL;

describe('createPool', () => {
  it('logs an error of an idle client instead of crashing the process', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const pool = createPool('postgres://nobody@localhost:1/none');

    expect(() => pool.emit('error', new Error('terminating connection'))).not.toThrow();
    expect(log).toHaveBeenCalledWith('Idle database client error: terminating connection');

    log.mockRestore();
    await pool.end();
  });
});

describe.skipIf(!databaseUrl)('withTransaction (Postgres)', () => {
  let pool: pg.Pool;
  let drop: () => Promise<void>;

  beforeAll(async () => {
    ({ pool, drop } = await createTestSchema(databaseUrl!));
    await seedDemoUser(pool);
  });
  afterAll(() => drop());

  const titles = async () =>
    (await listProducts(pool, DEMO_USER_ID, 50)).products.map((p) => p.title);
  const input = (title: string) => ({ userId: DEMO_USER_ID, title, category: 'Other' });

  it('commits what the work did', async () => {
    await withTransaction(pool, (tx) => createProduct(tx, input('kept')));
    expect(await titles()).toContain('kept');
  });

  it('rolls everything back, and rethrows, when the work fails halfway', async () => {
    await expect(
      withTransaction(pool, async (tx) => {
        await createProduct(tx, input('lost'));
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await titles()).not.toContain('lost');
  });
});
