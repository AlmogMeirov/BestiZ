/**
 * Blocks API.
 * Thin wrappers around apiClient for the block endpoints.
 */

import { apiClient } from './client.js';

// The people the current user has blocked. Who has blocked THEM is never
// listed — the server does not expose it.
export const getBlocked = async () => {
  const response = await apiClient.get('/api/blocks');
  return response.data.blocked;
};

// Blocks a user, which also removes any friendship between them.
export const blockUser = async (userId) => {
  const response = await apiClient.post('/api/blocks', { userId });
  return response.data;
};

// Lifts a block. Does not restore the friendship it removed.
export const unblockUser = async (userId) => {
  const response = await apiClient.delete(`/api/blocks/${userId}`);
  return response.data;
};
