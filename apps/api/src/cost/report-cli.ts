import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '../config/env.js';
import { createPool } from '../db/pool.js';
import { readArgs } from './args.js';
import { buildReport, type CallRow } from './report.js';
import { renderReport } from './render.js';

// pnpm --filter api cost:report [--since <ISO date>] [--model <id>] [--prompt <label>] [--margin 0.8]
// Writes docs/experiments/t09-costs.md from the llm_calls table.
const args = readArgs();
const env = loadEnv();
const since = args.since ?? null;
const outFile = fileURLToPath(
  new URL('../../../../docs/experiments/t09-costs.md', import.meta.url),
);

const pool = createPool(env.DATABASE_URL);
try {
  const { rows } = await pool.query(
    `SELECT l.model, l.prompt_version, l.status, l.input_tokens, l.output_tokens,
            l.cost_usd::float AS cost, l.latency_ms,
            CASE WHEN l.product_id IS NULL THEN NULL ELSE p.image_path IS NOT NULL END AS has_image
     FROM llm_calls l LEFT JOIN products p ON p.id = l.product_id
     WHERE l.prompt_version <> 'ping' AND ($1::timestamptz IS NULL OR l.created_at >= $1::timestamptz)
     ORDER BY l.created_at`,
    [since],
  );
  const calls: CallRow[] = rows.map((r) => ({
    model: r.model,
    promptVersion: r.prompt_version,
    status: r.status,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    cost: r.cost,
    latencyMs: r.latency_ms,
    hasImage: r.has_image,
  }));

  const report = buildReport(calls, {
    model: args.model ?? env.LLM_MODEL,
    prompt: args.prompt ?? 'v2',
    margin: Number(args.margin ?? 0.8),
    scenarios: [100, 1_000, 5_000],
    compareLabel: 'v2-compare',
  });
  await writeFile(
    outFile,
    renderReport(report, since, new Date().toLocaleDateString('sv')),
    'utf8',
  );

  const blended = report.blended;
  console.log(
    `${report.rows.used} calls used, ${report.rows.ok} valid (${report.without.summary.n} without photo, ${report.with.summary.n} with photo)`,
  );
  console.log(
    `blended cost per generation $${blended.toFixed(5)}  ->  $${(blended * 1000).toFixed(2)} per 1,000`,
  );
  console.log(`written ${outFile}`);
} finally {
  await pool.end();
}
