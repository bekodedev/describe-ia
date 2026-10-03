import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO_USER_ID } from '../config/demo-user.js';
import { createTestSchema } from '../db/test-schema.js';
import { seedDemoUser } from '../db/users.js';
import { createImageStore } from '../images/storage.js';
import { createFakeComplete, FAKE_MODEL } from '../llm/fake.js';
import type { LlmResponse } from '../llm/client.js';
import { InvalidOutputError } from './errors.js';
import { generateDescriptions, type GenerationDeps } from './service.js';

const databaseUrl = process.env.DATABASE_URL;

const answer = (text: string): LlmResponse => ({
  content: [{ type: 'text', text }],
  usage: { inputTokens: 100, outputTokens: 80 },
  model: 'claude-haiku-4-5-20251001',
  latencyMs: 10,
  raw: { stub: true },
});

const depsReturning = (text: string, prompts: string[] = []): GenerationDeps => ({
  complete: async (params) => {
    prompts.push(String(params.messages[0]?.content));
    return answer(text);
  },
  model: 'claude-haiku-4-5-20251001',
  language: 'es',
  imageStore: createImageStore(join(tmpdir(), 'describe-ia-test-uploads')),
  promptVersion: 'v1',
});

describe.skipIf(!databaseUrl)('generateDescriptions (Postgres, stubbed LLM)', () => {
  let pool: pg.Pool;
  let drop: () => Promise<void>;

  beforeAll(async () => {
    ({ pool, drop } = await createTestSchema(databaseUrl!));
    await seedDemoUser(pool);
  });
  afterAll(() => drop());

  const count = async (table: string) =>
    (await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n as number;

  it('saves the product, 3 descriptions and a linked ok llm_call; asks for the configured language', async () => {
    const prompts: string[] = [];
    const text = 'SHORT: Short one.\nMEDIUM: Medium one.\nSEO: Seo one.';
    const result = await generateDescriptions(
      pool,
      { userId: DEMO_USER_ID, title: 'Steel bottle', category: 'Sports' },
      depsReturning(text, prompts),
    );

    expect(result.descriptions.map((d) => [d.variant, d.content])).toEqual([
      ['short', 'Short one.'],
      ['medium', 'Medium one.'],
      ['seo', 'Seo one.'],
    ]);
    expect(prompts[0]).toContain('in Spanish');
    expect(prompts[0]).toContain('Product: Steel bottle');

    const { rows } = await pool.query('SELECT * FROM llm_calls WHERE product_id = $1', [
      result.product.id,
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'ok', prompt_version: 'v1', input_tokens: 100 });
  });

  it('stores an invalid_output llm_call, throws, and saves no product when the headings are missing', async () => {
    const products = await count('products');
    const failures = await count('llm_calls');

    await expect(
      generateDescriptions(
        pool,
        { userId: DEMO_USER_ID, title: 'Mug', category: 'Home' },
        depsReturning('CORTA: ...\nMEDIA: ...\nSEO: ...'),
      ),
    ).rejects.toThrow(InvalidOutputError);

    expect(await count('products')).toBe(products);
    const { rows } = await pool.query('SELECT * FROM llm_calls ORDER BY created_at DESC LIMIT 1');
    expect(await count('llm_calls')).toBe(failures + 1);
    expect(rows[0]).toMatchObject({
      status: 'invalid_output',
      input_tokens: 100,
      product_id: null,
    });
    expect(rows[0].error_message).toMatch(/headings/);
  });

  it('v2 (default): saves what the model returned as JSON and stores prompt_version v2', async () => {
    const json = JSON.stringify({
      short: 'A steel bottle for every day.',
      medium: 'This steel bottle holds 750 ml and is made for sport and daily use. '.repeat(2),
      seo: 'Stainless steel water bottle, 750 ml, for sports, the gym, hiking and the office. '.repeat(
        3,
      ),
    });
    const v2Deps = {
      ...depsReturning(json),
      promptVersion: undefined,
      allowPrivatePrompts: false,
    }; // undefined = the default (v2)

    const result = await generateDescriptions(
      pool,
      { userId: DEMO_USER_ID, title: 'Steel bottle', category: 'Sports' },
      v2Deps,
    );

    expect(result.descriptions.map((d) => d.content)[0]).toBe('A steel bottle for every day.');
    const { rows } = await pool.query(
      'SELECT prompt_version FROM llm_calls WHERE product_id = $1',
      [result.product.id],
    );
    expect(rows).toEqual([{ prompt_version: 'v2' }]);
  });

  it('removes the stored photo when the database refuses the product', async () => {
    const store = createImageStore(await mkdtemp(join(tmpdir(), 'orphans-')));
    const image = {
      original: Buffer.from('png bytes'),
      originalType: 'image/png' as const,
      base64: 'QUJD',
    };
    const text = 'SHORT: one\nMEDIUM: two\nSEO: three';

    // A user that does not exist: the transaction fails after the file was written.
    await expect(
      generateDescriptions(
        pool,
        { userId: randomUUID(), title: 'Orphan', category: 'Toys', image },
        { ...depsReturning(text), imageStore: store },
      ),
    ).rejects.toThrow(/foreign key|violates/i);

    expect(await readdir(store.dir)).toEqual([]);
  });

  it('works end to end with the fake model: valid descriptions, model "fake", no cost', async () => {
    const result = await generateDescriptions(
      pool,
      { userId: DEMO_USER_ID, title: 'Fake mug', category: 'Home & Kitchen' },
      {
        complete: createFakeComplete('es'),
        model: FAKE_MODEL,
        language: 'es',
        imageStore: createImageStore(join(tmpdir(), 'describe-ia-test-uploads')),
        allowPrivatePrompts: false,
      },
    );

    expect(result.descriptions.map((d) => d.variant)).toEqual(['short', 'medium', 'seo']);
    expect(result.descriptions[0]?.content).toContain('Fake mug');
    const { rows } = await pool.query(
      'SELECT model, cost_usd, prompt_version, status FROM llm_calls WHERE product_id = $1',
      [result.product.id],
    );
    expect(rows).toEqual([{ model: 'fake', cost_usd: null, prompt_version: 'v2', status: 'ok' }]);
  });
});
