/**
 * Direct message routes.
 * All endpoints here require authentication — there are no public message
 * operations. Mounted at /api/messages in app.js.
 */

import { Router } from 'express';
import * as messageController from '../controllers/messageController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// All routes below require a valid access token.
router.use(authenticate);

// Literal paths are registered BEFORE /:userId. Express matches in
// registration order, so with the parameterised route first, a request to
// /conversations would bind userId to the string "conversations" and fail
// UUID validation instead of reaching the handler meant for it.
router.get('/conversations', asyncHandler(messageController.listConversations));
router.get('/requests', asyncHandler(messageController.listRequests));
router.get('/unread-count', asyncHandler(messageController.getUnreadCount));

router.post(
  '/requests/:requestId/accept',
  asyncHandler(messageController.acceptRequest)
);
router.post(
  '/requests/:requestId/decline',
  asyncHandler(messageController.declineRequest)
);

router.post('/', asyncHandler(messageController.sendMessage));
router.get('/:userId', asyncHandler(messageController.getConversation));

export default router;
