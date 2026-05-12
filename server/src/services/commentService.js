/**
 * Comment service.
 * Comments inherit their real-time audience from their parent post whoever can see the post receives comment events for it.
 *  This automatically respects the post's visibility rules.
 */

import * as commentRepository from '../repositories/commentRepository.js';
import * as postRepository from '../repositories/postRepository.js';
import * as postService from './postService.js';
import {
  emitCommentCreated,
  emitCommentUpdated,
  emitCommentDeleted,
} from '../socket/socketServer.js';
import {
  ForbiddenError,
  NotFoundError,
} from '../middleware/errorHandler.js';

export const create = async ({ postId, authorId, content }) => {
  // Throws NotFoundError if the post doesn't exist or the user can't see it.
  const post = await postService.getById({ postId, viewerId: authorId });

  const comment = await commentRepository.create({
    postId,
    authorId,
    content,
  });

  // Reach everyone who can see the parent post (excluding the comment author).
  const audience = await postService.getAudienceForPost(post, authorId);
  emitCommentCreated(audience, comment);

  return comment;
};

export const getByPost = async ({ postId, viewerId }) => {
  await postService.getById({ postId, viewerId });
  return commentRepository.findByPost(postId);
};

export const update = async ({ commentId, currentUserId, content }) => {
  const existing = await commentRepository.findById(commentId);
  if (!existing) {
    throw new NotFoundError('Comment not found');
  }
  if (existing.author_id !== currentUserId) {
    throw new ForbiddenError('You can only edit your own comments');
  }
  const updated = await commentRepository.update(commentId, { content });

  // Compute the audience based on the parent post's current visibility.
  const post = await postRepository.findById(existing.post_id);
  if (post) {
    const audience = await postService.getAudienceForPost(post, currentUserId);
    emitCommentUpdated(audience, updated);
  }

  return updated;
};

export const deleteComment = async ({ commentId, currentUserId }) => {
  const comment = await commentRepository.findById(commentId);
  if (!comment) {
    throw new NotFoundError('Comment not found');
  }

  const isCommentAuthor = comment.author_id === currentUserId;

  // Load the parent post — we need it for both authorization (post author can also delete) and audience computation.
  const post = await postRepository.findById(comment.post_id);
  const isPostAuthor = post?.author_id === currentUserId;

  if (!isCommentAuthor && !isPostAuthor) {
    throw new ForbiddenError(
      'You can only delete your own comments or comments on your own posts'
    );
  }

  await commentRepository.deleteById(commentId);

  if (post) {
    const audience = await postService.getAudienceForPost(post, currentUserId);
    emitCommentDeleted(audience, {
      commentId,
      postId: comment.post_id,
    });
  }
};