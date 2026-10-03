import { describe, expect, it } from 'vitest';
import { renderReport } from './render.js';
import { buildReport, type CallRow, type ReportOptions } from './report.js';
import { indicativePrice, mean, percentile, projectCost, summarize } from './stats.js';

describe('percentile (linear interpolation)', () => {
  it('matches the textbook values', () => {
    const values = [1, 2, 3, 4, 5];
    expect(percentile(values, 0)).toBe(1);
    expect(percentile(values, 50)).toBe(3);
    expect(percentile(values, 95)).toBeCloseTo(4.8);
    expect(percentile(values, 100)).toBe(5);
  });

  it('interpolates between neighbours and does not need sorted input', () => {
    expect(percentile([40, 10, 30, 20], 50)).toBe(25); // between 20 and 30
    expect(percentile([40, 10, 30, 20], 95)).toBeCloseTo(38.5);
  });

  it('handles one value and no values', () => {
    expect(percentile([7], 95)).toBe(7);
    expect(percentile([], 50)).toBeNull();
  });

  it('does not change the array it receives', () => {
    const values = [3, 1, 2];
    percentile(values, 50);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe('summarize, projection and price', () => {
  it('summarizes a list of costs', () => {
    expect(summarize([0.002, 0.004, 0.006])).toEqual({
      n: 3,
      mean: 0.004,
      p50: 0.004,
      p95: 0.0058,
    });
    expect(mean([])).toBe(0);
  });

  it('projects a cost per generation to N generations', () => {
    expect(projectCost(0.0021, 1000)).toBeCloseTo(2.1);
    expect(projectCost(0.0021, 10_000)).toBeCloseTo(21);
  });

  it('prices so that the AI cost is the rest of the margin', () => {
    expect(indicativePrice(2, 0.8)).toBeCloseTo(10); // cost = 20% of the price
    expect(indicativePrice(2, 0)).toBe(2);
    expect(() => indicativePrice(2, 1)).toThrow(RangeError);
    expect(() => indicativePrice(2, -0.1)).toThrow(RangeError);
  });
});

const row = (overrides: Partial<CallRow>): CallRow => ({
  model: 'cheap',
  promptVersion: 'v2',
  status: 'ok',
  inputTokens: 500,
  outputTokens: 300,
  cost: 0.002,
  latencyMs: 4000,
  hasImage: false,
  ...overrides,
});

const options: ReportOptions = {
  model: 'cheap',
  prompt: 'v2',
  margin: 0.8,
  scenarios: [100, 1000],
  compareLabel: 'v2-compare',
};

describe('buildReport', () => {
  const rows = [
    row({ cost: 0.002 }),
    row({ cost: 0.004 }),
    row({ cost: 0.003, hasImage: true, inputTokens: 1500 }),
    row({ cost: 0.005, hasImage: true, inputTokens: 1500 }),
    row({ status: 'invalid_output', cost: 0.002, hasImage: null }),
    row({ status: 'error', cost: null, inputTokens: 0, outputTokens: 0, hasImage: null }),
    row({ promptVersion: 'v2-private', cost: 0.01 }), // another prompt: left out
    row({ model: 'big', promptVersion: 'v2-compare', cost: 0.01, latencyMs: 8000 }),
    row({ promptVersion: 'v2-compare', cost: 0.002 }),
    row({
      model: 'big',
      promptVersion: 'v2-compare-default',
      status: 'invalid_output',
      cost: 0.015,
    }),
    row({
      model: 'big',
      promptVersion: 'v2-compare-default',
      status: 'invalid_output',
      cost: 0.015,
    }),
  ];
  const report = buildReport(rows, options);

  it('only uses the model and prompt being priced', () => {
    expect(report.rows).toEqual({ total: 11, used: 6, ok: 4, invalid: 1, failed: 1 });
  });

  it('separates generations with and without a photo', () => {
    expect(report.without.summary).toMatchObject({ n: 2, mean: 0.003, p50: 0.003 });
    expect(report.with.summary).toMatchObject({ n: 2, mean: 0.004 });
    expect(report.with.inputTokens).toBe(1500);
    expect(report.photoShare).toBe(0.5);
  });

  it('counts the cost of rejected answers: the retry overhead', () => {
    // 0.014 spent on valid calls + 0.002 on the rejected one
    expect(report.spend).toBeCloseTo(0.016);
    expect(report.retries).toMatchObject({ invalid: 1, wastedSpend: 0.002 });
    expect(report.retries.overhead).toBeCloseTo(0.016 / 0.014);
    expect(report.retries.invalidShare).toBeCloseTo(1 / 5);
    expect(report.perGeneration.withoutImage).toBeCloseTo(0.003 * (0.016 / 0.014));
  });

  it('projects 1,000 and 10,000 generations and blends by the observed photo share', () => {
    const [thousand, tenThousand] = report.projections;
    expect(thousand!.blended).toBeCloseTo(report.blended * 1000);
    expect(tenThousand!.blended).toBeCloseTo(report.blended * 10_000);
    expect(report.blended).toBeCloseTo(((0.003 + 0.004) / 2) * (0.016 / 0.014));
  });

  it('turns each scenario into an AI cost and a price at the target margin', () => {
    const scenario = report.pricing.find((s) => s.products === 1000)!;
    expect(scenario.aiCost).toBeCloseTo(report.blended * 1000);
    expect(scenario.price).toBeCloseTo(scenario.aiCost * 5);
  });

  it('compares the settings of the comparison runs, also the ones that never produced a valid answer', () => {
    expect(
      report.comparison.map((c) => [c.setting, c.calls, c.valid, Number(c.spend.toFixed(6))]),
    ).toEqual([
      ['big', 1, 1, 0.01],
      ['cheap', 1, 1, 0.002],
      ['big (effort default)', 2, 0, 0.03],
    ]);
    // only settings with valid answers get a cost ratio against the priced model
    expect(report.costRatios).toEqual([{ setting: 'big', ratio: 5 }]);
  });

  it('copes with no data at all', () => {
    const empty = buildReport([], options);
    expect(empty.blended).toBe(0);
    expect(empty.retries.overhead).toBe(1);
    expect(renderReport(empty, null, '2026-10-03')).toContain('No comparison runs found');
  });
});

describe('renderReport', () => {
  it('writes the sections the task asks for, and says it is an estimate', () => {
    const text = renderReport(
      buildReport(
        [
          row({}),
          row({ hasImage: true, cost: 0.003 }),
          row({ model: 'big', promptVersion: 'v2-compare', cost: 0.01 }),
        ],
        options,
      ),
      '2026-10-03',
      '2026-10-03',
    );
    for (const heading of [
      '## Cost per generation',
      '## Retries',
      '## Projection',
      '## Model comparison',
      '## Indicative pricing',
    ]) {
      expect(text).toContain(heading);
    }
    expect(text).toContain('This is an estimate, not a price list');
    expect(text).toContain('p95');
    expect(text).toContain('| 10,000 |');
  });
});
