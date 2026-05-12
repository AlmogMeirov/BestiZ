/**
  * apiClient.js
 * A single shared instance is used for all API requests in the app.
 * Centralizing the configuration here means:
 *  - One place to change the base URL.
 *  - One place to enable cookies (withCredentials).
 *  - One place to add interceptors (logging, error handling) in the future.
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