/**
 * Validation schemas for message endpoints.
 */

import { z } from 'zod';

import { requiredString } from './requiredString.js';

/**
 * Body schema for POST /api/messages.
 *
 * The 2000 character ceiling matches the `message_max_length` CHECK
 * constraint in the schema. Keeping the two in step means an over-long
 * message is refused here with a readable message rather than reaching
 * Postgres and coming back as a constraint violation.
 */
export const sendMessageSchema = z.object({
  recipientId: requiredString('recipientId is required')
    .uuid('recipientId must be a valid UUID'),

  content: requiredString('Content is required')
    .trim()
    .min(1, 'Content cannot be empty')
    .max(2000, 'Content cannot exceed 2000 characters'),
});

/**
 * URL params schema for /api/messages/:userId — the other participant in the
 * conversation.
 */
export const conversationParamsSchema = z.object({
  userId: requiredString('userId is required')
    .uuid('userId must be a valid UUID'),
});

/**
 * Query string schema for a conversation page. Same cursor pagination shape
 * the feed uses: an ISO timestamp to page backwards from, and a limit.
 */
export const conversationQuerySchema = z.object({
  before: z
    .string()
    .datetime({ message: 'before must be an ISO 8601 datetime' })
    .optional(),

  limit: z
    .string()
    .regex(/^\d+$/, 'limit must be a positive integer')
    .transform((value) => Number(value))
    .pipe(z.number().int().min(1).max(100))
    .optional(),
});

/**
 * URL params schema for /api/messages/requests/:requestId/accept and
 * .../decline.
 */
export const requestIdParamsSchema = z.object({
  requestId: requiredString('requestId is required')
    .uuid('requestId must be a valid UUID'),
});
