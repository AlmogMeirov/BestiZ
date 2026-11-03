/**
 * Message request repository.
 * Encapsulates all SQL access for the `message_requests` table.
 *
 * A message request records the state of a conversation between two people who
 * are not friends: a stranger's opening message creates one in 'pending', and
 * the recipient moves it to 'accepted' or 'declined'. Once accepted, the
 * direction stops mattering — the same convention `friendships` uses.
 *
 * Every write takes an optional `client` so the service can run it inside a
 * transaction alongside the message insert it belongs with.
 */

import { pool } from '../config/database.js';

/**
 * Returns the request row between two users in either direction, or undefined.
 * This is the lookup that decides whether a sender is allowed to write.
 */
export const findBetween = async (userIdA, userIdB, client = pool) => {
  const result = await client.query(
    `SELECT id, requester_id, recipient_id, status, created_at, updated_at
     FROM message_requests
     WHERE (requester_id = $1 AND recipient_id = $2)
        OR (requester_id = $2 AND recipient_id = $1)`,
    [userIdA, userIdB]
  );
  return result.rows[0];
};

// Loads a request by id. Used by accept/decline to verify it exists and that
// the caller is the one entitled to decide.
export const findById = async (id, client = pool) => {
  const result = await client.query(
    `SELECT id, requester_id, recipient_id, status, created_at, updated_at
     FROM message_requests
     WHERE id = $1`,
    [id]
  );
  return result.rows[0];
};

/**
 * Creates a pending request.
 *
 * Expected to be called inside the same transaction as the opening message:
 * the unique pair index is what enforces "one message", so if this insert
 * fails the message must not survive either.
 */
export const create = async ({ requesterId, recipientId }, client = pool) => {
  const result = await client.query(
    `INSERT INTO message_requests (requester_id, recipient_id, status)
     VALUES ($1, $2, 'pending')
     RETURNING id, requester_id, recipient_id, status, created_at, updated_at`,
    [requesterId, recipientId]
  );
  return result.rows[0];
};

/**
 * Moves a pending request to a decided state.
 *
 * The `status = 'pending'` guard makes this a no-op on an already-decided row
 * and returns undefined, so a double-click on Accept cannot re-fire the
 * notification or overwrite a decline.
 */
export const setStatus = async (id, status, client = pool) => {
  const result = await client.query(
    `UPDATE message_requests
     SET status = $2
     WHERE id = $1 AND status = 'pending'
     RETURNING id, requester_id, recipient_id, status, created_at, updated_at`,
    [id, status]
  );
  return result.rows[0];
};

/**
 * Requests waiting on this user's decision, each with the profile of whoever
 * sent it and a preview of their opening message.
 *
 * The lateral join takes the first message of the conversation rather than the
 * most recent one: until a request is accepted there is only ever one, and
 * "the message they sent you" is what the recipient needs in order to decide.
 */
export const findPendingForRecipient = async (userId, client = pool) => {
  const result = await client.query(
    `SELECT
       r.id AS request_id,
       r.created_at AS requested_at,
       u.id, u.username, u.display_name,
       m.content AS opening_message,
       m.created_at AS opening_message_at
     FROM message_requests r
     JOIN users u ON u.id = r.requester_id
     LEFT JOIN LATERAL (
       SELECT content, created_at
       FROM messages
       WHERE sender_id = r.requester_id AND recipient_id = r.recipient_id
       ORDER BY created_at ASC
       LIMIT 1
     ) m ON TRUE
     WHERE r.recipient_id = $1 AND r.status = 'pending'
     ORDER BY r.created_at DESC`,
    [userId]
  );
  return result.rows;
};

// How many requests are awaiting this user's decision — the number beside the
// Requests tab, kept separate from the unread-message count so an unanswered
// stranger never inflates the inbox badge.
export const countPendingForRecipient = async (userId, client = pool) => {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM message_requests
     WHERE recipient_id = $1 AND status = 'pending'`,
    [userId]
  );
  return result.rows[0].count;
};
