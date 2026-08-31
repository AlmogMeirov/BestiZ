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
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Public endpoints no authentication required.
router.post('/register', asyncHandler(authController.register));
router.post('/login', asyncHandler(authController.login));
// Reads the refresh cookie rather than the access cookie, so it must stay
// public — the access token is expired by the time this is called.
router.post('/refresh', asyncHandler(authController.refresh));
router.post('/logout', authController.logout);

// Protected endpoint requires a valid access token.
router.get('/me', authenticate, asyncHandler(authController.me));

export default router;