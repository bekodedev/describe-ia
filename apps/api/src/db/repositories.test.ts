import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO_USER_ID } from '../config/demo-user.js';
import { insertDescription, listDescriptions, updateEditedContent } from './descriptions.js';
import { insertLlmCall } from './llm-calls.js';
import { createProduct, findProduct, listProducts } from './products.js';
import { createTestSchema } from './test-schema.js';
import { seedDemoUser } from './users.js';

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)('repositories (Postgres)', () => {
  let pool: pg.Pool;
  let drop: () => Promise<void>;

  beforeAll(async () => {
    ({ pool, drop } = await createTestSchema(databaseUrl!));
    await seedDemoUser(pool);
  });

  afterAll(() => drop());

  it('seeding twice keeps a single demo user', async () => {
    await seedDemoUser(pool);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM users');
    expect(rows[0].n).toBe(1);
  });

  it('creates a product, inserts 3 descriptions and reads them back', async () => {
    const product = await createProduct(pool, {
      userId: DEMO_USER_ID,
      title: 'Steel water bottle',
      category: 'Sports',
    });
    await insertDescription(pool, product.id, 'seo', 'seo text');
    await insertDescription(pool, product.id, 'short', 'short text');
    await insertDescription(pool, product.id, 'medium', 'medium text');

    const descriptions = await listDescriptions(pool, product.id);
    expect(descriptions.map((d) => d.variant)).toEqual(['short', 'medium', 'seo']);
    expect(descriptions.map((d) => d.content)).toEqual(['short text', 'medium text', 'seo text']);
    expect(await findProduct(pool, product.id, DEMO_USER_ID)).toMatchObject({
      title: product.title,
    });
  });

  it('keeps the original content when a description is edited', async () => {
    const product = await createProduct(pool, {
      userId: DEMO_USER_ID,
      title: 'Mug',
      category: 'Home',
    });
    const original = await insertDescription(pool, product.id, 'short', 'original');
    const edited = await updateEditedContent(pool, original.id, DEMO_USER_ID, 'edited');
    expect(edited).toMatchObject({ content: 'original', edited_content: 'edited' });
  });

  it('lists products newest first', async () => {
    const first = await createProduct(pool, { userId: DEMO_USER_ID, title: 'A', category: 'X' });
    const second = await createProduct(pool, { userId: DEMO_USER_ID, title: 'B', category: 'X' });
    const { products } = await listProducts(pool, DEMO_USER_ID, 50);
    const ids = products.map((p) => p.id);
    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
  });

  it('records an llm call, including failures', async () => {
    const call = await insertLlmCall(pool, {
      userId: DEMO_USER_ID,
      model: 'test-model',
      promptVersion: 'description.v1',
      latencyMs: 120,
      status: 'error',
      errorMessage: 'rate limited',
      rawResponse: { type: 'error' },
    });
    expect(call).toMatchObject({ status: 'error', input_tokens: 0, cost_usd: null });
    expect(call.raw_response).toEqual({ type: 'error' });
  });

  it('rejects an unknown variant at the database level', async () => {
    const product = await createProduct(pool, { userId: DEMO_USER_ID, title: 'C', category: 'X' });
    await expect(
      pool.query(
        "INSERT INTO descriptions (product_id, variant, content) VALUES ($1, 'long', 'x')",
        [product.id],
      ),
    ).rejects.toThrow(/invalid input value for enum/);
  });
});
