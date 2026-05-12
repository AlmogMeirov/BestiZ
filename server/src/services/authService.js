/**
 * Authentication service.
 * Contains the business logic for register and login. This is where the
 * different concerns come together: validation already happened, and now
 * we hash passwords, check credentials, generate tokens, and handle
 * domain-level errors like "email already taken".
 * The service is the only layer that knows about both the user repository
 * and the token utilities — controllers don't.
 */

import bcrypt from 'bcrypt';

import * as userRepository from '../repositories/userRepository.js';
import {
  generateAccessToken,
  generateRefreshToken,
} from '../utils/tokens.js';
import {
  ConflictError,
  UnauthorizedError,
} from '../middleware/errorHandler.js';


 // bcrypt cost factor (rounds). Higher = slower but more secure.
 // 12 is a good balance for 2024+ hardware: ~250ms per hash.
const BCRYPT_ROUNDS = 12;


 // Removes sensitive fields from a user object before returning to the client.
 // Centralized here so we never accidentally leak password_hash from any service.
const toPublicUser = (user) => {
  // eslint-disable-next-line no-unused-vars
  const { password_hash, ...publicUser } = user;
  return publicUser;
};

/**
 * Registers a new user.
 * Steps:
 *  1. Check that email and username are not already taken.
 *  2. Hash the password with bcrypt.
 *  3. Create the user in the database.
 *  4. Generate access and refresh tokens.
 *  5. Return the public user object and the tokens.
 */
export const register = async ({ username, email, password, displayName }) => {
  // 1. Check for conflicts before attempting to insert.
  //    The repository returns { email_taken, username_taken } from the DB.
  const conflicts = await userRepository.findConflicts({ email, username });
  if (conflicts.email_taken) {
    throw new ConflictError('Email is already in use');
  }
  if (conflicts.username_taken) {
    throw new ConflictError('Username is already taken');
  }

  // 2. Hash the password. bcrypt generates a per-user salt automatically.
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // 3. Create the user.
  const user = await userRepository.create({
    username,
    email,
    passwordHash,
    displayName,
  });

  // 4. Generate tokens. The user is auto-logged-in after registration.
  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  return { user: toPublicUser(user), accessToken, refreshToken };
};

/**
 * Logs in a user with email or username.
 * Returns generic "Invalid credentials" for both wrong identifier and
 * wrong password. This prevents user enumeration: an attacker can't tell
 * if a given email exists in the system or not.
 */
export const login = async ({ identifier, password }) => {
  // The identifier might be an email or a username, try both.
  const isEmail = identifier.includes('@');
  const user = isEmail
    ? await userRepository.findByEmailWithPassword(identifier)
    : await userRepository.findByUsernameWithPassword(identifier);

  if (!user) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  return { user: toPublicUser(user), accessToken, refreshToken };
};