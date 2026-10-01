import { insertLlmCall } from '../db/llm-calls.js';
import type { Db } from '../db/pool.js';
import type { LlmResponse } from './client.js';
import { estimateCostUsd } from './pricing.js';

export interface CallContext {
  userId: string;
  productId?: string;
  promptVersion: string;
  model: string; // only used for the error row, when there is no response to read it from
}

// Runs one LLM call and stores a llm_calls row either way, so failures show up in the cost data.
export async function recordLlmCall(
  db: Db,
  context: CallContext,
  call: () => Promise<LlmResponse>,
): Promise<LlmResponse> {
  const startedAt = Date.now();
  const base = {
    userId: context.userId,
    productId: context.productId,
    promptVersion: context.promptVersion,
  };

  try {
    const response = await call();
    await insertLlmCall(db, {
      ...base,
      model: response.model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      costUsd: estimateCostUsd(response.model, response.usage),
      latencyMs: response.latencyMs,
      status: 'ok',
      rawResponse: response.raw,
    });
    return response;
  } catch (error) {
    await insertLlmCall(db, {
      ...base,
      model: context.model,
      latencyMs: Date.now() - startedAt,
      status: 'error',
      errorMessage: (error as Error).message,
    });
    throw error;
  }
}
