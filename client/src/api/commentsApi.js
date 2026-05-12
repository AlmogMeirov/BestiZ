/**
 * Comments API.
 * Wrappers around apiClient for the comment endpoints.
 */

import { apiClient } from './client.js';

// Gets all comments for a post, sorted by creation date (oldest first).
export const getCommentsByPost = async (postId) => {
  const response = await apiClient.get(`/api/posts/${postId}/comments`);
  return response.data.comments;
};

// Creates a new comment on a post. The comment author is the authenticated user.
export const createComment = async (postId, { content }) => {
  const response = await apiClient.post(`/api/posts/${postId}/comments`, {
    content,
  });
  return response.data.comment;
};

// Updates a comment. Only the comment author can update.
export const updateComment = async (commentId, { content }) => {
  const response = await apiClient.put(`/api/comments/${commentId}`, {
    content,
  });
  return response.data.comment;
};

// Deletes a comment. Only the comment author can delete.
export const deleteComment = async (commentId) => {
  await apiClient.delete(`/api/comments/${commentId}`);
};