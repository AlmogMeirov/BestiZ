/**
 * Validation schemas for block endpoints.
 */

import { z } from 'zod';

import { requiredString } from './requiredString.js';

// Body schema for POST /api/blocks.
export const blockUserSchema = z.object({
  userId: requiredString('userId is required')
    .uuid('userId must be a valid UUID'),
});

// URL params schema for DELETE /api/blocks/:userId.
export const blockParamsSchema = z.object({
  userId: requiredString('userId is required')
    .uuid('userId must be a valid UUID'),
});
