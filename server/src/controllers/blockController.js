/**
 * Block HTTP controllers.
 * Stays thin: validates input, calls the service, formats the response.
 * All business rules live in blockService.js.
 */

import * as blockService from '../services/blockService.js';
import {
  blockUserSchema,
  blockParamsSchema,
} from '../validators/blockValidators.js';
import { BadRequestError } from '../middleware/errorHandler.js';

// Parses an input object against a Zod schema, throwing BadRequestError with
// the first issue message on failure.
const parseWith = (schema, input) => {
  const result = schema.safeParse(input);
  if (!result.success) {
    const firstError = result.error.issues[0];
    throw new BadRequestError(firstError.message);
  }
  return result.data;
};

// GET /api/blocks
// The people the current user has blocked.
export const listBlocked = async (req, res) => {
  const blocked = await blockService.listBlocked(req.userId);
  res.status(200).json({ blocked });
};

// POST /api/blocks
// Blocks a user, removing any friendship between them.
export const blockUser = async (req, res) => {
  const { userId } = parseWith(blockUserSchema, req.body);
  const result = await blockService.blockUser({
    blockerId: req.userId,
    blockedId: userId,
  });
  res.status(200).json(result);
};

// DELETE /api/blocks/:userId
// Lifts a block. Does not restore the friendship it removed.
export const unblockUser = async (req, res) => {
  const { userId } = parseWith(blockParamsSchema, req.params);
  const result = await blockService.unblockUser({
    blockerId: req.userId,
    blockedId: userId,
  });
  res.status(200).json(result);
};
