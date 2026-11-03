/**
 * Message repository.
 * Encapsulates all SQL access for the `messages` table — direct one-to-one
 * messages between two users.
 *
 * A conversation is not a stored entity. There is no conversations table and
 * no conversation id: a conversation is simply every message row whose two
 * participants are the same pair, in either direction. That keeps writes
 * trivial (one INSERT, nothing to create or look up first) at the cost of
 * making the conversation list query do real work, which is the right trade
 * when sending happens far more often than listing.
 *
 * The LEAST/GREATEST index in the schema is what makes the direction-agnostic
 * lookup fast — the same trick the friendships table uses for its unique pair
 * constraint.
 *
 * Whether a given pair is *allowed* to exchange messages is not decided here.
 * That lives in `message_requests` and is enforced by the service.
 */

import { pool } from '../config/database.js';

/**
 * Inserts a message and returns it with the sender's public profile attached,
 * so the caller can emit it over the socket without a second query.
 *
 * Takes an optional client so an opening message can be written in the same
 * transaction as the message request it creates.
 */
export const create = async (
  { senderId, recipientId, content },
  client = pool
) => {
  const result = await client.query(
    `WITH inserted AS (
       INSERT INTO messages (sender_id, recipient_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, sender_id, recipient_id, content, read, created_at
     )
     SELECT
       m.id, m.sender_id, m.recipient_id, m.content, m.read, m.created_at,
       u.username     AS sender_username,
       u.display_name AS sender_display_name
     FROM inserted m
     JOIN users u ON u.id = m.sender_id`,
    [senderId, recipientId, content]
  );
  return result.rows[0];
};

/**
 * Returns one page of the conversation between two users, newest first.
 *
 * `before` is a created_at cursor rather than an offset. With OFFSET, a
 * message arriving mid-scroll shifts every later row by one and the reader
 * sees a duplicate; anchoring to a timestamp is stable under concurrent
 * writes, which a chat has constantly.
 */
export const findConversation = async ({
  userId,
  otherUserId,
  limit = 50,
  before,
}) => {
  const params = [userId, otherUserId];
  let cursorClause = '';
  if (before) {
    params.push(before);
    cursorClause = `AND m.created_at < $${params.length}`;
  }
  params.push(limit);

  const result = await pool.query(
    `SELECT
       m.id, m.sender_id, m.recipient_id, m.content, m.read, m.created_at,
       u.username     AS sender_username,
       u.display_name AS sender_display_name
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE ((m.sender_id = $1 AND m.recipient_id = $2)
         OR (m.sender_id = $2 AND m.recipient_id = $1))
       ${cursorClause}
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows;
};

/**
 * Returns the current user's inbox: one row per person they have exchanged
 * messages with, carrying that person's profile, the most recent message, and
 * how many of their messages are still unread.
 *
 * Built from CTEs rather than a correlated subquery per row:
 *  - `conversation` normalises each message to "who is the other person",
 *    collapsing the two directions into one key.
 *  - `latest` uses DISTINCT ON, Postgres's direct way to take one row per
 *    group. The ORDER BY must lead with the same expression DISTINCT ON uses.
 *  - `unread` counts in a single grouped pass instead of once per partner.
 *
 * Pending and declined requests *addressed to this user* are excluded. An
 * undecided stranger belongs in the Requests list, not in the inbox — that
 * separation is the whole point of requiring approval. A request this user
 * SENT does appear here, so they can see their own opening message sitting
 * there; `request_awaiting_approval` tells the client to show it as waiting
 * rather than as a normal thread.
 *
 * Ordered by most recent activity, which is what a chat list is expected to do.
 */
export const findConversations = async (userId) => {
  const result = await pool.query(
    `WITH conversation AS (
       SELECT
         CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS partner_id,
         id, sender_id, content, created_at
       FROM messages
       WHERE sender_id = $1 OR recipient_id = $1
     ),
     latest AS (
       SELECT DISTINCT ON (partner_id)
         partner_id, id, sender_id, content, created_at
       FROM conversation
       ORDER BY partner_id, created_at DESC, id DESC
     ),
     unread AS (
       SELECT sender_id AS partner_id, COUNT(*)::int AS unread_count
       FROM messages
       WHERE recipient_id = $1 AND read = FALSE
       GROUP BY sender_id
     )
     SELECT
       u.id, u.username, u.display_name,
       l.id         AS last_message_id,
       l.content    AS last_message_content,
       l.created_at AS last_message_at,
       (l.sender_id = $1) AS last_message_mine,
       COALESCE(n.unread_count, 0) AS unread_count,
       -- True when this user opened the conversation and the other side has
       -- not yet accepted: no further messages can be sent until they do.
       (r.id IS NOT NULL AND r.status = 'pending' AND r.requester_id = $1)
         AS request_awaiting_approval
     FROM latest l
     JOIN users u ON u.id = l.partner_id
     LEFT JOIN unread n ON n.partner_id = l.partner_id
     LEFT JOIN message_requests r
       ON LEAST(r.requester_id, r.recipient_id) = LEAST($1::uuid, l.partner_id)
      AND GREATEST(r.requester_id, r.recipient_id) = GREATEST($1::uuid, l.partner_id)
     WHERE r.id IS NULL
        OR r.status = 'accepted'
        OR r.requester_id = $1
     ORDER BY l.created_at DESC`,
    [userId]
  );
  return result.rows;
};

/**
 * Marks every message the other user sent to this user as read.
 *
 * Returns the ids that actually changed, not a count. The service needs them
 * to tell the sender which of their messages were read, and the
 * `read = FALSE` guard means a repeated call returns an empty array — so
 * opening an already-read conversation emits nothing instead of a redundant
 * event on every render.
 */
export const markConversationRead = async ({ userId, otherUserId }) => {
  const result = await pool.query(
    `UPDATE messages
     SET read = TRUE
     WHERE recipient_id = $1
       AND sender_id = $2
       AND read = FALSE
     RETURNING id`,
    [userId, otherUserId]
  );
  return result.rows.map((row) => row.id);
};

/**
 * Unread messages across every conversation in the inbox — the number behind
 * the badge in the navigation bar.
 *
 * Messages from an undecided or declined request are not counted. A stranger
 * would otherwise be able to raise this user's unread badge without
 * permission, which is exactly the nuisance the approval step exists to
 * prevent. Those appear as a separate Requests count instead.
 */
export const countUnread = async (userId) => {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM messages m
     WHERE m.recipient_id = $1
       AND m.read = FALSE
       AND NOT EXISTS (
         SELECT 1 FROM message_requests r
         WHERE r.recipient_id = $1
           AND r.requester_id = m.sender_id
           AND r.status <> 'accepted'
       )`,
    [userId]
  );
  return result.rows[0].count;
};
