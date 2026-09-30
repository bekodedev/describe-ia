import pg from 'pg';

export function createPool(connectionString: string): pg.Pool {
  const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 2000 });
  // An idle client can be dropped when Postgres restarts; without a listener this crashes the process.
  pool.on('error', (error) => console.error(`Idle database client error: ${error.message}`));
  return pool;
}
