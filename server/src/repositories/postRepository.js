/**
 * Post repository.js
 * Encapsulates all SQL access for the `posts` table.
 * The repository never makes visibility decisions, that's the service layer's job.
 * Repository functions are filtering helpers, not access-control gates.
 */

import { pool } from '../config/database.js';


 // Creates a new post.
export const create = async ({ authorId, content, imageUrl, visibility }) => {
  const result = await pool.query(
    `INSERT INTO posts (author_id, content, image_url, visibility)
     VALUES ($1, $2, $3, $4)
     RETURNING id, author_id, content, image_url, visibility,
               created_at, updated_at`,
    [authorId, content, imageUrl, visibility]
  );
  return result.rows[0];
};


 // Loads a single post by id, with author info attached.
export const findById = async (postId) => {
  const result = await pool.query(
    `SELECT
       p.id, p.author_id, p.content, p.image_url, p.visibility,
       p.created_at, p.updated_at,
       u.username AS author_username,
       u.display_name AS author_display_name
     FROM posts p
     JOIN users u ON u.id = p.author_id
     WHERE p.id = $1`,
    [postId]
  );
  return result.rows[0];
};

/**
 * Updates an existing post.
 * Accepts partial fields only those provided are updated.
 * Uses a dynamic SET clause built from the provided fields so we don't accidentally
 * overwrite fields the caller didn't mean to change.
 */
export const update = async (postId, { content, imageUrl, visibility }) => {
  const setClauses = [];
  const params = [];

  if (content !== undefined) {
    params.push(content);
    setClauses.push(`content = $${params.length}`);
  }
  if (imageUrl !== undefined) {
    params.push(imageUrl);
    setClauses.push(`image_url = $${params.length}`);
  }
  if (visibility !== undefined) {
    params.push(visibility);
    setClauses.push(`visibility = $${params.length}`);
  }

  // Should never happen — the validator enforces at least one field —
  // but guard against an empty update just in case.
  if (setClauses.length === 0) {
    return findById(postId);
  }

  params.push(postId);
  const result = await pool.query(
    `UPDATE posts
     SET ${setClauses.join(', ')}
     WHERE id = $${params.length}
     RETURNING id`,
    params
  );

  if (result.rowCount === 0) {
    return undefined;
  }
  // Re-fetch with author info attached via JOIN.
  return findById(postId);
};


 // Deletes a post by id.
export const deleteById = async (postId) => {
  const result = await pool.query(
    `DELETE FROM posts WHERE id = $1`,
    [postId]
  );
  return result.rowCount > 0;
};

/**
 * Returns the personalized feed for a user.
 * Supports three filters:
 *  - 'all' (default) — every post the user can see: their own, friends',and any public posts.
 *  - 'mine' — only the user's own posts (regardless of visibility).
 *  - 'friends' — only posts authored by accepted friends. Public posts
 *                from non-friends are excluded; the viewer's own posts are also excluded.
 * The visibility predicate inside the friends clause is intentionally
 * NOT applied for 'mine' (the author always sees their own posts) and
 * IS applied for 'friends' (a friend's private post should NOT leak,
 * even to other friends; only their friends-only and public posts).
 */
export const findFeed = async (
  userId,
  { limit = 50, before, filter = 'all' } = {}
) => {
  const params = [userId];
  let cursorClause = '';
  if (before) {
    params.push(before);
    cursorClause = `AND p.created_at < $${params.length}`;
  }

  let scopeClause;
  if (filter === 'mine') {
    scopeClause = `p.author_id = $1`;
  } else if (filter === 'friends') {
    // Friends' posts only: author must be a friend, and the post must be
    // visible to friends (public or friends-only — never private).
    scopeClause = `
      p.author_id <> $1
      AND p.visibility IN ('public', 'friends')
      AND EXISTS (
        SELECT 1 FROM friendships f
        WHERE f.status = 'accepted'
          AND (
            (f.requester_id = $1 AND f.addressee_id = p.author_id)
            OR (f.requester_id = p.author_id AND f.addressee_id = $1)
          )
      )
    `;
  } else {
    // 'all' — the original predicate: own + public + friends-of-friends.
    scopeClause = `
      p.author_id = $1
      OR p.visibility = 'public'
      OR (
        p.visibility = 'friends'
        AND EXISTS (
          SELECT 1 FROM friendships f
          WHERE f.status = 'accepted'
            AND (
              (f.requester_id = $1 AND f.addressee_id = p.author_id)
              OR (f.requester_id = p.author_id AND f.addressee_id = $1)
            )
        )
      )
    `;
  }

  params.push(limit);

  const result = await pool.query(
    `SELECT
       p.id, p.author_id, p.content, p.image_url, p.visibility,
       p.created_at, p.updated_at,
       u.username AS author_username,
       u.display_name AS author_display_name
     FROM posts p
     JOIN users u ON u.id = p.author_id
     WHERE (${scopeClause})
       ${cursorClause}
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows;
};


 // Returns posts authored by a specific user that are visible to the viewer.
export const findByAuthor = async ({
  authorId,
  viewerId,
  limit = 50,
  before,
}) => {
  const params = [authorId, viewerId];
  let cursorClause = '';
  if (before) {
    params.push(before);
    cursorClause = `AND p.created_at < $${params.length}`;
  }
  params.push(limit);

  const result = await pool.query(
    `SELECT
       p.id, p.author_id, p.content, p.image_url, p.visibility,
       p.created_at, p.updated_at,
       u.username AS author_username,
       u.display_name AS author_display_name
     FROM posts p
     JOIN users u ON u.id = p.author_id
     WHERE p.author_id = $1
       AND (
         $1 = $2
         OR p.visibility = 'public'
         OR (
           p.visibility = 'friends'
           AND EXISTS (
             SELECT 1 FROM friendships f
             WHERE f.status = 'accepted'
               AND (
                 (f.requester_id = $2 AND f.addressee_id = $1)
                 OR (f.requester_id = $1 AND f.addressee_id = $2)
               )
           )
         )
       )
       ${cursorClause}
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows;
};