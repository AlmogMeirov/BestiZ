/**
 * Post HTTP controllers.
 * Validates input, calls the service, formats responses.
 * Privacy and authorization live in postService.
 */

import * as postService from '../services/postService.js';
import {
  createPostSchema,
  updatePostSchema,
  postIdParamsSchema,
  userIdParamsSchema,
  feedQuerySchema,
} from '../validators/postValidators.js';
import { BadRequestError } from '../middleware/errorHandler.js';


 // Parses an input object against a Zod schema, throwing BadRequestError with the first issue message on failure.
const parseWith = (schema, input) => {
  const result = schema.safeParse(input);
  if (!result.success) {
    const firstError = result.error.issues[0];
    throw new BadRequestError(firstError.message);
  }
  return result.data;
};


 // POST /api/posts
 // Creates a new post authored by the current user.
export const create = async (req, res) => {
  const { content, imageUrl, visibility } = parseWith(
    createPostSchema,
    req.body
  );
  const post = await postService.create({
    authorId: req.userId,
    content,
    imageUrl,
    visibility,
  });
  res.status(201).json({ post });
};


 // GET /api/posts/feed?before=...&limit=...&filter=...
 // Returns the personalized feed for the current user.
 // `filter` is optional: 'all' | 'mine' | 'friends' (defaults to 'all').
export const getFeed = async (req, res) => {
  const { before, limit, filter } = parseWith(feedQuerySchema, req.query);
  const posts = await postService.getFeed({
    userId: req.userId,
    before,
    limit,
    filter,
  });
  res.status(200).json({ posts });
};

 // GET /api/posts/users/:userId?before=...&limit=...
 // Returns posts authored by the given user that the viewer can see.
export const getByAuthor = async (req, res) => {
  const { userId } = parseWith(userIdParamsSchema, req.params);
  const { before, limit } = parseWith(feedQuerySchema, req.query);
  const posts = await postService.getByAuthor({
    authorId: userId,
    viewerId: req.userId,
    before,
    limit,
  });
  res.status(200).json({ posts });
};


 // GET /api/posts/:postId
 // Returns a single post if the viewer is allowed to see it.
export const getById = async (req, res) => {
  const { postId } = parseWith(postIdParamsSchema, req.params);
  const post = await postService.getById({
    postId,
    viewerId: req.userId,
  });
  res.status(200).json({ post });
};


 // PUT /api/posts/:postId
 // Updates a post. 
 // Only the author can edit their own post.
export const update = async (req, res) => {
  const { postId } = parseWith(postIdParamsSchema, req.params);
  const updates = parseWith(updatePostSchema, req.body);
  const post = await postService.update({
    postId,
    currentUserId: req.userId,
    updates,
  });
  res.status(200).json({ post });
};


 // DELETE /api/posts/:postId
 // Deletes a post. Only the author can delete their own post.
export const deletePost = async (req, res) => {
  const { postId } = parseWith(postIdParamsSchema, req.params);
  await postService.deletePost({
    postId,
    currentUserId: req.userId,
  });
  res.status(204).end();
};