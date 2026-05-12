/**
 * Server entry point.
 * Verifies the database is reachable, builds the Express app, starts
 * the HTTP server, and attaches Socket.IO for real-time updates.
 */

import { createServer } from 'http';

import { buildApp } from './app.js';
import { config } from './config/env.js';
import { verifyDatabaseConnection, pool } from './config/database.js';
import { initSocketServer } from './socket/socketServer.js';

const main = async () => {
  // Fail fast if the DB isn't reachable.
  await verifyDatabaseConnection();
  console.log('Database connection verified.');

  const app = buildApp();

  // Wrap Express in an http.Server so Socket.IO can attach to the same instance.
  const httpServer = createServer(app);

  // Attach Socket.IO to the same HTTP server. Real-time features come online alongside the REST API on the same port.
  initSocketServer(httpServer);
  console.log('Socket.IO server initialized.');

  httpServer.listen(config.server.port, () => {
    console.log(`Server listening on port ${config.server.port} (${config.env})`);
  });

  // Graceful shutdown: drain DB connections so we don't leave them hanging.
  const shutdown = async (signal) => {
    console.log(`Received ${signal}, shutting down gracefully.`);
    httpServer.close(() => {
      console.log('HTTP server closed.');
    });
    await pool.end();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});