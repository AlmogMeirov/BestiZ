/**
 * Block routes.
 * All endpoints here require authentication. Mounted at /api/blocks in app.js.
 */

import { Router } from 'express';
import * as blockController from '../controllers/blockController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// All routes below require a valid access token.
router.use(authenticate);

router.get('/', asyncHandler(blockController.listBlocked));
router.post('/', asyncHandler(blockController.blockUser));
router.delete('/:userId', asyncHandler(blockController.unblockUser));

export default router;
