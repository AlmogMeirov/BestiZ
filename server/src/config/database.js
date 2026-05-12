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
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  // Reasonable defaults for a small app; would be tuned in production.
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
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