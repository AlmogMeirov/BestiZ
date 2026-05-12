/**
 * Users API.
 * Thin wrappers around apiClient for the user endpoints.
 */

import { apiClient } from './client.js';


 // Searches users by username/display name (autocomplete).
export const searchUsers = async (query) => {
  const response = await apiClient.get('/api/users/search', {
    params: { q: query },
  });
  return response.data.users;
};

// Gets a user by their ID.
export const getUserById = async (userId) => {
  const response = await apiClient.get(`/api/users/${userId}`);
  return response.data.user;
};


 // Updates the authenticated user's profile.
 // Accepts an object with optional `display_name` and/or `email`.
export const updateProfile = async (updates) => {
  const response = await apiClient.patch('/api/users/me', updates);
  return response.data.user;
};