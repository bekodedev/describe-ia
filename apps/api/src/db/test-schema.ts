import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runner } from 'node-pg-migrate';
import pg from 'pg';

// Test helper: runs the real migrations in a throwaway schema, so the dev data is untouched.
export async function createTestSchema(databaseUrl: string) {
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  await runner({
    databaseUrl,
    dir: fileURLToPath(new URL('../../migrations', import.meta.url)),
    direction: 'up',
    migrationsTable: 'pgmigrations',
    schema,
    createSchema: true,
    log: () => {},
  });
  const pool = new pg.Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });

  async function drop() {
    await pool.end();
    const admin = new pg.Client({ connectionString: databaseUrl });
    await admin.connect();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
  return { pool, drop };
}
