/**
 * Zod schemas for authentication endpoints.
 * Centralizing validation here keeps controllers thin and makes the rules
 * easy to find and update. Each schema defines the expected shape and constraints of a request body.
 */

import { z } from 'zod';

/**
 * Strong password requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one special character
 * These rules add meaningful entropy: each requirement multiplies the search space attackers must brute-force through.
 * We don't require digits or lowercase because uppercase + special already provide strong character variety.
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password is too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/,
    'Password must contain at least one special character'
  );

/**
 * Schema for user registration.
 * - username: 3-30 characters, alphanumeric and underscores only.
 * - email: must be a valid email format.
 * - password: see passwordSchema above.
 * - displayName: 1-50 characters, used as the public-facing name.
 */
export const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'Username can only contain letters, numbers, and underscores'
    ),
  email: z.string().email('Invalid email address').max(255),
  password: passwordSchema,
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(50, 'Display name must be at most 50 characters')
    .trim(),
});

/**
 * Schema for user login.
 * Accepts either email or username as the identifier so users can log in with either.
 * Password validation is intentionally lenient here — strict rules on length
 * could leak which accounts have weak old passwords.
 */
export const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, 'Email or username is required')
    .max(255),
  password: z.string().min(1, 'Password is required'),
});