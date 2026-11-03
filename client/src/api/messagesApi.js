/**
 * Messages API.
 * Thin wrappers around apiClient for the direct-message endpoints.
 */

import { apiClient } from './client.js';

// The user's inbox: friends and accepted requests, most recent first.
export const getConversations = async () => {
  const response = await apiClient.get('/api/messages/conversations');
  return response.data.conversations;
};

/**
 * One page of the conversation with another user.
 *
 * Also marks their messages as read, server-side, whenever the first page is
 * requested — so calling this IS "the user is looking at this thread". Pass
 * `before` to page back through history, which deliberately does not mark
 * anything read.
 *
 * Returns the messages plus `sendState`, `canReply` and `pendingRequestId`,
 * which together tell the UI whether to show a composer, a "waiting to be
 * accepted" notice, or Accept / Decline buttons.
 */
export const getConversation = async (userId, { before } = {}) => {
  const response = await apiClient.get(`/api/messages/${userId}`, {
    params: before ? { before } : undefined,
  });
  return response.data;
};

// Sends a message. A first message to a stranger opens a request instead of
// landing in their inbox.
export const sendMessage = async ({ recipientId, content }) => {
  const response = await apiClient.post('/api/messages', {
    recipientId,
    content,
  });
  return response.data.message;
};

// Message requests from strangers awaiting a decision.
export const getRequests = async () => {
  const response = await apiClient.get('/api/messages/requests');
  return response.data.requests;
};

// Accepts a request, opening the conversation both ways.
export const acceptRequest = async (requestId) => {
  const response = await apiClient.post(
    `/api/messages/requests/${requestId}/accept`
  );
  return response.data.request;
};

// Declines a request. The sender is never told.
export const declineRequest = async (requestId) => {
  await apiClient.post(`/api/messages/requests/${requestId}/decline`);
};

// Unread messages and pending requests, counted separately.
export const getUnreadCount = async () => {
  const response = await apiClient.get('/api/messages/unread-count');
  return response.data;
};
