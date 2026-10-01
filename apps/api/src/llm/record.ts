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
// `interpret` turns the response into the value the caller needs; if it throws, the call is
// stored as 'invalid_output' (the tokens were spent) and the error is rethrown.
export async function recordLlmCall<T>(
  db: Db,
  context: CallContext,
  call: () => Promise<LlmResponse>,
  interpret: (response: LlmResponse) => T,
): Promise<{ response: LlmResponse; value: T; callId: string }> {
  const startedAt = Date.now();
  const base = {
    userId: context.userId,
    productId: context.productId,
    promptVersion: context.promptVersion,
  };

  let response: LlmResponse;
  try {
    response = await call();
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

  let value: T | undefined;
  let invalid: Error | undefined;
  try {
    value = interpret(response);
  } catch (error) {
    invalid = error as Error;
  }

  const row = await insertLlmCall(db, {
    ...base,
    model: response.model,
    inputTokens: response.usage.inputTokens,
    outputTokens: response.usage.outputTokens,
    costUsd: estimateCostUsd(response.model, response.usage),
    latencyMs: response.latencyMs,
    status: invalid ? 'invalid_output' : 'ok',
    errorMessage: invalid?.message,
    rawResponse: response.raw,
  });
  if (invalid) throw invalid;
  return { response, value: value as T, callId: row.id };
}
