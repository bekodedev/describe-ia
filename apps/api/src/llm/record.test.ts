import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/pool.js';
import type { LlmResponse } from './client.js';
import { LlmRateLimitError } from './errors.js';
import { recordLlmCall } from './record.js';

const context = { userId: 'u1', promptVersion: 'v1', model: 'claude-haiku-4-5-20251001' };

// A fake Db that captures the INSERT parameters: no Postgres needed for this unit test.
function fakeDb() {
  const query = vi.fn(async () => ({ rows: [{}] }));
  return { db: { query } as unknown as Db, query };
}
const insertedValues = (query: ReturnType<typeof fakeDb>['query']) =>
  (query.mock.calls[0] as unknown as [string, unknown[]])[1];

describe('recordLlmCall', () => {
  it('stores tokens and a positive cost on success', async () => {
    const { db, query } = fakeDb();
    const response: LlmResponse = {
      content: [{ type: 'text', text: 'pong' }],
      usage: { inputTokens: 1000, outputTokens: 500 },
      model: 'claude-haiku-4-5-20251001',
      latencyMs: 321,
      raw: { id: 'msg_1' },
    };

    expect(await recordLlmCall(db, context, async () => response)).toBe(response);

    // [user_id, product_id, model, prompt_version, input, output, cost, latency, status, error, raw]
    expect(insertedValues(query)).toEqual([
      'u1',
      null,
      'claude-haiku-4-5-20251001',
      'v1',
      1000,
      500,
      0.0035,
      321,
      'ok',
      null,
      '{"id":"msg_1"}',
    ]);
  });

  it('stores an error row and rethrows the original error', async () => {
    const { db, query } = fakeDb();
    const failure = new LlmRateLimitError('Anthropic API 429: slow down', 429);

    await expect(
      recordLlmCall(db, context, async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);

    const values = insertedValues(query);
    expect(values[8]).toBe('error');
    expect(values[9]).toBe('Anthropic API 429: slow down');
    expect(values[2]).toBe('claude-haiku-4-5-20251001');
  });
});
