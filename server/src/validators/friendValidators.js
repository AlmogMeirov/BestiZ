/**
 * Validation schemas for friend endpoints.
 */

import { z } from 'zod';

import { requiredString } from './requiredString.js';

// Body schema for POST /api/friends/requests.
export const sendRequestSchema = z.object({
  addresseeId: requiredString('addresseeId is required')
    .uuid('addresseeId must be a valid UUID'),
});

// URL params schema for endpoints with /:id (accept, reject).
export const friendshipIdParamsSchema = z.object({
  id: requiredString('Friendship id is required')
    .uuid('Friendship id must be a valid UUID'),
});