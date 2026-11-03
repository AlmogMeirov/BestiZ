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

/**
 * Runs several queries inside one transaction.
 *
 * Repository functions take an optional `client` so a service can compose
 * writes across more than one table atomically:
 *
 *     await withTransaction(async (client) => {
 *       await messageRepository.create({ ... }, client);
 *       await messageRequestRepository.create({ ... }, client);
 *     });
 *
 * The transaction boundary belongs to the business operation, not to any one
 * table, which is why this is invoked from the service rather than hidden
 * inside a repository. Committing, rolling back and releasing the connection
 * all happen here, so no caller can leak a client by forgetting to.
 */
export const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};