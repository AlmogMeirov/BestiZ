/**
 * User routes.
 * All endpoints here require authentication. Mounted at /api/users in app.js.
 * Route order: specific routes (/search, /me) must come before the
 * parameterized /:userId, otherwise Express would match those literal
 * segments as a userId and fail UUID validation.
 */

import { Router } from 'express';

import * as userController from '../controllers/userController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(authenticate);

// Specific routes first.
router.get('/search', asyncHandler(userController.searchUsers));
router.patch('/me', asyncHandler(userController.updateMe));

// Parameterized route last.
router.get('/:userId', asyncHandler(userController.getById));

export default router;