/**
 * Friend repository.
 * Encapsulates all SQL access for the `friendships` table. Friendships are
 * stored in a single table with a status enum ('pending' | 'accepted'),
 * and the LEAST/GREATEST unique index in the schema prevents duplicate pairs
 * regardless of who sent the request first.

 * Conventions used here:
 *  - The "requester" is whoever sent the friend request.
 *  - The "addressee" is the recipient who can accept or reject.
 *  - Once accepted, the direction stops mattering for friendship checks.
 */

import { pool } from '../config/database.js';


 // Returns the existing friendship row between two users (in either direction), or undefined if none exists.
 // Used to detect duplicates before sending a new request and to load a request for accept/reject.
export const findBetween = async (userIdA, userIdB) => {
  const result = await pool.query(
    `SELECT id, requester_id, addressee_id, status, created_at, updated_at
     FROM friendships
     WHERE (requester_id = $1 AND addressee_id = $2)
        OR (requester_id = $2 AND addressee_id = $1)`,
    [userIdA, userIdB]
  );
  return result.rows[0];
};


 // Returns true if the two users are accepted friends, false otherwise.
 // This is the function posts and feed will use for visibility checks.
export const areFriends = async (userIdA, userIdB) => {
  const result = await pool.query(
    `SELECT 1
     FROM friendships
     WHERE status = 'accepted'
       AND ((requester_id = $1 AND addressee_id = $2)
         OR (requester_id = $2 AND addressee_id = $1))
     LIMIT 1`,
    [userIdA, userIdB]
  );
  return result.rowCount > 0;
};

/**
 * Loads a friendship by id. Returns undefined if not found.
 * Used by accept/reject to verify the row exists and the caller is allowed
 * to act on it.
 */
export const findById = async (id) => {
  const result = await pool.query(
    `SELECT id, requester_id, addressee_id, status, created_at, updated_at
     FROM friendships
     WHERE id = $1`,
    [id]
  );
  return result.rows[0];
};


 // Creates a new friendship row in 'pending' status.
export const createRequest = async ({ requesterId, addresseeId }) => {
  const result = await pool.query(
    `INSERT INTO friendships (requester_id, addressee_id, status)
     VALUES ($1, $2, 'pending')
     RETURNING id, requester_id, addressee_id, status, created_at, updated_at`,
    [requesterId, addresseeId]
  );
  return result.rows[0];
};


 // Marks a pending friendship as accepted. Returns the updated row.
 // Only changes rows that are still pending.
export const acceptRequest = async (id) => {
  const result = await pool.query(
    `UPDATE friendships
     SET status = 'accepted'
     WHERE id = $1 AND status = 'pending'
     RETURNING id, requester_id, addressee_id, status, created_at, updated_at`,
    [id]
  );
  return result.rows[0];
};

/**
 * Deletes a friendship row by id. Used for both:
 *  - Rejecting an incoming pending request.
 *  - Cancelling an outgoing pending request.
 *  - Unfriending an accepted friendship.
 */
export const deleteById = async (id) => {
  const result = await pool.query(
    `DELETE FROM friendships WHERE id = $1`,
    [id]
  );
  return result.rowCount > 0;
};


 // Returns all incoming pending requests for a user, with the requester's
 // public profile attached so the UI can render them without extra queries.
export const findIncomingRequests = async (userId) => {
  const result = await pool.query(
    `SELECT
       f.id, f.status, f.created_at,
       u.id   AS requester_id,
       u.username AS requester_username,
       u.display_name AS requester_display_name
     FROM friendships f
     JOIN users u ON u.id = f.requester_id
     WHERE f.addressee_id = $1 AND f.status = 'pending'
     ORDER BY f.created_at DESC`,
    [userId]
  );
  return result.rows;
};


 // Returns all outgoing pending requests sent by the user.
export const findOutgoingRequests = async (userId) => {
  const result = await pool.query(
    `SELECT
       f.id, f.status, f.created_at,
       u.id   AS addressee_id,
       u.username AS addressee_username,
       u.display_name AS addressee_display_name
     FROM friendships f
     JOIN users u ON u.id = f.addressee_id
     WHERE f.requester_id = $1 AND f.status = 'pending'
     ORDER BY f.created_at DESC`,
    [userId]
  );
  return result.rows;
};

/**
 * Returns all accepted friends of a user, with each friend's public profile
 * AND the friendship_id so the client can later remove the friendship.
 * Uses a CASE expression to pick the "other side" of the relationship
 * regardless of who originally sent the request.
 */
export const findFriends = async (userId) => {
  const result = await pool.query(
    `SELECT
       f.id AS friendship_id,
       u.id, u.username, u.display_name
     FROM friendships f
     JOIN users u ON u.id = CASE
       WHEN f.requester_id = $1 THEN f.addressee_id
       ELSE f.requester_id
     END
     WHERE f.status = 'accepted'
       AND (f.requester_id = $1 OR f.addressee_id = $1)
     ORDER BY u.display_name ASC`,
    [userId]
  );
  return result.rows;
};

/**
 * Returns the number of accepted friendships for the given user.
 * Counting is much cheaper than fetching every row when we only need the
 * total useful for showing "N friends" on a profile page without loading the full list.
 */
export const countFriends = async (userId) => {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM friendships
     WHERE status = 'accepted'
       AND (requester_id = $1 OR addressee_id = $1)`,
    [userId]
  );
  return result.rows[0].count;
};