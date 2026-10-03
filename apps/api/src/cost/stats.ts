export const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

// Linear interpolation between the two closest values (the default of NumPy and spreadsheets).
// p is 0..100. null when there is nothing to measure.
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = ((sorted.length - 1) * p) / 100;
  const below = Math.floor(position);
  const above = Math.ceil(position);
  return sorted[below]! + (sorted[above]! - sorted[below]!) * (position - below);
}

export interface Summary {
  n: number;
  mean: number;
  p50: number | null;
  p95: number | null;
}

export const summarize = (values: number[]): Summary => ({
  n: values.length,
  mean: mean(values),
  p50: percentile(values, 50),
  p95: percentile(values, 95),
});

export const projectCost = (costPerGeneration: number, generations: number): number =>
  costPerGeneration * generations;

// The price at which the AI cost is only (1 - margin) of what the customer pays:
// margin 0.8 -> the AI cost is 20% of the price -> price = 5 x cost.
export function indicativePrice(aiCost: number, margin: number): number {
  if (margin < 0 || margin >= 1) throw new RangeError('margin must be at least 0 and below 1');
  return aiCost / (1 - margin);
}
