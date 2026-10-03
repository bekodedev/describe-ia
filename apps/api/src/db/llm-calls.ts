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

// The call is recorded before the product exists, so the link is made afterwards.
export async function linkLlmCallToProduct(
  db: Db,
  callId: string,
  productId: string,
): Promise<void> {
  await db.query('UPDATE llm_calls SET product_id = $2 WHERE id = $1', [callId, productId]);
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

export interface MonthlyUsage {
  calls: number;
  generations: number; // calls that produced a valid answer
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
}

// `month` is "YYYY-MM", in UTC. Failed calls are included: they cost money too.
export async function monthlyUsage(db: Db, userId: string, month: string): Promise<MonthlyUsage> {
  const { rows } = await db.query<Record<keyof MonthlyUsage, string>>(
    `SELECT count(*) AS calls,
            count(*) FILTER (WHERE status = 'ok') AS generations,
            coalesce(sum(cost_usd), 0) AS "costUsd",
            coalesce(sum(input_tokens), 0) AS "inputTokens",
            coalesce(sum(output_tokens), 0) AS "outputTokens"
     FROM llm_calls
     WHERE user_id = $1
       AND created_at >= ($2 || '-01')::timestamp AT TIME ZONE 'UTC'
       AND created_at < (($2 || '-01')::timestamp + interval '1 month') AT TIME ZONE 'UTC'`,
    [userId, month],
  );
  const row = rows[0]!;
  return {
    calls: Number(row.calls),
    generations: Number(row.generations),
    costUsd: Number(row.costUsd),
    inputTokens: Number(row.inputTokens),
    outputTokens: Number(row.outputTokens),
  };
}
