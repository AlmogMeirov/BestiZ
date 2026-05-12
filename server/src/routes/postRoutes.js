/**
 * Post routes.
 * All endpoints require authentication. Mounted at /api/posts in app.js.
 * Route order: specific paths (/feed, /users/:userId) before /:postId,
 * since /:postId would otherwise match "feed" or "users" as a postId and fail UUID validation.
 */

import { Router } from 'express';

import * as postController from '../controllers/postController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// All post routes require authentication.
router.use(authenticate);

// Specific routes before parameterized ones.
router.get('/feed', asyncHandler(postController.getFeed));
router.get('/users/:userId', asyncHandler(postController.getByAuthor));

// Create / read single / update / delete.
router.post('/', asyncHandler(postController.create));
router.get('/:postId', asyncHandler(postController.getById));
router.put('/:postId', asyncHandler(postController.update));
router.delete('/:postId', asyncHandler(postController.deletePost));

export default router;