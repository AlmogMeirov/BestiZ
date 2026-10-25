/**
 * Migration runner.
 *
 * Locally, docker-compose mounts the migrations directory into
 * /docker-entrypoint-initdb.d, and Postgres applies it automatically the first
 * time the container's data volume is created. Managed providers have no such
 * hook: you point the app at an empty database and nothing runs. This script
 * fills that gap.
 *
 * Run with:  npm run migrate
 *
 * It records what it has applied in a `schema_migrations` table, so running it
 * twice is safe and only genuinely new files execute. Without that ledger a
 * second run would die on `CREATE TABLE users` already existing, and the usual
 * workaround — sprinkling IF NOT EXISTS everywhere — hides real drift instead
 * of reporting it.
 *
 * Each file runs inside its own transaction. A migration that fails halfway
 * rolls back completely and is not recorded, so a retry starts from a clean
 * state rather than a partially-applied schema.
 */

import { readdir, readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { pool } from '../config/database.js';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

const ensureLedger = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

const migrate = async () => {
  const client = await pool.connect();

  try {
    await ensureLedger(client);

    const { rows } = await client.query('SELECT filename FROM schema_migrations');
    const applied = new Set(rows.map((row) => row.filename));

    // Sorted by filename, which is why migrations are numbered: 001_, 002_.
    const files = (await readdir(MIGRATIONS_DIR))
      .filter((name) => name.endsWith('.sql'))
      .sort();

    const pending = files.filter((name) => !applied.has(name));

    if (pending.length === 0) {
      console.log(`Database is up to date (${applied.size} migration(s) applied).`);
      return;
    }

    for (const filename of pending) {
      const sql = await readFile(join(MIGRATIONS_DIR, filename), 'utf8');

      console.log(`Applying ${filename}...`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${filename} failed: ${error.message}`);
      }
    }

    console.log(`\nApplied ${pending.length} migration(s).`);
  } finally {
    client.release();
  }
};

migrate()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error('\nMigration failed:', error.message);
    await pool.end();
    process.exit(1);
  });
