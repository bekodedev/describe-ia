import { DEMO_USER_ID } from '../config/demo-user.js';
import { loadEnv } from '../config/env.js';
import { createPool } from '../db/pool.js';
import { InvalidOutputError } from './errors.js';
import { defaultDeps, generateDescriptions } from './service.js';

// Dev script: pnpm --filter api gen:try "<title>" "<category>" [v1|v2]   (v2 by default)
const [title, category, version = 'v2'] = process.argv.slice(2);
if (!title || !category || (version !== 'v1' && version !== 'v2')) {
  console.error('Usage: gen:try "<title>" "<category>" [v1|v2]');
  process.exit(1);
}

const pool = createPool(loadEnv().DATABASE_URL);
try {
  const { rawText, descriptions } = await generateDescriptions(
    pool,
    { userId: DEMO_USER_ID, title, category },
    { ...defaultDeps(), promptVersion: version },
  );
  console.log('--- RAW RESPONSE ---\n' + rawText);
  console.log('\n--- PARSED ---');
  for (const d of descriptions) console.log(`[${d.variant}] ${d.content}`);
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
