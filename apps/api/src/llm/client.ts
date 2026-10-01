import { z } from 'zod';
import { loadEnv } from '../config/env.js';
import {
  LlmBadRequestError,
  LlmRateLimitError,
  LlmTimeoutError,
  LlmUpstreamError,
  type LlmError,
} from './errors.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const MAX_ATTEMPTS = 3;
const MAX_RETRY_AFTER_MS = 30_000;

export type ImageBlock = {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    data: string;
  };
};
export type Message = {
  role: 'user' | 'assistant';
  content: string | ({ type: 'text'; text: string } | ImageBlock)[];
};
export type Tool = { name: string; description?: string; input_schema: Record<string, unknown> };
export type ToolChoice = { type: 'auto' | 'any' | 'none' } | { type: 'tool'; name: string };

export interface CompleteParams {
  system?: string;
  messages: Message[];
  maxTokens: number;
  tools?: Tool[];
  toolChoice?: ToolChoice;
}

export type ContentBlock =
  { type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: unknown };

export interface LlmResponse {
  content: ContentBlock[];
  usage: { inputTokens: number; outputTokens: number };
  model: string;
  latencyMs: number;
  raw: unknown;
}

// Everything the client needs, overridable so tests never touch the network or the clock.
export interface ClientOptions {
  apiKey: string;
  model: string;
  timeoutMs: number;
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
}

const responseSchema = z.object({
  model: z.string(),
  content: z.array(
    z.discriminatedUnion('type', [
      z.object({ type: z.literal('text'), text: z.string() }),
      z.object({
        type: z.literal('tool_use'),
        id: z.string(),
        name: z.string(),
        input: z.unknown(),
      }),
    ]),
  ),
  usage: z.object({ input_tokens: z.number(), output_tokens: z.number() }),
});

export async function complete(
  params: CompleteParams,
  overrides: Partial<ClientOptions> = {},
): Promise<LlmResponse> {
  // loadEnv only runs when an option is not supplied (`??` short-circuits).
  const env = () => loadEnv();
  const options: ClientOptions = {
    apiKey: overrides.apiKey ?? env().ANTHROPIC_API_KEY,
    model: overrides.model ?? env().LLM_MODEL,
    timeoutMs: overrides.timeoutMs ?? env().LLM_TIMEOUT_MS,
    fetch: overrides.fetch ?? fetch,
    sleep: overrides.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
  };

  const startedAt = Date.now();
  for (let attempt = 1; ; attempt++) {
    const response = await send(params, options);
    if (response.ok) return parse(await response.json(), Date.now() - startedAt);

    const error = await toError(response);
    if (!isRetryable(response.status) || attempt === MAX_ATTEMPTS) throw error;
    await options.sleep(retryDelayMs(response, attempt));
  }
}

async function send(params: CompleteParams, options: ClientOptions): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs);

  try {
    return await options.fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': options.apiKey,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify({
        model: options.model,
        max_tokens: params.maxTokens,
        system: params.system,
        messages: params.messages,
        tools: params.tools,
        tool_choice: params.toolChoice,
      }),
      signal: controller.signal,
    });
  } catch (cause) {
    if (timedOut) throw new LlmTimeoutError(`LLM request timed out after ${options.timeoutMs} ms`);
    // fetch hides the useful part (e.g. a TLS error code) in `cause`.
    const reason = ((cause as Error).cause as { code?: string } | undefined)?.code;
    throw new LlmUpstreamError(
      `LLM request failed: ${(cause as Error).message}${reason ? ` (${reason})` : ''}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

const isRetryable = (status: number) => status === 429 || status === 529 || status >= 500;

async function toError(response: Response): Promise<LlmError> {
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  const message = `Anthropic API ${response.status}: ${body?.error?.message ?? response.statusText}`;
  if (response.status === 429) return new LlmRateLimitError(message, 429);
  if (response.status >= 500) return new LlmUpstreamError(message, response.status);
  return new LlmBadRequestError(message, response.status);
}

// Honour retry-after (seconds); otherwise exponential backoff with full jitter.
function retryDelayMs(response: Response, attempt: number): number {
  const seconds = Number(response.headers.get('retry-after'));
  if (seconds > 0) return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  return Math.random() * 500 * 2 ** attempt;
}

function parse(raw: unknown, latencyMs: number): LlmResponse {
  const result = responseSchema.safeParse(raw);
  if (!result.success) throw new LlmUpstreamError('Unexpected response shape from the LLM API');
  const { content, model, usage } = result.data;
  return {
    content,
    model,
    usage: { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens },
    latencyMs,
    raw,
  };
}

export const textOf = (response: LlmResponse): string =>
  response.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('');
