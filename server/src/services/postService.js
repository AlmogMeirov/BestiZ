/**
 * Post service.js
 * Owns all business rules for posts and emits real-time events.
 * Real-time strategy: we use a "broadcast + client filter" approach.
 * Instead of trying to compute on the server who can/can't see a post
 * after every change (which is complex when visibility transitions),
 * we emit a single `post:updated` event with the full post payload to
 * a broad audience (the author's friends, plus everyone if the post is or was public).
 * The client receives the event and applies its own
 * visibility check:
 *   - if the post is now visible to the viewer → upsert into the list
 *   - if it's no longer visible → remove from the list
 * This trades a tiny bit of network bandwidth for correctness in every
 * visibility-change case.
 */

import * as postRepository from '../repositories/postRepository.js';
import * as friendRepository from '../repositories/friendRepository.js';
import * as userRepository from '../repositories/userRepository.js';
import {
  emitPostCreated,
  emitPostUpdated,
  emitPostDeleted,
} from '../socket/socketServer.js';
import {
  ForbiddenError,
  NotFoundError,
} from '../middleware/errorHandler.js';

export const create = async ({ authorId, content, imageUrl, visibility }) => {
  const post = await postRepository.create({
    authorId,
    content,
    imageUrl: imageUrl ?? null,
    visibility,
  });
  const enriched = await enrichWithAuthor(post, authorId);

  const audience = await getCreateAudience(enriched, authorId);
  emitPostCreated(audience, enriched);

  return enriched;
};

export const getById = async ({ postId, viewerId }) => {
  const post = await postRepository.findById(postId);
  if (!post) {
    throw new NotFoundError('Post not found');
  }
  const canSee = await canViewerSeePost(post, viewerId);
  if (!canSee) {
    throw new NotFoundError('Post not found');
  }
  return post;
};

export const getFeed = ({ userId, before, limit, filter }) =>
  postRepository.findFeed(userId, { before, limit, filter });

export const getByAuthor = async ({ authorId, viewerId, before, limit }) => {
  const author = await userRepository.findById(authorId);
  if (!author) {
    throw new NotFoundError('User not found');
  }
  return postRepository.findByAuthor({ authorId, viewerId, before, limit });
};

export const update = async ({ postId, currentUserId, updates }) => {
  const existing = await postRepository.findById(postId);
  if (!existing) {
    throw new NotFoundError('Post not found');
  }
  if (existing.author_id !== currentUserId) {
    throw new ForbiddenError('You can only edit your own posts');
  }
  const updated = await postRepository.update(postId, updates);

  // Send the update to anyone who *could have* seen it before OR after.
  // This is a superset: friends are always included; if either visibility
  // is/was public, we broadcast to everyone connected. Each client then
  // decides via its own visibility check whether to show or hide the post.
  const audience = await getUpdateAudience(existing, updated, currentUserId);
  emitPostUpdated(audience, updated);

  return updated;
};

export const deletePost = async ({ postId, currentUserId }) => {
  const post = await postRepository.findById(postId);
  if (!post) {
    throw new NotFoundError('Post not found');
  }
  if (post.author_id !== currentUserId) {
    throw new ForbiddenError('You can only delete your own posts');
  }

  // Use the same broad audience used for updates: anyone who might have
  // had the post in their list should know it's gone.
  const audience = await getDeleteAudience(post, currentUserId);

  await postRepository.deleteById(postId);

  emitPostDeleted(audience, postId);
};

// Internal helpers
const canViewerSeePost = async (post, viewerId) => {
  if (post.author_id === viewerId) return true;
  if (post.visibility === 'public') return true;
  if (post.visibility === 'private') return false;
  if (post.visibility === 'friends') {
    return friendRepository.areFriends(post.author_id, viewerId);
  }
  return false;
};

const enrichWithAuthor = async (post, currentUserId) => {
  if (post.author_id === currentUserId) {
    const author = await userRepository.findById(currentUserId);
    if (author) {
      return {
        ...post,
        author_username: author.username,
        author_display_name: author.display_name,
      };
    }
  }
  return postRepository.findById(post.id);
};

/**
 * Audience for newly created posts.
 *  - public  → broadcast (except author)
 *  - friends → author's friends (except author)
 *  - private → nobody
 */
const getCreateAudience = async (post, actorUserId) => {
  if (post.visibility === 'private') {
    return { type: 'users', ids: [] };
  }
  if (post.visibility === 'public') {
    return { type: 'broadcast', excludeUserId: actorUserId };
  }
  const friends = await friendRepository.findFriends(post.author_id);
  return {
    type: 'users',
    ids: friends.map((f) => f.id),
    excludeUserId: actorUserId,
  };
};

/**
 * Audience for updates. The key idea: include everyone who could have
 * seen the post in EITHER the old or new state.
 * - If either side is public → broadcast (covers all online users).
 * - Otherwise (friends ↔ private) → just the author's friends.
 *   They're the only non-author users who could have seen the friends
 *   version; private is invisible to others by definition.
 */
const getUpdateAudience = async (existing, updated, actorUserId) => {
  const eitherPublic =
    existing.visibility === 'public' || updated.visibility === 'public';
  if (eitherPublic) {
    return { type: 'broadcast', excludeUserId: actorUserId };
  }
  // friends ↔ private (or friends ↔ friends edits)
  const friends = await friendRepository.findFriends(existing.author_id);
  return {
    type: 'users',
    ids: friends.map((f) => f.id),
    excludeUserId: actorUserId,
  };
};


 // Audience for deletes.
 // Mirrors the update logic — if the post was public at the time of deletion, broadcast; otherwise just friends.
const getDeleteAudience = async (post, actorUserId) => {
  if (post.visibility === 'public') {
    return { type: 'broadcast', excludeUserId: actorUserId };
  }
  if (post.visibility === 'private') {
    return { type: 'users', ids: [] };
  }
  const friends = await friendRepository.findFriends(post.author_id);
  return {
    type: 'users',
    ids: friends.map((f) => f.id),
    excludeUserId: actorUserId,
  };
};

// Exported for use by other services (e.g. commentService) that emit on
// post-related events and need to know who's in scope.
export const getAudienceForPost = getCreateAudience;