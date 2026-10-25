/**
 * Express application setup.
 * This module builds the Express app and registers global middleware.
 * Feature routers are mounted here under their URL prefixes.
 * Kept separate from `index.js` so the app can be imported for testing
 * without starting an HTTP server.
 */

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';

import { config } from './config/env.js';
import { apiLimiter } from './middleware/rateLimiters.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import friendRoutes from './routes/friendRoutes.js';
import postRoutes from './routes/postRoutes.js';
import {
  postCommentsRouter,
  commentsRouter,
} from './routes/commentRoutes.js';

// Absolute path to the built client, resolved relative to this file so it
// works regardless of the directory the process was started from.
const CLIENT_DIST = join(dirname(fileURLToPath(import.meta.url)), '../../client/dist');

export const buildApp = () => {
  const app = express();

  // How many reverse proxies sit in front of us. Behind a platform proxy this
  // has to be set, or express-rate-limit counts every user under the proxy's
  // single IP and one busy visitor locks out everyone else.
  app.set('trust proxy', config.trustProxy);

  // Security headers. Registered first so every response carries them,
  // including error responses and 404s.
  app.use(
    helmet({
      // In development the client runs on the Vite dev server at another
      // origin, so `same-origin` (helmet's default) would block its reads.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          // Posts carry image URLs pointing at arbitrary hosts, so the default
          // `img-src 'self' data:` would break every post with a picture.
          'img-src': ["'self'", 'data:', 'https:'],
          // The client opens a Socket.IO connection; without this the default
          // `connect-src 'self'` blocks the websocket in a same-origin deploy.
          'connect-src': ["'self'", 'ws:', 'wss:'],
        },
      },
    })
  );

  // CORS: allow the client origin and credentials so httpOnly auth cookies work.
  app.use(
    cors({
      origin: config.client.url,
      credentials: true,
    })
  );

  // Body parsing.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Cookie parsing for JWT tokens stored as httpOnly cookies.
  app.use(cookieParser());

  // Health check endpoint - useful for Docker healthchecks and uptime monitoring.
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // General rate limit across the whole API. The stricter budget for login and
  // registration is applied inside authRoutes, closer to the endpoints it
  // protects. Mounted after /health so uptime checks are never throttled.
  app.use('/api', apiLimiter);

  // Feature routes.
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/posts', postRoutes);
  // Comments under a post (POST/GET /api/posts/:postId/comments).
  app.use('/api/posts/:postId/comments', postCommentsRouter);
  // Comments by id (PUT/DELETE /api/comments/:commentId).
  app.use('/api/comments', commentsRouter);
  app.use('/api', friendRoutes);

  // In a single-origin deployment this process also serves the built client.
  // Registered AFTER the API routes so nothing here can shadow them.
  if (config.serveClient) {
    app.use(express.static(CLIENT_DIST));

    // Client-side routing: any non-API path that didn't match a file is a
    // React Router route, so hand back index.html and let the browser resolve
    // it. /api is excluded explicitly — an unknown API path must return a JSON
    // 404, not an HTML page that the client would fail to parse.
    app.get(/^(?!\/api).*/, (req, res) => {
      res.sendFile(join(CLIENT_DIST, 'index.html'));
    });
  }

  // Error handler must be registered LAST, after all routes.
  app.use(errorHandler);

  return app;
};