import { DEMO_USER_ID } from '../config/demo-user.js';
import { loadEnv } from '../config/env.js';
import { createPool } from '../db/pool.js';
import { complete, textOf } from './client.js';
import { estimateCostUsd } from './pricing.js';
import { recordLlmCall } from './record.js';

// Smallest real call: proves the key, the model and the llm_calls bookkeeping all work.
const env = loadEnv();
const pool = createPool(env.DATABASE_URL);

try {
  const { response } = await recordLlmCall(
    pool,
    { userId: DEMO_USER_ID, promptVersion: 'ping', model: env.LLM_MODEL },
    () =>
      complete({
        messages: [{ role: 'user', content: 'Reply with the single word: pong' }],
        maxTokens: 20,
      }),
    textOf,
  );
  const cost = estimateCostUsd(response.model, response.usage);
  console.log(`reply:   ${textOf(response).trim()}`);
  console.log(`model:   ${response.model}`);
  console.log(`tokens:  ${response.usage.inputTokens} in / ${response.usage.outputTokens} out`);
  console.log(`cost:    ${cost === null ? 'unknown model' : `$${cost.toFixed(6)}`}`);
  console.log(`latency: ${response.latencyMs} ms`);
} catch (error) {
  console.error(`ping failed: ${(error as Error).message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
