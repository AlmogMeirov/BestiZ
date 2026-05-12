/**
 * User service.
 * Business logic for user-facing operations (lookups, search, profile update).
 */

import * as userRepository from '../repositories/userRepository.js';
import * as friendRepository from '../repositories/friendRepository.js';
import {
  ConflictError,
  NotFoundError,
} from '../middleware/errorHandler.js';

/**
 * Returns a public user object, enriched with their friend count.
 * The friend count is included as part of the profile view so the UI can
 * show "N friends" without an extra round-trip per profile.
 * Counting is cheap (single SQL COUNT) so this is essentially free.
 */
export const getById = async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  const friend_count = await friendRepository.countFriends(userId);
  return { ...user, friend_count };
};

export const search = ({ query, currentUserId }) =>
  userRepository.searchByUsername({ query, currentUserId });


 // Updates the current user's profile. The userId comes from the authenticated session, so a user can only update their own.
export const updateProfile = async ({ userId, updates }) => {
  if (updates.email !== undefined) {
    const taken = await userRepository.findEmailConflict({
      email: updates.email,
      userId,
    });
    if (taken) {
      throw new ConflictError('Email is already in use', {
        email_taken: true,
      });
    }
  }
  
  const updated = await userRepository.updateProfile(userId, updates);
  if (!updated) {
    throw new NotFoundError('User not found');
  }
  return updated;
};