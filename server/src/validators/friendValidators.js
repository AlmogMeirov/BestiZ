/**
 * Validation schemas for friend endpoints.
 */

import { z } from 'zod';

// Body schema for POST /api/friends/requests.
export const sendRequestSchema = z.object({
  addresseeId: z
    .string({ required_error: 'addresseeId is required' })
    .uuid('addresseeId must be a valid UUID'),
});

// URL params schema for endpoints with /:id (accept, reject).
export const friendshipIdParamsSchema = z.object({
  id: z
    .string({ required_error: 'Friendship id is required' })
    .uuid('Friendship id must be a valid UUID'),
});