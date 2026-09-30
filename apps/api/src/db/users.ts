import { DEMO_USER_EMAIL, DEMO_USER_ID, DEMO_USER_NAME } from '../config/demo-user.js';
import type { Db } from './pool.js';

// Safe to run any number of times.
export async function seedDemoUser(db: Db): Promise<void> {
  await db.query(
    `INSERT INTO users (id, email, name) VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [DEMO_USER_ID, DEMO_USER_EMAIL, DEMO_USER_NAME],
  );
}
