/**
 * User HTTP controllers.
 * Stays thin: validates input, calls the service, formats the response.
 * Owns endpoints under /api/users.
 */

import * as userService from '../services/userService.js';
import {
  userIdParamsSchema,
  searchUsersSchema,
  updateProfileSchema,
} from '../validators/userValidators.js';
import { BadRequestError } from '../middleware/errorHandler.js';

const parseWith = (schema, input) => {
  const result = schema.safeParse(input);
  if (!result.success) {
    const firstError = result.error.issues[0];
    throw new BadRequestError(firstError.message);
  }
  return result.data;
};


 // GET /api/users/search?q=...
 // Returns users matching the query (autocomplete for adding friends).
export const searchUsers = async (req, res) => {
  const { q } = parseWith(searchUsersSchema, req.query);
  const users = await userService.search({
    query: q,
    currentUserId: req.userId,
  });
  res.status(200).json({ users });
};


 // GET /api/users/:userId
 // Returns the public profile of the requested user.
export const getById = async (req, res) => {
  const { userId } = parseWith(userIdParamsSchema, req.params);
  const user = await userService.getById(userId);
  res.status(200).json({ user });
};

/**
 * PATCH /api/users/me
 * Updates the authenticated user's profile (display_name and/or email).
 * Only the owner can update their profile — the userId comes from the
 * authenticated session, never from the URL or body, so a user cannot
 * tamper with whose profile they're editing.
 */
export const updateMe = async (req, res) => {
  const updates = parseWith(updateProfileSchema, req.body);
  const user = await userService.updateProfile({
    userId: req.userId,
    updates,
  });
  res.status(200).json({ user });
};