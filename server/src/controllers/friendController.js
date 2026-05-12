/**
 * Friend / friendship HTTP controllers.
 * Stays thin: validates input, calls the service, formats the response.
 * All business rules live in friendService.js.
 */

import * as friendService from '../services/friendService.js';
import {
  sendRequestSchema,
  friendshipIdParamsSchema,
} from '../validators/friendValidators.js';
import { BadRequestError } from '../middleware/errorHandler.js';


 // Parses an input object against a Zod schema, throwing BadRequestError with the first issue message on failure.
const parseWith = (schema, input) => {
  const result = schema.safeParse(input);
  if (!result.success) {
    const firstError = result.error.issues[0];
    throw new BadRequestError(firstError.message);
  }
  return result.data;
};

// POST /api/friends/requests
// Sends a friend request to another user.
export const sendRequest = async (req, res) => {
  const { addresseeId } = parseWith(sendRequestSchema, req.body);
  const friendship = await friendService.sendRequest({
    requesterId: req.userId,
    addresseeId,
  });
  res.status(201).json({ friendship });
};


 // POST /api/friends/requests/:id/accept
 // Accepts an incoming friend request.
export const acceptRequest = async (req, res) => {
  const { id } = parseWith(friendshipIdParamsSchema, req.params);
  const friendship = await friendService.acceptRequest({
    friendshipId: id,
    currentUserId: req.userId,
  });
  res.status(200).json({ friendship });
};


 // DELETE /api/friends/requests/:id
 // Rejects an incoming request, cancels an outgoing one, or unfriends.
export const deleteFriendship = async (req, res) => {
  const { id } = parseWith(friendshipIdParamsSchema, req.params);
  await friendService.deleteFriendship({
    friendshipId: id,
    currentUserId: req.userId,
  });
  res.status(204).end();
};


 // GET /api/friends/requests/incoming
 // Lists pending friend requests received by the current user.
export const listIncomingRequests = async (req, res) => {
  const requests = await friendService.listIncomingRequests(req.userId);
  res.status(200).json({ requests });
};


 // GET /api/friends/requests/outgoing
 // Lists pending friend requests sent by the current user.
export const listOutgoingRequests = async (req, res) => {
  const requests = await friendService.listOutgoingRequests(req.userId);
  res.status(200).json({ requests });
};


 // GET /api/friends
 // Lists the current user's accepted friends.
export const listFriends = async (req, res) => {
  const friends = await friendService.listFriends(req.userId);
  res.status(200).json({ friends });
};