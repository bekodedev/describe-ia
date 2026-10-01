import pg from 'pg';

// Anything that can run a query: a Pool, or a client inside a transaction.
export interface Db {
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<pg.QueryResult<R>>;
}

export function createPool(connectionString: string): pg.Pool {
  const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 2000 });
  // An idle client can be dropped when Postgres restarts; without a listener this crashes the process.
  pool.on('error', (error) => console.error(`Idle database client error: ${error.message}`));
  return pool;
}

// BEGIN / COMMIT around `work`, rolled back if it throws.
export async function withTransaction<T>(pool: pg.Pool, work: (db: Db) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
