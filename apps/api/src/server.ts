import { createApp } from './app.js';
import { EnvError, loadEnv } from './config/env.js';
import { createPool } from './db/pool.js';
import { createImageStore } from './images/storage.js';

function main(): void {
  const env = loadEnv();
  const app = createApp(createPool(env.DATABASE_URL), {
    imageStore: createImageStore(env.UPLOADS_DIR),
    maxImageBytes: env.MAX_IMAGE_BYTES,
  });
  app.listen(env.PORT, () => console.log(`API listening on port ${env.PORT}`));
}

try {
  main();
} catch (error) {
  if (!(error instanceof EnvError)) throw error;
  console.error(error.message);
  process.exit(1);
}
