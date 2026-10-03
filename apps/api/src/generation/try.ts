import { readFile } from 'node:fs/promises';
import { DEMO_USER_ID } from '../config/demo-user.js';
import { loadEnv } from '../config/env.js';
import { createPool } from '../db/pool.js';
import { prepareImage } from '../images/prepare.js';
import { InvalidOutputError } from './errors.js';
import { defaultDeps, generateDescriptions } from './service.js';

// Dev script: pnpm --filter api gen:try "<title>" "<category>" [v1|v2] [--image <file>]   (v2 by default)
const args = process.argv.slice(2);
const flag = args.indexOf('--image');
const imageFile = flag >= 0 ? args.splice(flag, 2)[1] : undefined;
const [title, category, version = 'v2'] = args;
if (!title || !category || (version !== 'v1' && version !== 'v2')) {
  console.error('Usage: gen:try "<title>" "<category>" [v1|v2] [--image <file>]');
  process.exit(1);
}

const pool = createPool(loadEnv().DATABASE_URL);
try {
  const image = imageFile ? await prepareImage(await readFile(imageFile)) : undefined;
  const { product, rawText, descriptions } = await generateDescriptions(
    pool,
    { userId: DEMO_USER_ID, title, category, image },
    { ...defaultDeps(), promptVersion: version },
  );
  console.log('--- RAW RESPONSE ---\n' + rawText);
  console.log('\n--- PARSED ---');
  for (const d of descriptions) console.log(`[${d.variant}] ${d.content}`);

  const { rows } = await pool.query(
    'SELECT input_tokens, output_tokens, cost_usd FROM llm_calls WHERE product_id = $1',
    [product.id],
  );
  const usage = rows[0];
  console.log(
    `\n--- USAGE --- ${usage.input_tokens} in / ${usage.output_tokens} out tokens, $${usage.cost_usd}` +
      (image ? ' (with image)' : ' (text only)'),
  );
} catch (error) {
  if (error instanceof InvalidOutputError)
    console.log('--- RAW RESPONSE ---\n' + error.text + '\n');
  // Connection failures surface as an AggregateError with an empty message.
  const reason = (error as Error).message || (error as { code?: string }).code || String(error);
  console.error(`gen:try failed: ${reason}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
