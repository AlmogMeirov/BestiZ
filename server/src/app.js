/**
 * Express application setup.
 * This module builds the Express app and registers global middleware.
 * Feature routers are mounted here under their URL prefixes.
 * Kept separate from `index.js` so the app can be imported for testing
 * without starting an HTTP server.
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

import { config } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import friendRoutes from './routes/friendRoutes.js';
import postRoutes from './routes/postRoutes.js';
import {
  postCommentsRouter,
  commentsRouter,
} from './routes/commentRoutes.js';

export const buildApp = () => {
  const app = express();

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

  // Feature routes.
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/posts', postRoutes);
  // Comments under a post (POST/GET /api/posts/:postId/comments).
  app.use('/api/posts/:postId/comments', postCommentsRouter);
  // Comments by id (PUT/DELETE /api/comments/:commentId).
  app.use('/api/comments', commentsRouter);
  app.use('/api', friendRoutes);

  // Error handler must be registered LAST, after all routes.
  app.use(errorHandler);

  return app;
};