/**
 * Validation schemas for user endpoints.
 */

import { z } from 'zod';

export const userIdParamsSchema = z.object({
  userId: z
    .string({ required_error: 'userId is required' })
    .uuid('userId must be a valid UUID'),
});

export const searchUsersSchema = z.object({
  q: z
    .string({ required_error: 'Search query is required' })
    .trim()
    .min(1, 'Search query cannot be empty')
    .max(50, 'Search query is too long'),
});

/**
 * Body schema for PATCH /api/users/me (profile update).
 * All fields are optional — callers can update any subset.
 * At least one field must be present, otherwise there's nothing to do.
 * Bio is allowed to be an empty string (to clear it).
 * The transformation normalizes an empty trimmed value to null so the DB stores NULL rather than an empty string.
 */
export const updateProfileSchema = z
  .object({
    display_name: z
      .string()
      .trim()
      .min(1, 'Display name cannot be empty')
      .max(50, 'Display name must be at most 50 characters')
      .optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Email must be a valid email address')
      .optional(),
    bio: z
      .string()
      .max(160, 'Bio must be at most 160 characters')
      .optional()
      .transform((value) => {
        if (value === undefined) return undefined;
        const trimmed = value.trim();
        return trimmed.length === 0 ? null : trimmed;
      }),
  })
  .refine(
    (data) =>
      data.display_name !== undefined ||
      data.email !== undefined ||
      data.bio !== undefined,
    { message: 'Provide at least one field to update' }
  );