import { indicativePrice, mean, projectCost, summarize, type Summary } from './stats.js';

// One row of llm_calls (plus whether its product has a photo). Cost is what was stored when the
// call was made, from the price table of that day.
export interface CallRow {
  model: string;
  promptVersion: string;
  status: 'ok' | 'invalid_output' | 'error';
  inputTokens: number;
  outputTokens: number;
  cost: number | null;
  latencyMs: number;
  hasImage: boolean | null; // null: the call is not linked to a product (failed attempts)
}

export interface ReportOptions {
  model: string; // the model being priced
  prompt: string; // the prompt label being priced ("v2" = the public prompt)
  margin: number; // 0.8 = the AI cost is 20% of the price
  scenarios: number[]; // products per month
  compareLabel: string; // label of the rows made by the model comparison
}

export interface Group {
  summary: Summary; // of the cost of a generation
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

const total = (rows: CallRow[]) => rows.reduce((sum, row) => sum + (row.cost ?? 0), 0);

function describe(rows: CallRow[]): Group {
  return {
    summary: summarize(rows.map((row) => row.cost ?? 0)),
    inputTokens: mean(rows.map((row) => row.inputTokens)),
    outputTokens: mean(rows.map((row) => row.outputTokens)),
    latencyMs: mean(rows.map((row) => row.latencyMs)),
  };
}

export function buildReport(rows: CallRow[], options: ReportOptions) {
  const used = rows.filter((r) => r.model === options.model && r.promptVersion === options.prompt);
  const ok = used.filter((r) => r.status === 'ok');
  const invalid = used.filter((r) => r.status === 'invalid_output');
  const failed = used.filter((r) => r.status === 'error');
  const withoutImage = ok.filter((r) => r.hasImage === false);
  const withImage = ok.filter((r) => r.hasImage === true);

  // Retries and rejected answers are paid for too: the overhead spreads them over the good ones.
  const spend = total(used);
  const overhead = ok.length === 0 ? 1 : spend / total(ok);
  const photoShare = ok.length === 0 ? 0 : withImage.length / ok.length;

  const perGeneration = {
    withoutImage: mean(withoutImage.map((r) => r.cost ?? 0)) * overhead,
    withImage: mean(withImage.map((r) => r.cost ?? 0)) * overhead,
  };
  const blended =
    (1 - photoShare) * perGeneration.withoutImage + photoShare * perGeneration.withImage;

  // Rows made by cost:compare. Each label is one way of calling a model ("v2-compare" is the
  // sensible setting, "v2-compare-default" what the API does if nothing is configured).
  const compared = rows.filter((r) => r.promptVersion.startsWith(options.compareLabel));
  const comparison = [...new Set(compared.map((r) => `${r.promptVersion}|${r.model}`))]
    .map((key) => {
      const [label, model] = key.split('|') as [string, string];
      const own = compared.filter((r) => r.promptVersion === label && r.model === model);
      const valid = own.filter((r) => r.status === 'ok');
      const setting =
        label === options.compareLabel
          ? model
          : `${model} (effort ${label.slice(options.compareLabel.length + 1)})`;
      return {
        label,
        model,
        setting,
        calls: own.length,
        valid: valid.length,
        spend: total(own),
        ...describe(valid),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label) || a.model.localeCompare(b.model));
  const baseline = comparison.find(
    (c) => c.label === options.compareLabel && c.model === options.model,
  );

  return {
    options,
    rows: {
      total: rows.length,
      used: used.length,
      ok: ok.length,
      invalid: invalid.length,
      failed: failed.length,
    },
    without: { ...describe(withoutImage), n: withoutImage.length },
    with: { ...describe(withImage), n: withImage.length },
    retries: {
      invalid: invalid.length,
      invalidShare: used.length === 0 ? 0 : invalid.length / (ok.length + invalid.length || 1),
      wastedSpend: total(invalid),
      overhead,
    },
    spend,
    photoShare,
    perGeneration,
    blended,
    projections: [1_000, 10_000].map((generations) => ({
      generations,
      withoutImage: projectCost(perGeneration.withoutImage, generations),
      withImage: projectCost(perGeneration.withImage, generations),
      blended: projectCost(blended, generations),
    })),
    comparison,
    pricing: options.scenarios.map((products) => {
      const aiCost = projectCost(blended, products);
      return { products, aiCost, price: indicativePrice(aiCost, options.margin) };
    }),
    // How much more a generation costs with each compared model than with the priced one.
    costRatios: comparison
      .filter((c) => baseline && c !== baseline && c.valid > 0 && baseline.summary.mean > 0)
      .map((c) => ({ setting: c.setting, ratio: c.summary.mean / baseline!.summary.mean })),
    segments: [...new Set(rows.map((r) => `${r.model}|${r.promptVersion}`))].sort().map((key) => {
      const [model, prompt] = key.split('|') as [string, string];
      const own = rows.filter((r) => r.model === model && r.promptVersion === prompt);
      const good = own.filter((r) => r.status === 'ok');
      return {
        model,
        prompt,
        calls: own.length,
        ok: good.length,
        avgCost: mean(good.map((r) => r.cost ?? 0)),
        avgInput: mean(good.map((r) => r.inputTokens)),
      };
    }),
  };
}

export type Report = ReturnType<typeof buildReport>;
