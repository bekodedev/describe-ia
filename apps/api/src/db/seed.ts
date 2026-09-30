import { loadEnv } from '../config/env.js';
import { createPool } from './pool.js';
import { seedDemoUser } from './users.js';

const pool = createPool(loadEnv().DATABASE_URL);
try {
  await seedDemoUser(pool);
  console.log('Demo user is seeded');
} finally {
  await pool.end();
}
