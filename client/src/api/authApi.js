/**
 * Authentication API.
 * Thin wrappers around apiClient for the auth endpoints. Each function matches one endpoint on the server. 
 * Components should call these functions instead of using apiClient directly this keeps API knowledge in one place and makes it easy to find / change endpoints later. */

import { apiClient } from './client.js';

// Register a new user with username, email, password, and display name. Returns the created user object.
export const register = async ({ username, email, password, displayName }) => {
  const response = await apiClient.post('/api/auth/register', {
    username,
    email,
    password,
    displayName,
  });
  return response.data.user;
};

// Login with either username or email and password. Returns the authenticated user object.
export const login = async ({ identifier, password }) => {
  const response = await apiClient.post('/api/auth/login', {
    identifier,
    password,
  });
  return response.data.user;
};

// Logout the current user by clearing the session on the server. No response data expected.
export const logout = async () => {
  await apiClient.post('/api/auth/logout');
};

// Get the currently authenticated user based on the session cookie and returns the user object or null if not authenticated.
export const getMe = async () => {
  const response = await apiClient.get('/api/auth/me');
  return response.data.user;
};