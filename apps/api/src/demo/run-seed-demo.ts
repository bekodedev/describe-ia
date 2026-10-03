import { DEMO_USER_ID } from '../config/demo-user.js';
import { loadEnv } from '../config/env.js';
import { createPool } from '../db/pool.js';
import { seedDemoUser } from '../db/users.js';
import { createImageStore } from '../images/storage.js';
import { seedDemoProducts } from './seed-demo.js';

// pnpm --filter api seed:demo
// In Docker: docker compose exec api pnpm seed:demo
const env = loadEnv();
const pool = createPool(env.DATABASE_URL);
try {
  await seedDemoUser(pool);
  const { created, skipped } = await seedDemoProducts(pool, {
    userId: DEMO_USER_ID,
    language: env.OUTPUT_LANGUAGE,
    store: createImageStore(env.UPLOADS_DIR),
  });
  console.log(
    `Demo products: ${created} created, ${skipped} already there (language: ${env.OUTPUT_LANGUAGE})`,
  );
} finally {
  await pool.end();
}
