/**
 * Comment routes.
 * Comments are accessed via two different URL patterns:
 *  1. POST/GET /api/posts/:postId/comments, actions scoped to a specific post (creating, listing).
 *  2. PUT/DELETE /api/comments/:commentId, actions on a specific comment by its own id.
 * We export two routers and mount each at its own base path in app.js.
 * All routes require authentication.
 */

import { Router } from 'express';

import * as commentController from '../controllers/commentController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

 // Nested under /api/posts/:postId, for actions scoped to a post.
 // Uses mergeParams so :postId from the parent route is accessible here.
export const postCommentsRouter = Router({ mergeParams: true });
postCommentsRouter.use(authenticate);
postCommentsRouter.post('/', asyncHandler(commentController.create));
postCommentsRouter.get('/', asyncHandler(commentController.getByPost));

 // Mounted at /api/comments, for actions on a specific comment by id.
export const commentsRouter = Router();
commentsRouter.use(authenticate);
commentsRouter.put('/:commentId', asyncHandler(commentController.update));
commentsRouter.delete('/:commentId', asyncHandler(commentController.deleteComment));