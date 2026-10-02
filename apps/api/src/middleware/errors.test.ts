import type pg from 'pg';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { InvalidOutputError } from '../generation/errors.js';
import { LlmRateLimitError, LlmTimeoutError, LlmUpstreamError } from '../llm/errors.js';
import type { GenerateFn } from '../routes/generations.js';

// No database here: every test stubs `generate`, so only the HTTP layer is under test.
const pool = { query: async () => ({ rows: [] }) } as unknown as pg.Pool;
const valid = { title: 'Stainless steel bottle', category: 'Sports' };

const failingWith = (error: unknown): GenerateFn => {
  return async () => {
    throw error;
  };
};
const post = (generate: GenerateFn, body: unknown = valid) =>
  request(createApp(pool, { generate }))
    .post('/api/generations')
    .send(body as object);

let logs: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  logs = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => logs.mockRestore());

describe('error mapping', () => {
  it('LLM rate limit -> 503 with the provider Retry-After', async () => {
    const res = await post(failingWith(new LlmRateLimitError('slow down', 429, 7)));
    expect(res.status).toBe(503);
    expect(res.headers['retry-after']).toBe('7');
    expect(res.body.error.code).toBe('llm_rate_limited');
  });

  it('LLM rate limit without a provider hint -> 503 with a default Retry-After', async () => {
    const res = await post(failingWith(new LlmRateLimitError('slow down', 429)));
    expect(res.status).toBe(503);
    expect(res.headers['retry-after']).toBe('30');
  });

  it('invalid model output -> 422, without the model text', async () => {
    const res = await post(failingWith(new InvalidOutputError('bad shape', 'RAW MODEL TEXT')));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('invalid_model_output');
    expect(JSON.stringify(res.body)).not.toContain('RAW MODEL TEXT');
  });

  it('LLM timeout -> 504', async () => {
    const res = await post(failingWith(new LlmTimeoutError('timed out after 30000 ms')));
    expect(res.status).toBe(504);
    expect(res.body.error.code).toBe('llm_timeout');
  });

  it.each([
    ['an unexpected error', new Error('connect ECONNREFUSED postgres://user:hunter2@db')],
    ['an upstream LLM failure', new LlmUpstreamError('Anthropic API 500: internal details', 500)],
  ])('%s -> 500 without leaking details', async (_name, error) => {
    const res = await post(failingWith(error));
    expect(res.status).toBe(500);
    expect(res.body.error).toMatchObject({
      code: 'internal_error',
      message: 'Something went wrong',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/hunter2|internal details/);
  });
});

describe('validation -> 400 with details', () => {
  it.each([
    ['a missing title', { category: 'Sports' }, 'title'],
    ['a title that is too short', { ...valid, title: 'ab' }, 'title'],
    ['a title that is only spaces', { ...valid, title: '     ' }, 'title'],
    ['a title that is too long', { ...valid, title: 'x'.repeat(201) }, 'title'],
    ['a category outside the list', { ...valid, category: 'Cosmetics' }, 'category'],
    ['a missing body', '', ''], // the issue is on the body itself
  ])('rejects %s', async (_name, body, field) => {
    const res = await post(async () => Promise.reject(new Error('must not be called')), body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain(field);
  });

  it('rejects a body that is not JSON', async () => {
    const res = await request(createApp(pool))
      .post('/api/generations')
      .set('content-type', 'application/json')
      .send('{"title": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_json');
  });

  it('rejects an id that is not a UUID and a bad pagination query', async () => {
    const app = createApp(pool);
    expect((await request(app).get('/api/products/not-a-uuid')).status).toBe(400);
    expect((await request(app).get('/api/products?limit=0')).status).toBe(400);
    expect((await request(app).get('/api/products?limit=101')).status).toBe(400);
    expect((await request(app).get('/api/products?cursor=garbage')).status).toBe(400);
  });
});

describe('other responses', () => {
  it('unknown route -> 404 in the same error shape', async () => {
    const res = await request(createApp(pool)).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'not_found' });
  });

  it('every error carries the request id (header, body and log)', async () => {
    const res = await post(failingWith(new Error('boom')));
    const id = res.headers['x-request-id'];
    expect(id).toBeTruthy();
    expect(res.body.error.requestId).toBe(id);
    expect(logs.mock.calls.flat().join('\n')).toContain(`[${id}] POST /api/generations -> 500`);
  });
});

describe('rate limit on POST /api/generations', () => {
  const canned: GenerateFn = async () => ({
    product: {
      id: 'p',
      user_id: 'u',
      title: 't',
      category: 'c',
      image_path: null,
      created_at: new Date(),
    },
    descriptions: [],
  });

  it('allows `max` requests per window, then answers 429 with Retry-After, then resets', async () => {
    let now = 1_000_000;
    const app = createApp(pool, {
      generate: canned,
      rateLimit: { max: 2, windowMs: 60_000, now: () => now },
    });
    const send = () => request(app).post('/api/generations').send(valid);

    expect((await send()).status).toBe(201);
    expect((await send()).status).toBe(201);
    const limited = await send();
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('rate_limited');
    expect(limited.headers['retry-after']).toBe('60');

    now += 60_001;
    expect((await send()).status).toBe(201);
  });

  it('does not limit the read endpoints', async () => {
    const app = createApp(pool, { rateLimit: { max: 1, windowMs: 60_000 } });
    for (let i = 0; i < 3; i++) expect((await request(app).get('/api/products')).status).toBe(200);
  });
});
