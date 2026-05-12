/**
 * Comment repository.
 * Encapsulates all SQL access for the `comments` table. 
 * Like the post repository, this layer is pure data access — visibility checks live in the service layer.
 */

import { pool } from '../config/database.js';


// Creates a new comment. Returns the created row with author info attached
// via a refetch in findById, for a consistent response shape.
export const create = async ({ postId, authorId, content }) => {
  const result = await pool.query(
    `INSERT INTO comments (post_id, author_id, content)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [postId, authorId, content]
  );
  return findById(result.rows[0].id);
};


 // Loads a single comment by id, with author info attached.
export const findById = async (commentId) => {
  const result = await pool.query(
    `SELECT
       c.id, c.post_id, c.author_id, c.content,
       c.created_at, c.updated_at,
       u.username AS author_username,
       u.display_name AS author_display_name
     FROM comments c
     JOIN users u ON u.id = c.author_id
     WHERE c.id = $1`,
    [commentId]
  );
  return result.rows[0];
};

/**
 * Returns all comments for a specific post, oldest first.
 * Comments are typically read in chronological order so the conversation flows naturally.
 * For long threads we'd add cursor pagination, but for the assignment scope we return all of them.
 */
export const findByPost = async (postId) => {
  const result = await pool.query(
    `SELECT
       c.id, c.post_id, c.author_id, c.content,
       c.created_at, c.updated_at,
       u.username AS author_username,
       u.display_name AS author_display_name
     FROM comments c
     JOIN users u ON u.id = c.author_id
     WHERE c.post_id = $1
     ORDER BY c.created_at DESC, c.id DESC`,
    [postId]
  );
  return result.rows;
};


 // Updates a comment's content.
export const update = async (commentId, { content }) => {
  const result = await pool.query(
    `UPDATE comments
     SET content = $1
     WHERE id = $2
     RETURNING id`,
    [content, commentId]
  );
  if (result.rowCount === 0) {
    return undefined;
  }
  return findById(commentId);
};


 // Deletes a comment by id.
export const deleteById = async (commentId) => {
  const result = await pool.query(
    `DELETE FROM comments WHERE id = $1`,
    [commentId]
  );
  return result.rowCount > 0;
};

/**
 * Counts comments per post for an array of post ids.
 * Used to display "5 comments" badges next to posts without fetching the full comment list.
 * Single round trip via GROUP BY instead of N queries.
 */
export const countByPostIds = async (postIds) => {
  if (postIds.length === 0) {
    return {};
  }
  const result = await pool.query(
    `SELECT post_id, COUNT(*)::int AS count
     FROM comments
     WHERE post_id = ANY($1::uuid[])
     GROUP BY post_id`,
    [postIds]
  );
  // Convert rows into { post_id: count } for O(1) lookup by callers.
  const counts = {};
  for (const row of result.rows) {
    counts[row.post_id] = row.count;
  }
  return counts;
};