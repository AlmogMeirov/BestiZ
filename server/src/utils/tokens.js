/**
 * JWT token utilities.
 * Provides functions to generate and verify access and refresh tokens.
 * Access tokens are short-lived and used for API requests.
 * Refresh tokens are long-lived and used to get new access tokens.
 */

import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

 // Generates a short-lived access token.
 // The payload contains the user's id; we keep it minimal to reduce token size.
export const generateAccessToken = (userId) => {
  return jwt.sign({ sub: userId, type: 'access' }, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
  });
};

 // Generates a long-lived refresh token.
 // Signed with a different secret so an exposed access token can't be used as refresh.
export const generateRefreshToken = (userId) => {
  return jwt.sign({ sub: userId, type: 'refresh' }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
};

 // Verifies an access token and returns its payload.
 // Throws if the token is invalid, expired, or has the wrong type.
export const verifyAccessToken = (token) => {
  const payload = jwt.verify(token, config.jwt.accessSecret);
  if (payload.type !== 'access') {
    throw new Error('Invalid token type');
  }
  return payload;
};

 // Verifies a refresh token and returns its payload.
 // Throws if the token is invalid, expired, or has the wrong type.
export const verifyRefreshToken = (token) => {
  const payload = jwt.verify(token, config.jwt.refreshSecret);
  if (payload.type !== 'refresh') {
    throw new Error('Invalid token type');
  }
  return payload;
};