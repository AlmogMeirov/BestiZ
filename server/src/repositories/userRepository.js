/**
 * User repository.
 * All SQL access for the `users` table. The repository never returns
 * `password_hash` to the rest of the app except via the `*WithPassword`
 * helpers used by the auth service for login.
 */

import { pool } from '../config/database.js';

// Converts a full user row from the database into a "public" user object
const toPublicUser = (row) => ({
  id: row.id,
  username: row.username,
  email: row.email,
  display_name: row.display_name,
  bio: row.bio,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

// Finds a user by their ID, returning a public user object or undefined if not found.
export const findById = async (id) => {
  const result = await pool.query(
    `SELECT id, username, email, display_name, bio, created_at, updated_at
     FROM users
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] ? toPublicUser(result.rows[0]) : undefined;
};

// Finds a user by their email, including the password hash for authentication purposes.
export const findByEmailWithPassword = async (email) => {
  const result = await pool.query(
    `SELECT id, username, email, password_hash, display_name, bio, created_at, updated_at
     FROM users
     WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  return result.rows[0];
};

// Finds a user by their username, including the password hash for authentication purposes.
export const findByUsernameWithPassword = async (username) => {
  const result = await pool.query(
    `SELECT id, username, email, password_hash, display_name, bio, created_at, updated_at
     FROM users
     WHERE LOWER(username) = LOWER($1)`,
    [username]
  );
  return result.rows[0];
};

// Checks if the given email or username is already taken by another user (case-insensitive).
export const findConflicts = async ({ email, username }) => {
  const result = await pool.query(
    `SELECT
       EXISTS(SELECT 1 FROM users WHERE LOWER(email) = LOWER($1))    AS email_taken,
       EXISTS(SELECT 1 FROM users WHERE LOWER(username) = LOWER($2)) AS username_taken`,
    [email, username]
  );
  return result.rows[0];
};

// Creates a new user with the given details and returns the created user object.
export const create = async ({ username, email, passwordHash, displayName }) => {
  const result = await pool.query(
    `INSERT INTO users (username, email, password_hash, display_name)
     VALUES ($1, LOWER($2), $3, $4)
     RETURNING id, username, email, display_name, bio, created_at, updated_at`,
    [username, email, passwordHash, displayName]
  );
  return toPublicUser(result.rows[0]);
};

// Searches for users by username or display name, excluding the current user and limiting results.
export const searchByUsername = async ({ query, currentUserId, limit = 10 }) => {
  const escaped = query.replace(/[\\%_]/g, (match) => `\\${match}`);
  const pattern = `${escaped}%`;

  const result = await pool.query(
    `SELECT id, username, display_name
     FROM users
     WHERE id <> $1
       AND (username ILIKE $2 OR display_name ILIKE $2)
     ORDER BY username ASC
     LIMIT $3`,
    [currentUserId, pattern, limit]
  );
  return result.rows;
};

// Checks if the given email is already taken by another user (case-insensitive), excluding the current user.
export const findEmailConflict = async ({ email, userId }) => {
  const result = await pool.query(
    `SELECT 1
     FROM users
     WHERE LOWER(email) = LOWER($1) AND id <> $2
     LIMIT 1`,
    [email, userId]
  );
  return result.rows.length > 0;
};

/**
 * Updates the profile fields of the given user.
 * Dynamic UPDATE: builds the SET clause from whichever fields were provided. 
 * Bio can be set to null to clear it (the validator handles normalizing an empty input to null before getting here).
 */
export const updateProfile = async (userId, updates) => {
  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  if (updates.display_name !== undefined) {
    setClauses.push(`display_name = $${paramIndex++}`);
    values.push(updates.display_name);
  }
  if (updates.email !== undefined) {
    setClauses.push(`email = LOWER($${paramIndex++})`);
    values.push(updates.email);
  }
  if (updates.bio !== undefined) {
    setClauses.push(`bio = $${paramIndex++}`);
    values.push(updates.bio);
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(userId);

  const result = await pool.query(
    `UPDATE users
     SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING id, username, email, display_name, bio, created_at, updated_at`,
    values
  );
  return result.rows[0] ? toPublicUser(result.rows[0]) : undefined;
};