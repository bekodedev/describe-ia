import { describe, expect, it } from 'vitest';
import { estimateCostUsd } from './pricing.js';

describe('estimateCostUsd', () => {
  it('prices input and output separately (Haiku 4.5: $1 / $5 per MTok)', () => {
    // 1,000 in * $1/M = $0.001 and 500 out * $5/M = $0.0025
    expect(
      estimateCostUsd('claude-haiku-4-5-20251001', { inputTokens: 1000, outputTokens: 500 }),
    ).toBe(0.0035);
  });

  it('scales to a million tokens (Sonnet 5.5: $2 / $10)', () => {
    expect(
      estimateCostUsd('claude-sonnet-5-5', { inputTokens: 1_000_000, outputTokens: 1_000_000 }),
    ).toBe(12);
  });

  it('returns null for a model without a known price', () => {
    expect(estimateCostUsd('some-new-model', { inputTokens: 1, outputTokens: 1 })).toBeNull();
  });
});
