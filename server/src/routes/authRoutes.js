/**
 * Authentication routes.
 * Maps URL paths to controller functions and attaches middleware where needed.
 * Routes are registered under /api/auth in app.js.
 * All async controllers are wrapped with `asyncHandler` so rejected promises
 * are forwarded to the error handler instead of crashing the server.
 */

import { Router } from 'express';

import * as authController from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authLimiter } from '../middleware/rateLimiters.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Public endpoints no authentication required.
// `authLimiter` covers only the two endpoints that check credentials. It is
// deliberately NOT on /refresh: that one fires automatically for every active
// user when their access token expires, so a strict budget there would log
// people out for browsing normally.
router.post('/register', authLimiter, asyncHandler(authController.register));
router.post('/login', authLimiter, asyncHandler(authController.login));
// Reads the refresh cookie rather than the access cookie, so it must stay
// public — the access token is expired by the time this is called.
router.post('/refresh', asyncHandler(authController.refresh));
router.post('/logout', authController.logout);

// Protected endpoint requires a valid access token.
router.get('/me', authenticate, asyncHandler(authController.me));

export default router;