export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

// USD per million tokens, standard (non-batch, non-cached) rates.
// Source: https://platform.claude.com/docs/en/about-claude/pricing (checked 2026-10-01).
// Update this table (and the date) whenever the provider changes its prices.
const PRICE_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-fable-5-1': { input: 10, output: 50 },
};

// null (not 0) for unknown models: a missing price must not look like a free call.
export function estimateCostUsd(model: string, usage: Usage): number | null {
  const price = PRICE_PER_MTOK[model];
  if (!price) return null;
  const cost = (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1_000_000;
  return Number(cost.toFixed(6)); // llm_calls.cost_usd is numeric(10, 6)
}
