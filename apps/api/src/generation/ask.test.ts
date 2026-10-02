import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/pool.js';
import type { CompleteParams, LlmResponse } from '../llm/client.js';
import { askForDescriptions } from './ask.js';
import { InvalidOutputError } from './errors.js';

const valid = {
  short: 'A stainless steel bottle for every day.',
  medium: 'This stainless steel bottle holds 750 ml and is made for sport and daily use. '.repeat(
    2,
  ),
  seo: 'Stainless steel water bottle, 750 ml, for sports, the gym, hiking and the office. '.repeat(
    3,
  ),
};
const missingSeo = { short: valid.short, medium: valid.medium };

const answer = (body: unknown): LlmResponse => ({
  content: [{ type: 'text', text: typeof body === 'string' ? body : JSON.stringify(body) }],
  usage: { inputTokens: 100, outputTokens: 80 },
  model: 'claude-haiku-4-5-20251001',
  latencyMs: 10,
  raw: {},
});

// Fake Db that remembers every llm_calls INSERT (index 8 of the values is the status).
function fakeDb() {
  const query = vi.fn(async () => ({ rows: [{ id: `call-${query.mock.calls.length}` }] }));
  const statuses = () =>
    query.mock.calls.map((call) => (call as unknown as [string, unknown[]])[1][8]);
  return { db: { query } as unknown as Db, statuses };
}

// Replies with the given answers in order and remembers what it was asked.
function fakeModel(...answers: unknown[]) {
  const requests: CompleteParams[] = [];
  const complete = async (params: CompleteParams) => {
    requests.push({ ...params, messages: [...params.messages] });
    return answer(answers.shift());
  };
  return { complete, requests };
}

const base = { userId: 'u1', model: 'claude-haiku-4-5-20251001', prompt: 'Describe a bottle' };

describe('askForDescriptions (v2)', () => {
  it('returns valid JSON at the first attempt and asks for the schema', async () => {
    const { db, statuses } = fakeDb();
    const model = fakeModel(valid);

    const result = await askForDescriptions(db, {
      ...base,
      version: 'v2',
      complete: model.complete,
    });

    expect(result.variants.short).toBe(valid.short);
    expect(statuses()).toEqual(['ok']);
    expect(model.requests[0]?.jsonSchema).toMatchObject({ required: ['short', 'medium', 'seo'] });
  });

  it('retries once, telling the model what was wrong, when a field is missing', async () => {
    const { db, statuses } = fakeDb();
    const model = fakeModel(missingSeo, valid);

    const result = await askForDescriptions(db, {
      ...base,
      version: 'v2',
      complete: model.complete,
    });

    expect(result.variants.seo).toBe(valid.seo.trim());
    expect(statuses()).toEqual(['invalid_output', 'ok']);
    const retry = model.requests[1]!.messages;
    expect(retry.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(retry[2]?.content).toMatch(/seo/);
  });

  it('throws a typed 422 error after two invalid answers in a row', async () => {
    const { db, statuses } = fakeDb();
    const model = fakeModel(missingSeo, 'not json at all');

    const error = await askForDescriptions(db, {
      ...base,
      version: 'v2',
      complete: model.complete,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(InvalidOutputError);
    expect((error as InvalidOutputError).status).toBe(422);
    expect(statuses()).toEqual(['invalid_output', 'invalid_output']);
    expect(model.requests).toHaveLength(2); // one retry, no more
  });
});

describe('askForDescriptions (v1)', () => {
  it('does not retry and does not ask for a schema', async () => {
    const { db, statuses } = fakeDb();
    const model = fakeModel('no headings here');

    await expect(
      askForDescriptions(db, { ...base, version: 'v1', complete: model.complete }),
    ).rejects.toBeInstanceOf(InvalidOutputError);

    expect(statuses()).toEqual(['invalid_output']);
    expect(model.requests[0]?.jsonSchema).toBeUndefined();
  });
});
