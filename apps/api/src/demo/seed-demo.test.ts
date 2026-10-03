import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO_USER_ID } from '../config/demo-user.js';
import { listDescriptions } from '../db/descriptions.js';
import { listProducts } from '../db/products.js';
import { createTestSchema } from '../db/test-schema.js';
import { seedDemoUser } from '../db/users.js';
import { DescriptionsSchema } from '../generation/schema.js';
import { detectImageType } from '../images/detect.js';
import { createImageStore } from '../images/storage.js';
import { DEMO_PRODUCTS } from './products.js';
import { DEMO_PHOTOS_DIR, seedDemoProducts } from './seed-demo.js';
import { readFile } from 'node:fs/promises';

const databaseUrl = process.env.DATABASE_URL;

describe('demo data', () => {
  it.each(['en', 'es'] as const)(
    'every %s text respects the limits of the real descriptions',
    (language) => {
      for (const product of DEMO_PRODUCTS) {
        const result = DescriptionsSchema.safeParse(product[language]);
        expect(result.success, `${product.title} (${language})`).toBe(true);
      }
    },
  );

  it('has five products with distinct titles, and the photos it names are real images', async () => {
    expect(DEMO_PRODUCTS).toHaveLength(5);
    expect(new Set(DEMO_PRODUCTS.map((p) => p.title)).size).toBe(5);

    for (const photo of DEMO_PRODUCTS.flatMap((p) => (p.photo ? [p.photo] : []))) {
      const bytes = await readFile(join(DEMO_PHOTOS_DIR, photo));
      expect(detectImageType(bytes)).toBe('image/jpeg');
    }
  });
});

describe.skipIf(!databaseUrl)('seedDemoProducts (Postgres)', () => {
  let pool: pg.Pool;
  let drop: () => Promise<void>;

  beforeAll(async () => {
    ({ pool, drop } = await createTestSchema(databaseUrl!));
    await seedDemoUser(pool);
  });
  afterAll(() => drop());

  it('creates the products with 3 descriptions and the photos, newest first, without calling a model', async () => {
    const store = createImageStore(await mkdtemp(join(tmpdir(), 'demo-uploads-')));

    const result = await seedDemoProducts(pool, { userId: DEMO_USER_ID, language: 'es', store });

    expect(result).toEqual({ created: 5, skipped: 0 });
    const { products } = await listProducts(pool, DEMO_USER_ID, 50);
    expect(products.map((p) => p.title)).toEqual(DEMO_PRODUCTS.map((p) => p.title));
    expect(products.filter((p) => p.image_path)).toHaveLength(2);
    expect(await readdir(store.dir)).toHaveLength(2);

    const first = await listDescriptions(pool, products[0]!.id);
    expect(first.map((d) => d.variant)).toEqual(['short', 'medium', 'seo']);
    expect(first[0]?.content).toBe(DEMO_PRODUCTS[0]!.es.short); // OUTPUT_LANGUAGE=es -> Spanish

    const calls = await pool.query('SELECT count(*)::int AS n FROM llm_calls');
    expect(calls.rows[0].n).toBe(0);
  });

  it('can run twice: the second run creates nothing and stores no more photos', async () => {
    const store = createImageStore(await mkdtemp(join(tmpdir(), 'demo-uploads-')));

    const again = await seedDemoProducts(pool, { userId: DEMO_USER_ID, language: 'en', store });

    expect(again).toEqual({ created: 0, skipped: 5 });
    expect(await readdir(store.dir)).toEqual([]);
    expect((await listProducts(pool, DEMO_USER_ID, 50)).products).toHaveLength(5);
  });
});
