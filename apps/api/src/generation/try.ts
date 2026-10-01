import { DEMO_USER_ID } from '../config/demo-user.js';
import { loadEnv } from '../config/env.js';
import { createPool } from '../db/pool.js';
import { InvalidOutputError } from './parse.js';
import { generateDescriptions } from './service.js';

// Dev script: pnpm --filter api gen:try "<title>" "<category>"
const [title, category] = process.argv.slice(2);
if (!title || !category) {
  console.error('Usage: gen:try "<title>" "<category>"');
  process.exit(1);
}

const pool = createPool(loadEnv().DATABASE_URL);
try {
  const { rawText, descriptions } = await generateDescriptions(pool, {
    userId: DEMO_USER_ID,
    title,
    category,
  });
  console.log('--- RAW RESPONSE ---\n' + rawText);
  console.log('\n--- PARSED ---');
  for (const d of descriptions) console.log(`[${d.variant}] ${d.content}`);
} catch (error) {
  if (error instanceof InvalidOutputError)
    console.log('--- RAW RESPONSE ---\n' + error.text + '\n');
  console.error(`gen:try failed: ${(error as Error).message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
