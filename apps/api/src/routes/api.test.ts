import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type pg from 'pg';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { DEMO_USER_ID } from '../config/demo-user.js';
import { createTestSchema } from '../db/test-schema.js';
import { seedDemoUser } from '../db/users.js';
import type { GenerationResponse } from '@describe-ia/shared';
import { createImageStore } from '../images/storage.js';
import type { CompleteParams, LlmResponse } from '../llm/client.js';
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

  const requests: CompleteParams[] = []; // what the stubbed model was asked
  let uploadsDir: string;

  const complete = async (params: CompleteParams): Promise<LlmResponse> => (
    requests.push(params),
    {
      content: [{ type: 'text', text: answers.length > 1 ? answers.shift()! : answers[0]! }],
      usage: { inputTokens: 100, outputTokens: 80 },
      model: 'claude-haiku-4-5-20251001',
      latencyMs: 5,
      raw: {},
    }
  );

  beforeAll(async () => {
    ({ pool, drop } = await createTestSchema(databaseUrl!));
    await seedDemoUser(pool);
    uploadsDir = await mkdtemp(join(tmpdir(), 'describe-ia-uploads-'));
    const imageStore = createImageStore(uploadsDir);
    app = createApp(pool, {
      generate: (input) =>
        generateDescriptions(pool, input, {
          complete,
          model: 'test-model',
          language: 'es',
          imageStore,
        }),
      rateLimit: { max: 1000, windowMs: 60_000 },
      imageStore,
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
      imageUrl: null,
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

  describe('product photo', () => {
    const photo = (width: number, height: number) =>
      sharp({ create: { width, height, channels: 3, background: { r: 200, g: 30, b: 30 } } })
        .png()
        .toBuffer();
    const withPhoto = (title: string, image: Buffer) =>
      request(app)
        .post('/api/generations')
        .field('title', title)
        .field('category', 'Home & Kitchen')
        .attach('image', image, { filename: 'photo.png', contentType: 'image/png' });

    it('sends a resized JPEG image block before the text, keeps the original and serves it', async () => {
      answers = [validAnswer];
      const original = await photo(3000, 2000);

      const res = await withPhoto('Red mug', original);

      expect(res.status).toBe(201);
      expect(res.body.product.imageUrl).toBe(`/api/products/${res.body.product.id}/image`);
      expect(res.body.descriptions).toHaveLength(3);

      const content = requests.at(-1)!.messages[0]!.content;
      if (typeof content === 'string') throw new Error('expected content blocks');
      expect(content.map((block) => block.type)).toEqual(['image', 'text']);
      const block = content[0]!;
      if (block.type !== 'image') throw new Error('expected an image block');
      expect(block.source.media_type).toBe('image/jpeg');
      const sent = await sharp(Buffer.from(block.source.data, 'base64')).metadata();
      expect(sent).toMatchObject({ format: 'jpeg', width: 1024, height: 683 });
      expect(JSON.stringify(content[1])).toContain('Red mug');

      const files = (await readdir(uploadsDir)).filter((f) => f.endsWith('.png'));
      expect(files).toHaveLength(1);
      expect(await readFile(join(uploadsDir, files[0]!))).toEqual(original);

      const image = await request(app).get(res.body.product.imageUrl);
      expect(image.status).toBe(200);
      expect(image.headers['content-type']).toBe('image/png');
      expect(image.headers['cache-control']).toContain('private');
      expect(image.body).toEqual(original);
    });

    it('without a photo the model receives plain text, as before', async () => {
      await generate('Plain product');
      expect(typeof requests.at(-1)!.messages[0]!.content).toBe('string');
    });

    it('GET image answers 404 without a photo, for other users’ photos and when the file is gone', async () => {
      const { product } = await generate('No photo');
      expect((await request(app).get(`/api/products/${product.id}/image`)).status).toBe(404);

      await writeFile(join(uploadsDir, 'secret.png'), await photo(10, 10));
      const user = await pool.query(
        "INSERT INTO users (email, name) VALUES ($1, 'Photo owner') RETURNING id",
        [`photo-${randomUUID()}@test.local`],
      );
      const foreign = await pool.query(
        "INSERT INTO products (user_id, title, category, image_path) VALUES ($1, 'Foreign', 'Other', 'secret.png') RETURNING id",
        [user.rows[0].id],
      );
      expect((await request(app).get(`/api/products/${foreign.rows[0].id}/image`)).status).toBe(
        404,
      );

      const mine = await pool.query(
        "INSERT INTO products (user_id, title, category, image_path) VALUES ($1, 'Lost photo', 'Other', 'missing.png') RETURNING id",
        [DEMO_USER_ID],
      );
      const lost = await request(app).get(`/api/products/${mine.rows[0].id}/image`);
      expect(lost.status).toBe(404);
      expect(lost.body.error.code).toBe('not_found');
    });

    it('a failed generation leaves no file and no product', async () => {
      const files = (await readdir(uploadsDir)).length;
      const products = await count('products');
      answers = ['not json', 'still not json'];

      const res = await withPhoto('Doomed with photo', await photo(200, 200));

      expect(res.status).toBe(422);
      expect(await readdir(uploadsDir)).toHaveLength(files);
      expect(await count('products')).toBe(products);
    });
  });

  describe('usage', () => {
    const insertCall = (userId: string, createdAt: string, status: string, cost: number | null) =>
      pool.query(
        `INSERT INTO llm_calls (user_id, model, prompt_version, input_tokens, output_tokens,
           cost_usd, latency_ms, status, created_at)
         VALUES ($1, 'test-model', 'v2', 100, 50, $2, 10, $3, $4)`,
        [userId, cost, status, createdAt],
      );

    it('GET /api/usage?month adds up the demo user’s calls of that UTC month, failures included', async () => {
      const other = await pool.query(
        "INSERT INTO users (email, name) VALUES ($1, 'Someone else') RETURNING id",
        [`usage-${randomUUID()}@test.local`],
      );
      await insertCall(DEMO_USER_ID, '2031-05-01 00:00:00+00', 'ok', 0.002); // first instant of the month
      await insertCall(DEMO_USER_ID, '2031-05-20 12:00:00+00', 'invalid_output', 0.001);
      await insertCall(DEMO_USER_ID, '2031-05-31 23:59:59+00', 'error', null);
      await insertCall(DEMO_USER_ID, '2031-04-30 23:59:59+00', 'ok', 1); // the month before
      await insertCall(DEMO_USER_ID, '2031-06-01 00:00:00+00', 'ok', 1); // the month after
      await insertCall(other.rows[0].id, '2031-05-10 10:00:00+00', 'ok', 5); // another user

      const res = await request(app).get('/api/usage').query({ month: '2031-05' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        month: '2031-05',
        calls: 3,
        generations: 1,
        costUsd: 0.003,
        inputTokens: 300,
        outputTokens: 150,
      });
    });

    it('defaults to the current month and is zero when nothing was spent', async () => {
      const res = await request(app).get('/api/usage').query({ month: '2031-07' });
      expect(res.body).toMatchObject({ month: '2031-07', calls: 0, costUsd: 0 });

      const now = await request(app).get('/api/usage');
      expect(now.status).toBe(200);
      expect(now.body.month).toBe(new Date().toISOString().slice(0, 7));
    });

    it('rejects a month that is not YYYY-MM', async () => {
      for (const month of ['2031-13', '2031-5', 'may', '2031-05-01']) {
        expect((await request(app).get('/api/usage').query({ month })).status).toBe(400);
      }
    });
  });
});
