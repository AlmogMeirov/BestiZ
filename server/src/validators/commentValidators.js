/**
 * Validation schemas for comment endpoints.
 * This file defines Zod schemas for validating request bodies and URL parameters related to comment creation, updating, and retrieval.
 * It ensures that incoming data adheres to expected formats and constraints before processing.
 */

import { z } from 'zod';

import { requiredString } from './requiredString.js';


// Body schema for POST /api/posts/:postId/comments.
export const createCommentSchema = z.object({
  content: requiredString('Content is required')
    .trim()
    .min(1, 'Content cannot be empty')
    .max(1000, 'Content cannot exceed 1000 characters'),
});


 // Body schema for PUT /api/comments/:commentId.
 // Currently only content is editable.
export const updateCommentSchema = z.object({
  content: requiredString('Content is required')
    .trim()
    .min(1, 'Content cannot be empty')
    .max(1000, 'Content cannot exceed 1000 characters'),
});

 // URL params schema for /api/posts/:postId/comments.
export const postIdParamsSchema = z.object({
  postId: requiredString('postId is required')
    .uuid('postId must be a valid UUID'),
});


 // URL params schema for /api/comments/:commentId.
export const commentIdParamsSchema = z.object({
  commentId: requiredString('commentId is required')
    .uuid('commentId must be a valid UUID'),
});