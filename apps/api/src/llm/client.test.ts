import { describe, expect, it, vi } from 'vitest';
import { complete, textOf } from './client.js';
import {
  LlmBadRequestError,
  LlmRateLimitError,
  LlmTimeoutError,
  LlmUpstreamError,
} from './errors.js';

const API_KEY = 'sk-ant-test-secret-key';
const params = { messages: [{ role: 'user' as const, content: 'hi' }], maxTokens: 50 };

const okBody = {
  id: 'msg_1',
  model: 'claude-haiku-4-5-20251001',
  content: [{ type: 'text', text: 'pong' }],
  usage: { input_tokens: 12, output_tokens: 3 },
};
const ok = () => Response.json(okBody);
const failure = (status: number, headers: Record<string, string> = {}) =>
  Response.json(
    { type: 'error', error: { type: 'x', message: `boom ${status}` } },
    { status, headers },
  );

// Real clock and network are replaced: `sleep` records the delay instead of waiting.
function setup(...responses: (Response | Error)[]) {
  const queue = [...responses];
  const fetchMock = vi.fn(async () => {
    const next = queue.shift()!;
    if (next instanceof Error) throw next;
    return next;
  });
  const sleep = vi.fn(async () => {});
  const options = {
    apiKey: API_KEY,
    model: 'claude-haiku-4-5-20251001',
    timeoutMs: 1000,
    fetch: fetchMock as unknown as typeof fetch,
    sleep,
  };
  return { fetchMock, sleep, options };
}

describe('complete', () => {
  it('sends the documented request and maps the response', async () => {
    const { fetchMock, options } = setup(ok());
    const response = await complete({ ...params, system: 'be brief' }, options);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers).toMatchObject({ 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' });
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      system: 'be brief',
    });
    expect(response.usage).toEqual({ inputTokens: 12, outputTokens: 3 });
    expect(response.model).toBe('claude-haiku-4-5-20251001');
    expect(textOf(response)).toBe('pong');
    expect(response.raw).toEqual(okBody);
  });

  it('asks for structured output when a JSON schema is given', async () => {
    const { fetchMock, options } = setup(ok());
    const schema = { type: 'object', properties: { a: { type: 'string' } } };
    await complete({ ...params, jsonSchema: schema }, options);

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).output_config).toEqual({
      format: { type: 'json_schema', schema },
    });
  });

  it('sends the effort next to the schema, and sends nothing when there is neither', async () => {
    const both = setup(ok());
    await complete(
      { ...params, jsonSchema: { type: 'object' } },
      { ...both.options, effort: 'low' },
    );
    const bodyOf = (mock: typeof both.fetchMock) =>
      JSON.parse((mock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(bodyOf(both.fetchMock).output_config).toEqual({
      format: { type: 'json_schema', schema: { type: 'object' } },
      effort: 'low',
    });

    const effortOnly = setup(ok());
    await complete(params, { ...effortOnly.options, effort: 'medium' });
    expect(bodyOf(effortOnly.fetchMock).output_config).toEqual({ effort: 'medium' });

    const none = setup(ok());
    await complete(params, none.options);
    expect(bodyOf(none.fetchMock)).not.toHaveProperty('output_config');
  });

  it('retries a 429 after the retry-after delay', async () => {
    const { fetchMock, sleep, options } = setup(failure(429, { 'retry-after': '2' }), ok());
    await complete(params, options);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it('keeps the provider retry-after on the error when 429 never goes away', async () => {
    const { options } = setup(
      failure(429, { 'retry-after': '4' }),
      failure(429, { 'retry-after': '4' }),
      failure(429, { 'retry-after': '4' }),
    );
    const error = await complete(params, options).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LlmRateLimitError);
    expect((error as LlmRateLimitError).retryAfterSeconds).toBe(4);
  });

  it('really waits for retry-after when no sleep is injected', async () => {
    vi.useFakeTimers();
    try {
      const { fetchMock, options } = setup(failure(429, { 'retry-after': '2' }), ok());
      const { apiKey, model, timeoutMs, fetch } = options; // everything but `sleep`
      const withRealSleep = { apiKey, model, timeoutMs, fetch };

      const pending = complete(params, withRealSleep);
      await vi.advanceTimersByTimeAsync(1999);
      expect(fetchMock).toHaveBeenCalledTimes(1); // still waiting
      await vi.advanceTimersByTimeAsync(1);
      expect((await pending).usage.inputTokens).toBe(12);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not retry a 400', async () => {
    const { fetchMock, sleep, options } = setup(failure(400));
    await expect(complete(params, options)).rejects.toThrow(LlmBadRequestError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('gives up after 3 attempts on 529 and on 429', async () => {
    const overloaded = setup(failure(529), failure(529), failure(529));
    await expect(complete(params, overloaded.options)).rejects.toThrow(LlmUpstreamError);
    expect(overloaded.fetchMock).toHaveBeenCalledTimes(3);

    const limited = setup(failure(429), failure(429), failure(429));
    await expect(complete(params, limited.options)).rejects.toThrow(LlmRateLimitError);
    expect(limited.fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries 5xx with exponential backoff', async () => {
    const { fetchMock, sleep, options } = setup(failure(500), ok());
    await complete(params, options);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('throws LlmTimeoutError when the request hangs', async () => {
    const hang = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal!.addEventListener('abort', () => reject(init.signal!.reason));
        }),
    );
    const options = { ...setup().options, fetch: hang as unknown as typeof fetch, timeoutMs: 20 };
    await expect(complete(params, options)).rejects.toThrow(LlmTimeoutError);
    expect(hang).toHaveBeenCalledTimes(1);
  });

  it('wraps network failures without retrying', async () => {
    const { fetchMock, options } = setup(new TypeError('fetch failed'));
    await expect(complete(params, options)).rejects.toThrow(LlmUpstreamError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ignores content blocks it does not use, such as the thinking of larger models', async () => {
    const body = {
      ...okBody,
      content: [
        { type: 'thinking', thinking: 'let me think', signature: 'abc' },
        ...okBody.content,
      ],
    };
    const { options } = setup(Response.json(body));

    const response = await complete(params, options);

    expect(response.content).toEqual([{ type: 'text', text: 'pong' }]);
    expect(response.raw).toEqual(body); // nothing is lost
  });

  it('rejects a text block that has no text', async () => {
    const { options } = setup(Response.json({ ...okBody, content: [{ type: 'text' }] }));
    await expect(complete(params, options)).rejects.toThrow(/Unexpected content block/);
  });

  it('rejects a 200 with an unexpected body', async () => {
    const { options } = setup(Response.json({ hello: 'world' }));
    await expect(complete(params, options)).rejects.toThrow(/Unexpected response shape/);
  });

  it('never leaks the API key into errors', async () => {
    const { options } = setup(failure(401));
    const error = (await complete(params, options).catch((e: unknown) => e)) as Error;
    expect(JSON.stringify([error.message, error.stack, error.name])).not.toContain(API_KEY);
  });
});
