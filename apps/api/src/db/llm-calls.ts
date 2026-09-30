import type { Db } from './pool.js';

export type LlmCallStatus = 'ok' | 'invalid_output' | 'error';

export interface NewLlmCall {
  userId: string;
  productId?: string | null;
  model: string;
  promptVersion: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number | null;
  latencyMs: number;
  status: LlmCallStatus;
  errorMessage?: string | null;
  rawResponse?: unknown;
}

export interface LlmCall {
  id: string;
  user_id: string;
  product_id: string | null;
  model: string;
  prompt_version: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: string | null;
  latency_ms: number;
  status: LlmCallStatus;
  error_message: string | null;
  raw_response: unknown;
  created_at: Date;
}

export async function insertLlmCall(db: Db, call: NewLlmCall): Promise<LlmCall> {
  const { rows } = await db.query<LlmCall>(
    `INSERT INTO llm_calls (user_id, product_id, model, prompt_version, input_tokens,
       output_tokens, cost_usd, latency_ms, status, error_message, raw_response)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [
      call.userId,
      call.productId ?? null,
      call.model,
      call.promptVersion,
      call.inputTokens ?? 0,
      call.outputTokens ?? 0,
      call.costUsd ?? null,
      call.latencyMs,
      call.status,
      call.errorMessage ?? null,
      call.rawResponse === undefined ? null : JSON.stringify(call.rawResponse),
    ],
  );
  return rows[0]!;
}
