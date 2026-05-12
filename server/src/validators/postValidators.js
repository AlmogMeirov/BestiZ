/**
 * Validation schemas for post endpoints.
 * Uses Zod to define and enforce the expected structure of request bodies, URL parameters, and query strings for all post-related routes.
 * This ensures that incoming data is validated and sanitized before reaching the controllers.
 */

import { z } from 'zod';

/**
 * Body schema for POST /api/posts.
 * - content: required, 1-5000 chars (matches DB CHECK constraint).
 * - imageUrl: optional, must be a valid URL if provided.
 * - visibility: one of the enum values, defaults to 'public'.
 */
export const createPostSchema = z.object({
  content: z
    .string({ required_error: 'Content is required' })
    .trim()
    .min(1, 'Content cannot be empty')
    .max(5000, 'Content cannot exceed 5000 characters'),

  imageUrl: z
    .string()
    .trim()
    .url('Image URL must be a valid URL')
    .max(2000, 'Image URL is too long')
    .optional()
    .or(z.literal('').transform(() => undefined)),

  visibility: z
    .enum(['public', 'friends', 'private'], {
      errorMap: () => ({
        message: 'Visibility must be public, friends, or private',
      }),
    })
    .default('public'),
});

/**
 * Body schema for PUT /api/posts/:postId.
 * All fields are optional — the client sends only what it wants to change.
 * At least one field must be present (enforced via .refine).
 */
export const updatePostSchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(1, 'Content cannot be empty')
      .max(5000, 'Content cannot exceed 5000 characters')
      .optional(),

    imageUrl: z
      .string()
      .trim()
      .url('Image URL must be a valid URL')
      .max(2000, 'Image URL is too long')
      .nullable()
      .optional()
      .or(z.literal('').transform(() => null)),

    visibility: z
      .enum(['public', 'friends', 'private'], {
        errorMap: () => ({
          message: 'Visibility must be public, friends, or private',
        }),
      })
      .optional(),
  })
  .refine(
    (data) =>
      data.content !== undefined ||
      data.imageUrl !== undefined ||
      data.visibility !== undefined,
    { message: 'At least one field must be provided to update' }
  );

 // URL params schema for /api/posts/:postId.
export const postIdParamsSchema = z.object({
  postId: z
    .string({ required_error: 'postId is required' })
    .uuid('postId must be a valid UUID'),
});


 // URL params schema for /api/posts/users/:userId.
export const userIdParamsSchema = z.object({
  userId: z
    .string({ required_error: 'userId is required' })
    .uuid('userId must be a valid UUID'),
});

/**
 * Query string schema for feed and user-posts endpoints.
 * Supports cursor pagination via `before` (ISO timestamp) and `limit`,
 * plus an optional `filter` for the feed: 'all' | 'mine' | 'friends'.
 * The filter is only used by the feed endpoint; user-posts ignores it.
 */
export const feedQuerySchema = z.object({
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

  filter: z.enum(['all', 'mine', 'friends']).optional(),
});