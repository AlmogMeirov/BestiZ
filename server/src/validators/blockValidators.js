/**
 * Validation schemas for block endpoints.
 */

import { z } from 'zod';

// Body schema for POST /api/blocks.
export const blockUserSchema = z.object({
  userId: z
    .string({ required_error: 'userId is required' })
    .uuid('userId must be a valid UUID'),
});

// URL params schema for DELETE /api/blocks/:userId.
export const blockParamsSchema = z.object({
  userId: z
    .string({ required_error: 'userId is required' })
    .uuid('userId must be a valid UUID'),
});
