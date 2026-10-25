/**
 * PostgreSQL connection pool.
 * A single shared pool is used across the application. 
 * node-postgres handles pooling automatically; individual queries acquire and release connections transparently.
 * For multi-statement transactions, callers should grab a dedicated client via `pool.connect()` and remember to release it.
 */

import pg from 'pg';
import { config } from './env.js';

const { Pool } = pg;

export const pool = new Pool({
  // Spread whichever shape config resolved: either a single connectionString
  // (managed provider) or the five discrete fields (local docker-compose).
  ...config.database,
  // Reasonable defaults for a small app; would be tuned in production.
  max: 20,
  idleTimeoutMillis: 30_000,
  // Managed Postgres that scales to zero needs longer than a local container
  // to answer the first connection after an idle period.
  connectionTimeoutMillis: config.database.connectionString ? 15_000 : 5_000,
});

// Surface unexpected pool errors instead of letting them silently kill connections.
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});


 // Verifies the database is reachable. 
 // Called once at startup so the server exits early if it can't connect,
 // rather than failing on the first request.
 
export const verifyDatabaseConnection = async () => {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
};