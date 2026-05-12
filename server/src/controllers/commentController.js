/**
 * Comment HTTP controllers.
 * Validates input, calls the service, formats responses.
 * Privacy and authorization live in commentService.
 */

import * as commentService from '../services/commentService.js';
import {
  createCommentSchema,
  updateCommentSchema,
  postIdParamsSchema,
  commentIdParamsSchema,
} from '../validators/commentValidators.js';
import { BadRequestError } from '../middleware/errorHandler.js';

const parseWith = (schema, input) => {
  const result = schema.safeParse(input);
  if (!result.success) {
    const firstError = result.error.issues[0];
    throw new BadRequestError(firstError.message);
  }
  return result.data;
};


 // POST /api/posts/:postId/comments
 // Creates a comment on the given post.
 
export const create = async (req, res) => {
  const { postId } = parseWith(postIdParamsSchema, req.params);
  const { content } = parseWith(createCommentSchema, req.body);
  const comment = await commentService.create({
    postId,
    authorId: req.userId,
    content,
  });
  res.status(201).json({ comment });
};


 // GET /api/posts/:postId/comments
 // Returns all comments for the given post (if the viewer can see the post).
 
export const getByPost = async (req, res) => {
  const { postId } = parseWith(postIdParamsSchema, req.params);
  const comments = await commentService.getByPost({
    postId,
    viewerId: req.userId,
  });
  res.status(200).json({ comments });
};


 // PUT /api/comments/:commentId
 // Updates a comment. Only the author can edit their own comment.

export const update = async (req, res) => {
  const { commentId } = parseWith(commentIdParamsSchema, req.params);
  const { content } = parseWith(updateCommentSchema, req.body);
  const comment = await commentService.update({
    commentId,
    currentUserId: req.userId,
    content,
  });
  res.status(200).json({ comment });
};

// DELETE /api/comments/:commentId
// Deletes a comment. Comment author or post author can delete.
export const deleteComment = async (req, res) => {
  const { commentId } = parseWith(commentIdParamsSchema, req.params);
  await commentService.deleteComment({
    commentId,
    currentUserId: req.userId,
  });
  res.status(204).end();
};