/**
 * Authentication controllers.js
 *
 * This file defines the controller functions for authentication-related routes.
 * Each function corresponds to an API endpoint and handles the HTTP request and response.
 * Controllers are intentionally thin: they validate input, call the service,
 * and shape the HTTP response. They don't know about bcrypt, SQL, or JWT
 * signing those concerns live in the service and utility layers.
 */

import * as authService from '../services/authService.js';
import * as userRepository from '../repositories/userRepository.js';
import {
  registerSchema,
  loginSchema,
} from '../validators/authValidators.js';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '../middleware/authMiddleware.js';
import {
  BadRequestError,
  NotFoundError,
} from '../middleware/errorHandler.js';
import { config } from '../config/env.js';

/**
 * Cookie options used for both access and refresh tokens.
 * - httpOnly: inaccessible to JavaScript (protects against XSS).
 * - sameSite 'lax': sent on top level navigations, blocked on cross-site POSTs (CSRF protection).
 * - secure: only sent over HTTPS in production.
 */
const baseCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: config.isProduction,
  path: '/',
};

// Access token expires in 15 minutes.
const ACCESS_COOKIE_MAX_AGE = 15 * 60 * 1000;
// Refresh token expires in 7 days.
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;


 // Sets both auth cookies on the response.
 // Centralized here so login and register stay consistent.
 
const setAuthCookies = (res, { accessToken, refreshToken }) => {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    ...baseCookieOptions,
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...baseCookieOptions,
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
};


 // Parses a request body against a Zod schema and returns the parsed data.
 // Throws BadRequestError with a clear message on validation failure.
 
const parseBody = (schema, body) => {
  const result = schema.safeParse(body);
  if (!result.success) {
    // Take the first validation error to keep the response simple.
    const firstError = result.error.issues[0];
    throw new BadRequestError(firstError.message);
  }
  return result.data;
};

/**
 * POST /api/auth/register
 * Creates a new user and logs them in by setting auth cookies.
 */
export const register = async (req, res) => {
  const data = parseBody(registerSchema, req.body);
  const result = await authService.register(data);
  setAuthCookies(res, result);
  res.status(201).json({ user: result.user });
};


// POST /api/auth/login
// Verifies credentials and sets auth cookies on success.
export const login = async (req, res) => {
  const data = parseBody(loginSchema, req.body);
  const result = await authService.login(data);
  setAuthCookies(res, result);
  res.status(200).json({ user: result.user });
};


// POST /api/auth/logout
// Clears the auth cookies. 
// Stateless: no server-side session to destroy.

export const logout = (req, res) => {
  res.clearCookie(ACCESS_TOKEN_COOKIE, baseCookieOptions);
  res.clearCookie(REFRESH_TOKEN_COOKIE, baseCookieOptions);
  res.status(204).end();
};


 // GET /api/auth/me
 // Returns the currently authenticated user.
 // Requires the `authenticate` middleware to have run first.
 
export const me = async (req, res) => {
  const user = await userRepository.findById(req.userId);
  if (!user) {
    // The token was valid but the user was deleted — treat as not found.
    throw new NotFoundError('User no longer exists');
  }
  res.status(200).json({ user });
};