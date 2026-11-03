/**
 * Direct message HTTP controllers.
 * Stays thin: validates input, calls the service, formats the response.
 * All business rules live in messageService.js.
 */

import * as messageService from '../services/messageService.js';
import {
  sendMessageSchema,
  conversationParamsSchema,
  conversationQuerySchema,
  requestIdParamsSchema,
} from '../validators/messageValidators.js';
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

// GET /api/messages/conversations
// The user's inbox: accepted and friend conversations, most recent first.
export const listConversations = async (req, res) => {
  const conversations = await messageService.listConversations(req.userId);
  res.status(200).json({ conversations });
};

// GET /api/messages/requests
// Message requests from strangers awaiting this user's decision.
export const listRequests = async (req, res) => {
  const requests = await messageService.listRequests(req.userId);
  res.status(200).json({ requests });
};

// GET /api/messages/unread-count
// Unread messages and pending requests, counted separately.
export const getUnreadCount = async (req, res) => {
  const counts = await messageService.getUnreadCount(req.userId);
  res.status(200).json(counts);
};

// POST /api/messages/requests/:requestId/accept
// Opens the conversation both ways.
export const acceptRequest = async (req, res) => {
  const { requestId } = parseWith(requestIdParamsSchema, req.params);
  const request = await messageService.acceptRequest({
    requestId,
    currentUserId: req.userId,
  });
  res.status(200).json({ request });
};

// POST /api/messages/requests/:requestId/decline
// Blocks further messages from the sender, silently.
export const declineRequest = async (req, res) => {
  const { requestId } = parseWith(requestIdParamsSchema, req.params);
  await messageService.declineRequest({
    requestId,
    currentUserId: req.userId,
  });
  res.status(204).end();
};

// GET /api/messages/:userId
// One page of the conversation with another user, plus whether the viewer may
// reply. Marks the other person's messages read on the first page of an open
// conversation.
export const getConversation = async (req, res) => {
  const { userId } = parseWith(conversationParamsSchema, req.params);
  const { before, limit } = parseWith(conversationQuerySchema, req.query);

  const conversation = await messageService.getConversation({
    userId: req.userId,
    otherUserId: userId,
    before,
    limit,
  });

  res.status(200).json(conversation);
};

// POST /api/messages
// Sends a message. A first message to a stranger opens a request instead of
// landing in their inbox.
export const sendMessage = async (req, res) => {
  const { recipientId, content } = parseWith(sendMessageSchema, req.body);

  const message = await messageService.sendMessage({
    senderId: req.userId,
    recipientId,
    content,
  });

  res.status(201).json({ message });
};
