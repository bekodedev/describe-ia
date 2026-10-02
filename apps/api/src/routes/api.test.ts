import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { DEMO_USER_ID } from '../config/demo-user.js';
import { createTestSchema } from '../db/test-schema.js';
import { seedDemoUser } from '../db/users.js';
import type { GenerationResponse } from '@describe-ia/shared';
import type { LlmResponse } from '../llm/client.js';
import { generateDescriptions } from '../generation/service.js';

const databaseUrl = process.env.DATABASE_URL;

const validAnswer = JSON.stringify({
  short: 'A stainless steel bottle for every day.',
  medium: 'This stainless steel bottle holds 750 ml and is made for sport and daily use. '.repeat(
    2,
  ),
  seo: 'Stainless steel water bottle, 750 ml, for sports, the gym, hiking and the office. '.repeat(
    3,
  ),
});

// Real Postgres (throwaway schema) and the real service; only the LLM call is stubbed.
describe.skipIf(!databaseUrl)('REST API (Postgres, stubbed LLM)', () => {
  let pool: pg.Pool;
  let drop: () => Promise<void>;
  let answers: string[] = []; // what the stubbed model says next; the last one repeats
  let app: ReturnType<typeof createApp>;

  const complete = async (): Promise<LlmResponse> => ({
    content: [{ type: 'text', text: answers.length > 1 ? answers.shift()! : answers[0]! }],
    usage: { inputTokens: 100, outputTokens: 80 },
    model: 'claude-haiku-4-5-20251001',
    latencyMs: 5,
    raw: {},
  });

  beforeAll(async () => {
    ({ pool, drop } = await createTestSchema(databaseUrl!));
    await seedDemoUser(pool);
    app = createApp(pool, {
      generate: (input) =>
        generateDescriptions(pool, input, { complete, model: 'test-model', language: 'es' }),
      rateLimit: { max: 1000, windowMs: 60_000 },
    });
  });
  afterAll(() => drop());

  const generate = async (title: string) => {
    answers = [validAnswer];
    const res = await request(app).post('/api/generations').send({ title, category: 'Sports' });
    expect(res.status).toBe(201);
    return res.body as GenerationResponse;
  };
  const count = async (table: string) =>
    (await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n as number;

  async function otherUsersProduct() {
    const user = await pool.query(
      "INSERT INTO users (email, name) VALUES ($1, 'Other') RETURNING id",
      [`other-${randomUUID()}@test.local`],
    );
    const product = await pool.query(
      "INSERT INTO products (user_id, title, category) VALUES ($1, 'Secret', 'Other') RETURNING id",
      [user.rows[0].id],
    );
    const description = await pool.query(
      "INSERT INTO descriptions (product_id, variant, content) VALUES ($1, 'short', 'secret') RETURNING id",
      [product.rows[0].id],
    );
    return { productId: product.rows[0].id, descriptionId: description.rows[0].id };
  }

  it('POST /api/generations -> 201 with the product and its 3 descriptions', async () => {
    const { product, descriptions } = await generate('Stainless steel bottle');

    expect(product).toMatchObject({
      title: 'Stainless steel bottle',
      category: 'Sports',
      imagePath: null,
    });
    expect(new Date(product.createdAt).toISOString()).toBe(product.createdAt);
    expect(descriptions.map((d) => d.variant)).toEqual(['short', 'medium', 'seo']);
    expect(descriptions[0]).toMatchObject({ editedContent: null });
    expect(JSON.stringify({ product, descriptions })).not.toMatch(/user_id|userId/);
  });

  it('GET /api/products pages newest first and never repeats or skips a product', async () => {
    const created: string[] = [];
    for (let i = 1; i <= 5; i++) created.push((await generate(`Paged product ${i}`)).product.id);

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const res: request.Response = await request(app)
        .get('/api/products')
        .query({ limit: 2, ...(cursor ? { cursor } : {}) });
      expect(res.status).toBe(200);
      expect(res.body.products.length).toBeLessThanOrEqual(2);
      seen.push(...res.body.products.map((p: { id: string }) => p.id));
      cursor = res.body.nextCursor;
    } while (cursor);

    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.filter((id) => created.includes(id))).toEqual([...created].reverse());
  });

  it('keyset pagination survives identical and microsecond-apart timestamps', async () => {
    const stamps = [
      '2020-01-01 00:00:00.123456+00',
      '2020-01-01 00:00:00.123456+00',
      '2020-01-01 00:00:00.123457+00',
      '2020-01-01 00:00:00.123457+00',
    ];
    const ids: string[] = [];
    for (const stamp of stamps) {
      const { rows } = await pool.query(
        "INSERT INTO products (user_id, title, category, created_at) VALUES ($1, 'Tie', 'Other', $2) RETURNING id",
        [DEMO_USER_ID, stamp],
      );
      ids.push(rows[0].id);
    }
    const expected = (
      await pool.query(
        'SELECT id FROM products WHERE id = ANY($1) ORDER BY created_at DESC, id DESC',
        [ids],
      )
    ).rows.map((r) => r.id);

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const res: request.Response = await request(app)
        .get('/api/products')
        .query({ limit: 1, ...(cursor ? { cursor } : {}) });
      seen.push(...res.body.products.map((p: { id: string }) => p.id));
      cursor = res.body.nextCursor;
    } while (cursor);

    expect(seen.filter((id) => ids.includes(id))).toEqual(expected);
  });

  it('GET /api/products does not list other users’ products', async () => {
    const { productId } = await otherUsersProduct();
    const res = await request(app).get('/api/products').query({ limit: 100 });
    expect(res.body.products.map((p: { id: string }) => p.id)).not.toContain(productId);
  });

  it('GET /api/products/:id returns the product with its descriptions; 404 if it is not the user’s', async () => {
    const { product } = await generate('Detail product');
    const ok = await request(app).get(`/api/products/${product.id}`);
    expect(ok.status).toBe(200);
    expect(ok.body.product.id).toBe(product.id);
    expect(ok.body.descriptions).toHaveLength(3);

    const missing = await request(app).get(`/api/products/${randomUUID()}`);
    expect(missing.status).toBe(404);
    const foreign = await request(app).get(
      `/api/products/${(await otherUsersProduct()).productId}`,
    );
    expect(foreign.status).toBe(404);
    expect(foreign.body.error.code).toBe('not_found');
  });

  it('PATCH /api/descriptions/:id saves the edit and keeps the original', async () => {
    const { product, descriptions } = await generate('Editable product');
    const id = descriptions[1]!.id;

    const res = await request(app)
      .patch(`/api/descriptions/${id}`)
      .send({ editedContent: '  My edit  ' });
    expect(res.status).toBe(200);
    expect(res.body.description).toMatchObject({ id, editedContent: 'My edit' });
    expect(res.body.description.content).toContain('stainless steel bottle holds 750 ml');

    const again = await request(app).get(`/api/products/${product.id}`);
    expect(again.body.descriptions[1]).toMatchObject({ editedContent: 'My edit' });
  });

  it('PATCH validates the body and refuses other users’ descriptions', async () => {
    const { descriptionId } = await otherUsersProduct();
    const foreign = await request(app)
      .patch(`/api/descriptions/${descriptionId}`)
      .send({ editedContent: 'hacked' });
    expect(foreign.status).toBe(404);
    const stored = await pool.query('SELECT edited_content FROM descriptions WHERE id = $1', [
      descriptionId,
    ]);
    expect(stored.rows[0].edited_content).toBeNull();

    const { descriptions } = await generate('Another editable product');
    const url = `/api/descriptions/${descriptions[0]!.id}`;
    expect((await request(app).patch(url).send({ editedContent: '   ' })).status).toBe(400);
    expect(
      (
        await request(app)
          .patch(url)
          .send({ editedContent: 'x'.repeat(3001) })
      ).status,
    ).toBe(400);
    expect((await request(app).patch(url).send({})).status).toBe(400);
  });

  it('a model that never returns valid JSON -> 422, nothing saved, both attempts recorded', async () => {
    const products = await count('products');
    const descriptions = await count('descriptions');
    const invalidCalls = (
      await pool.query("SELECT count(*)::int AS n FROM llm_calls WHERE status = 'invalid_output'")
    ).rows[0].n;

    answers = ['not json', 'still not json'];
    const res = await request(app)
      .post('/api/generations')
      .send({ title: 'Doomed product', category: 'Toys' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('invalid_model_output');
    expect(await count('products')).toBe(products);
    expect(await count('descriptions')).toBe(descriptions);
    const after = (
      await pool.query("SELECT count(*)::int AS n FROM llm_calls WHERE status = 'invalid_output'")
    ).rows[0].n;
    expect(after).toBe(invalidCalls + 2);
  });
});
