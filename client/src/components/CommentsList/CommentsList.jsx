/**
 * CommentsList.jsx
 * Displays the comments section for a single post with real-time updates:
 *  - A textarea + button to add a new comment.
 *  - A list of Comment components.
 *  - Socket subscription for comment events on this post.
 * Count reporting: rather than calling `onCountChange` inside event handlers (which can trigger setState in the parent during another component's render),
 * My report the count in a useEffect that runs AFTER the render commits.
 * This keeps the parent's state update cleanly scheduled and silences React's "setState during render" warning.
 */

import { useCallback, useEffect, useState } from 'react';

import * as commentsApi from '../../api/commentsApi.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { getSocket } from '../../socket/socketClient.js';
import { SOCKET_EVENTS } from '../../socket/socketEvents.js';
import Button from '../Button/Button.jsx';
import Comment from '../Comment/Comment.jsx';

import styles from './CommentsList.module.css';

const MAX_CONTENT_LENGTH = 1000;

const CommentsList = ({ postId, postAuthorId, onCountChange }) => {
  const { user: currentUser } = useAuth();

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newContent, setNewContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [composeError, setComposeError] = useState('');

  // Push count updates to the parent in an effect that runs after commit.
  // This avoids "setState during render" warnings when our own state
  // changes cause the parent to re-render.
  useEffect(() => {
    if (!loading) {
      onCountChange?.(comments.length);
    }
  }, [comments.length, loading, onCountChange]);

  const loadComments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await commentsApi.getCommentsByPost(postId);
      setComments(data);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Subscribe to real-time comment events. Only events for THIS post are applied.
  // events for other posts are ignored (each PostCard has its own CommentsList that handles its own events).
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !currentUser) return undefined;

    const handleCreated = ({ comment }) => {
      if (comment.post_id !== postId) return;
      if (comment.author_id === currentUser.id) return;

      setComments((prev) => {
        if (prev.some((c) => c.id === comment.id)) return prev;
        return [comment, ...prev];
      });
    };

    const handleUpdated = ({ comment }) => {
      if (comment.post_id !== postId) return;
      if (comment.author_id === currentUser.id) return;

      setComments((prev) =>
        prev.map((c) => (c.id === comment.id ? comment : c))
      );
    };

    const handleDeleted = ({ commentId, postId: targetPostId }) => {
      if (targetPostId !== postId) return;

      setComments((prev) => {
        const existing = prev.find((c) => c.id === commentId);
        if (existing && existing.author_id === currentUser.id) {
          return prev;
        }
        return prev.filter((c) => c.id !== commentId);
      });
    };
    // Note: we listen to ALL comment events, but only apply those that match our postId and aren't from the current user.
    socket.on(SOCKET_EVENTS.COMMENT_CREATED, handleCreated);
    socket.on(SOCKET_EVENTS.COMMENT_UPDATED, handleUpdated);
    socket.on(SOCKET_EVENTS.COMMENT_DELETED, handleDeleted);

    return () => {
      socket.off(SOCKET_EVENTS.COMMENT_CREATED, handleCreated);
      socket.off(SOCKET_EVENTS.COMMENT_UPDATED, handleUpdated);
      socket.off(SOCKET_EVENTS.COMMENT_DELETED, handleDeleted);
    };
  }, [postId, currentUser]);

  const trimmed = newContent.trim();
  const canSubmit = trimmed.length > 0 && !submitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setComposeError('');
    try {
      const newComment = await commentsApi.createComment(postId, {
        content: trimmed,
      });
      setComments((prev) => {
        if (prev.some((c) => c.id === newComment.id)) return prev;
        return [newComment, ...prev];
      });
      setNewContent('');
    } catch (err) {
      setComposeError(
        err?.response?.data?.error || 'Failed to add comment'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId) => {
    const backup = comments;
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    try {
      await commentsApi.deleteComment(commentId);
    } catch (err) {
      setComments(backup);
      setError(err?.response?.data?.error || 'Failed to delete comment');
    }
  };

  const handleUpdate = (updatedComment) => {
    setComments((prev) =>
      prev.map((c) => (c.id === updatedComment.id ? updatedComment : c))
    );
  };

  return (
    <section className={styles.section}>
      <form className={styles.composeForm} onSubmit={handleSubmit}>
        <textarea
          className={styles.composeTextarea}
          placeholder="Add a comment..."
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          maxLength={MAX_CONTENT_LENGTH}
          rows={2}
          disabled={submitting}
        />
        {composeError && <div className={styles.alert}>{composeError}</div>}
        <div className={styles.composeFooter}>
          <span className={styles.counter}>
            {newContent.length}/{MAX_CONTENT_LENGTH}
          </span>
          <Button
            type="submit"
            disabled={!canSubmit}
            loading={submitting}
          >
            Comment
          </Button>
        </div>
      </form>

      {loading && (
        <div className={styles.message}>Loading comments...</div>
      )}

      {error && <div className={styles.alert}>{error}</div>}

      {!loading && !error && comments.length === 0 && (
        <div className={styles.empty}>No comments yet. Be the first!</div>
      )}

      {!loading && comments.length > 0 && (
        <div className={styles.list}>
          {comments.map((comment) => (
            <Comment
              key={comment.id}
              comment={comment}
              postAuthorId={postAuthorId}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default CommentsList;