/**
 * Friends API.
 * Thin wrappers around apiClient for the friend endpoints instead of using apiClient directly.
 */

import { apiClient } from './client.js';

// Friend requests:

// Sends a friend request to the user with the given id.
export const sendRequest = async (addresseeId) => {
  const response = await apiClient.post('/api/friends/requests', {
    addresseeId,
  });
  return response.data.friendship;
};

// Lists pending requests received by the current user.
export const getIncomingRequests = async () => {
  const response = await apiClient.get('/api/friends/requests/incoming');
  return response.data.requests;
};

// Lists pending requests sent by the current user.
export const getOutgoingRequests = async () => {
  const response = await apiClient.get('/api/friends/requests/outgoing');
  return response.data.requests;
};

// Accepts a pending friend request by id.
export const acceptRequest = async (friendshipId) => {
  const response = await apiClient.post(
    `/api/friends/requests/${friendshipId}/accept`
  );
  return response.data.friendship;
};

/**
 * Deletes a friendship row.
 * Used for rejecting incoming requests, cancelling outgoing requests, and unfriending accepted friendships.
 */
export const deleteFriendship = async (friendshipId) => {
  await apiClient.delete(`/api/friends/requests/${friendshipId}`);
};

// Accepted friendships:

// Lists accepted friendships of the current user.
export const getFriends = async () => {
  const response = await apiClient.get('/api/friends');
  return response.data.friends;
};