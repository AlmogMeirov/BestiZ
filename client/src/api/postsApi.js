/**
 * Posts API.
 * Wrappers around apiClient for the post endpoints.
 */

import { apiClient } from './client.js';

// Creates a new post. Returns the created post object.
export const createPost = async ({ content, imageUrl, visibility }) => {
  const response = await apiClient.post('/api/posts', {
    content,
    imageUrl,
    visibility,
  });
  return response.data.post;
};

// Returns the personalized feed for the current user. filter is optional: 'all', 'mine', 'friends'.
export const getFeed = async ({ before, limit, filter } = {}) => {
  const response = await apiClient.get('/api/posts/feed', {
    params: { before, limit, filter },
  });
  return response.data.posts;
};

// Returns all posts by a specific user. If the current user is not the same as the requested user, only public posts are returned.
export const getPostsByUser = async (userId, { before, limit } = {}) => {
  const response = await apiClient.get(`/api/posts/users/${userId}`, {
    params: { before, limit },
  });
  return response.data.posts;
};

// Returns a single post by ID. If the current user is not the author or a friend of the author, only public posts can be accessed.
export const getPostById = async (postId) => {
  const response = await apiClient.get(`/api/posts/${postId}`);
  return response.data.post;
};

// Updates a post. 
// Only the author can update their own posts. 
// Returns the updated post object.
export const updatePost = async (postId, updates) => {
  const response = await apiClient.put(`/api/posts/${postId}`, updates);
  return response.data.post;
};

// Deletes a post. Only the author can delete their own posts.
export const deletePost = async (postId) => {
  await apiClient.delete(`/api/posts/${postId}`);
};