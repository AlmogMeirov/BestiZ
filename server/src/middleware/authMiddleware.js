/**
 * Authentication middleware.
 * Reads the access token from the httpOnly cookie, verifies it, and attaches
 * the user id to the request as `req.userId` for downstream handlers.
 * Routes that require authentication should add `authenticate` to their
 * middleware chain. Routes that work for both authenticated and anonymous
 * users should use `optionalAuthenticate` instead.
 */

import { verifyAccessToken } from '../utils/tokens.js';
import { UnauthorizedError } from './errorHandler.js';


 // The cookie name used for the access token.
 // Exported so login/logout controllers use the same name consistently.
export const ACCESS_TOKEN_COOKIE = 'access_token';


 // The cookie name used for the refresh token.
 // Exported so login/logout controllers use the same name consistently.
export const REFRESH_TOKEN_COOKIE = 'refresh_token';


 // Strict authentication: rejects the request if the user is not logged in.
 // Use this for any endpoint that requires an authenticated user.
export const authenticate = (req, res, next) => {
  const token = req.cookies?.[ACCESS_TOKEN_COOKIE];

  if (!token) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const payload = verifyAccessToken(token);
    // Attach the user id so downstream handlers know who is making the request.
    req.userId = payload.sub;
    return next();
  } catch (err) {
    // Token expired, malformed, or signed with a different secret.
    return next(new UnauthorizedError('Invalid or expired token'));
  }
};

/**
 * Optional authentication: attaches `req.userId` if a valid token is present,
 * but doesn't reject the request if it isn't.
 * Useful for endpoints whose response varies based on whether the viewer is
 * logged in (e.g. a public profile that shows extra data to friends).
 */
export const optionalAuthenticate = (req, res, next) => {
  const token = req.cookies?.[ACCESS_TOKEN_COOKIE];

  if (!token) {
    req.userId = null;
    return next();
  }

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
  } catch {
    // Token is invalid — treat the request as anonymous rather than rejecting.
    req.userId = null;
  }

  return next();
};