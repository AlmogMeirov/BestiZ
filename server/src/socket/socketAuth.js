/**
 * Socket.IO authentication middleware.
 * Verifies the JWT access token from the connecting client. Tokens can
 * arrive in two ways:
 *  1. The `auth` payload set via socket.io-client's `auth` option.
 *  2. The httpOnly cookie sent with the upgrade request.
 * On success, the user id is attached to `socket.data.userId` for use by
 * downstream event handlers.
 */

import { verifyAccessToken } from '../utils/tokens.js';
import { ACCESS_TOKEN_COOKIE } from '../middleware/authMiddleware.js';

// Parses a Cookie header string into an object of key-value pairs.
const parseCookieHeader = (header) => {
  const cookies = {};
  if (!header) return cookies;
  const pairs = header.split(';');
  for (const pair of pairs) {
    const index = pair.indexOf('=');
    if (index === -1) continue;
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (name) {
      try {
        cookies[name] = decodeURIComponent(value);
      } catch {
        cookies[name] = value;
      }
    }
  }
  return cookies;
};

// Extracts the JWT token from either the `auth` payload or the cookies.
const extractToken = (socket) => {
  const fromAuth = socket.handshake.auth?.token;
  if (fromAuth) return fromAuth;

  const cookies = parseCookieHeader(socket.handshake.headers?.cookie);
  return cookies[ACCESS_TOKEN_COOKIE] || null;
};

// The main authentication middleware function for Socket.IO.
export const socketAuth = (socket, next) => {
  const token = extractToken(socket);
  if (!token) {
    return next(new Error('Authentication required'));
  }
  try {
    // The JWT payload uses `sub` (standard JWT claim for subject/user id).
    const payload = verifyAccessToken(token);
    if (!payload.sub) {
      return next(new Error('Invalid token payload'));
    }
    socket.data.userId = payload.sub;
    next();
  } catch (err) {
    next(new Error('Invalid or expired token'));
  }
};