/**
 * Friend / friendship routes.
 * All endpoints here require authentication, no public friend operations.
 * Mounted at /api in app.js, so paths below are relative to /api.
 */

import { Router } from 'express';
import * as friendController from '../controllers/friendController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// All routes below require a valid access token.
router.use(authenticate);

// Friend requests
router.post('/friends/requests', asyncHandler(friendController.sendRequest));
router.get(
  '/friends/requests/incoming',
  asyncHandler(friendController.listIncomingRequests)
);
router.get(
  '/friends/requests/outgoing',
  asyncHandler(friendController.listOutgoingRequests)
);
router.post(
  '/friends/requests/:id/accept',
  asyncHandler(friendController.acceptRequest)
);
router.delete(
  '/friends/requests/:id',
  asyncHandler(friendController.deleteFriendship)
);

// Friends list
router.get('/friends', asyncHandler(friendController.listFriends));

export default router;