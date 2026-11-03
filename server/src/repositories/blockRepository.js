/**
 * Block repository.
 * Encapsulates all SQL access for the `blocks` table.
 *
 * Blocks are stored directionally — one row per (blocker, blocked) pair — but
 * almost every question the application asks is undirected: "may these two
 * people interact at all?" `existsBetween` is that question, and it is the
 * function nearly every caller wants.
 *
 * Writes take an optional `client` so blocking can delete the friendship in
 * the same transaction.
 */

import { pool } from '../config/database.js';

/**
 * True when either user has blocked the other.
 *
 * This is the gate in front of messaging, friend requests, post visibility and
 * commenting. It deliberately does not say WHICH direction: a blocked user
 * must not be able to tell a block apart from the other person simply having
 * nothing to show, so no caller is given the detail it would need to leak.
 */
export const existsBetween = async (userIdA, userIdB, client = pool) => {
  const result = await client.query(
    `SELECT 1
     FROM blocks
     WHERE (blocker_id = $1 AND blocked_id = $2)
        OR (blocker_id = $2 AND blocked_id = $1)
     LIMIT 1`,
    [userIdA, userIdB]
  );
  return result.rowCount > 0;
};

/**
 * True when this specific user performed a block on the other.
 *
 * Used only where the direction genuinely matters: showing the blocker their
 * own block list, and deciding whether an unblock has anything to undo.
 */
export const findByPair = async ({ blockerId, blockedId }, client = pool) => {
  const result = await client.query(
    `SELECT id, blocker_id, blocked_id, created_at
     FROM blocks
     WHERE blocker_id = $1 AND blocked_id = $2`,
    [blockerId, blockedId]
  );
  return result.rows[0];
};

/**
 * Records a block.
 *
 * ON CONFLICT DO NOTHING makes this idempotent: blocking someone already
 * blocked is the same fact, not an error, so a double-click returns the
 * existing row rather than a constraint violation. The caller distinguishes
 * the two cases by whether a row comes back.
 */
export const create = async ({ blockerId, blockedId }, client = pool) => {
  const result = await client.query(
    `INSERT INTO blocks (blocker_id, blocked_id)
     VALUES ($1, $2)
     ON CONFLICT (blocker_id, blocked_id) DO NOTHING
     RETURNING id, blocker_id, blocked_id, created_at`,
    [blockerId, blockedId]
  );
  return result.rows[0];
};

/**
 * Removes a block. Returns true when a row was actually deleted.
 *
 * Scoped to the blocker's own row, so one user cannot lift a block the other
 * placed on them.
 */
export const remove = async ({ blockerId, blockedId }, client = pool) => {
  const result = await client.query(
    `DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`,
    [blockerId, blockedId]
  );
  return result.rowCount > 0;
};

/**
 * The people this user has blocked, with their profiles, newest first.
 *
 * Only blocks this user performed. Who has blocked THEM is never listed —
 * that is the other person's business and surfacing it would defeat the point.
 */
export const findBlockedByUser = async (userId, client = pool) => {
  const result = await client.query(
    `SELECT
       b.id AS block_id,
       b.created_at AS blocked_at,
       u.id, u.username, u.display_name
     FROM blocks b
     JOIN users u ON u.id = b.blocked_id
     WHERE b.blocker_id = $1
     ORDER BY b.created_at DESC`,
    [userId]
  );
  return result.rows;
};
