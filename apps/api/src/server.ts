import { createApp } from './app.js';
import { EnvError, loadEnv } from './config/env.js';
import { createPool } from './db/pool.js';

function main(): void {
  const env = loadEnv();
  const app = createApp(createPool(env.DATABASE_URL));
  app.listen(env.PORT, () => console.log(`API listening on port ${env.PORT}`));
}

try {
  main();
} catch (error) {
  if (!(error instanceof EnvError)) throw error;
  console.error(error.message);
  process.exit(1);
}
