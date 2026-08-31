/**
 * apiClient.js
 * A single shared instance is used for all API requests in the app.
 * Centralizing the configuration here means:
 *  - One place to change the base URL.
 *  - One place to enable cookies (withCredentials).
 *  - One place to add interceptors (logging, error handling).
 *
 * Silent token refresh
 * --------------------
 * Access tokens live 15 minutes; refresh tokens live 7 days. When a request
 * comes back 401 because the access token expired, the response interceptor
 * calls POST /api/auth/refresh once, then replays the original request. The
 * user never sees the expiry.
 *
 * Two details that matter:
 *  - Single-flight: if several requests fail at once (a feed page load, say),
 *    they all await the SAME refresh promise instead of firing several refresh
 *    calls and rotating the token out from under each other.
 *  - No retry loops: a request is retried at most once (`_retried`), and the
 *    auth endpoints themselves are excluded so a failed refresh can't trigger
 *    another refresh.
 */

import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export const apiClient = axios.create({
  baseURL,
  // Send cookies with every request so the server receives the auth tokens.
  withCredentials: true,
  // Default headers for JSON requests.
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Endpoints that must never trigger a refresh attempt.
 * A 401 from any of these is a real authentication failure (bad credentials,
 * dead refresh token), not an expired access token.
 */
const NO_REFRESH_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
];

/**
 * Called when refreshing fails and the session is genuinely over.
 * AuthContext registers a handler here so it can clear the user and drop the
 * socket connection. Kept as a callback rather than an import to avoid a
 * circular dependency between the API layer and React state.
 */
let onSessionExpired = null;

export const setSessionExpiredHandler = (handler) => {
  onSessionExpired = handler;
};

// Holds the in-flight refresh request, or null when none is running.
let refreshPromise = null;

const refreshSession = () => {
  if (!refreshPromise) {
    refreshPromise = apiClient.post('/api/auth/refresh').finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    // Network error, or a failure we have no way to recover from.
    if (status !== 401 || !originalRequest) {
      return Promise.reject(error);
    }

    // Already retried once, or an auth endpoint - don't loop.
    if (
      originalRequest._retried ||
      NO_REFRESH_PATHS.some((path) => originalRequest.url?.startsWith(path))
    ) {
      return Promise.reject(error);
    }

    originalRequest._retried = true;

    try {
      await refreshSession();
      // New cookies are set; replay the original request.
      return apiClient(originalRequest);
    } catch {
      // The refresh token is gone or invalid: the session is really over.
      onSessionExpired?.();
      return Promise.reject(error);
    }
  }
);