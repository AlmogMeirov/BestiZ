/**
 * Comment.jsx
 * Displays a single comment with two modes:
 *  - View mode: author, content, timestamp, edit/delete buttons.
 *  - Edit mode: a textarea with Save/Cancel.
 * Edit/delete visibility depends on the viewer:
 *  - Comment author can edit and delete.
 *  - Post author can delete (but not edit) — moderation primitive.
 * Like PostCard, edit and delete are delegated to the parent via callbacks.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext.jsx';
import * as commentsApi from '../../api/commentsApi.js';
import Button from '../Button/Button.jsx';

import styles from './Comment.module.css';

const MAX_CONTENT_LENGTH = 1000;

// Simple relative time formatter (e.g. "5m ago", "2h ago", "3d ago", or date for >1 week).
const formatRelativeTime = (isoString) => {
  const then = new Date(isoString).getTime();
  const now = Date.now();
  const diffSeconds = Math.max(0, Math.floor((now - then) / 1000));

  if (diffSeconds < 60) return 'just now';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  if (diffSeconds < 7 * 86400) return `${Math.floor(diffSeconds / 86400)}d ago`;
  return new Date(isoString).toLocaleDateString();
};

// Main component function. Relies on parent to pass comment data and handle updates/deletion.
const Comment = ({ comment, postAuthorId, onDelete, onUpdate }) => {
  const { user: currentUser } = useAuth();

  const isAuthor = currentUser?.id === comment.author_id;
  const isPostAuthor = currentUser?.id === postAuthorId;
  const canEdit = isAuthor;
  const canDelete = isAuthor || isPostAuthor;
  const wasEdited =
    comment.updated_at && comment.updated_at !== comment.created_at;

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const enterEditMode = () => {
    setEditContent(comment.content);
    setEditError('');
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditError('');
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this comment?')) {
      return;
    }
    onDelete?.(comment.id);
  };

  const handleSave = async () => {
    const trimmed = editContent.trim();
    if (trimmed.length === 0) {
      setEditError('Comment cannot be empty');
      return;
    }
    if (trimmed === comment.content) {
      // Nothing changed — just close.
      setIsEditing(false);
      return;
    }

    setSaving(true);
    setEditError('');
    try {
      const updated = await commentsApi.updateComment(comment.id, {
        content: trimmed,
      });
      onUpdate?.(updated);
      setIsEditing(false);
    } catch (err) {
      setEditError(err?.response?.data?.error || 'Failed to update comment');
    } finally {
      setSaving(false);
    }
  };
// Render either the edit mode or the view mode.
  if (isEditing) {
    return (
      <article className={styles.comment}>
        <header className={styles.header}>
          <div className={styles.author}>
            <span className={styles.displayName}>
              {comment.author_display_name}
            </span>
            <span className={styles.username}>@{comment.author_username}</span>
          </div>
          <span className={styles.editingBadge}>Editing</span>
        </header>

        <textarea
          className={styles.editTextarea}
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          maxLength={MAX_CONTENT_LENGTH}
          rows={2}
          disabled={saving}
          autoFocus
        />

        {editError && <div className={styles.alert}>{editError}</div>}

        <div className={styles.editFooter}>
          <span className={styles.counter}>
            {editContent.length}/{MAX_CONTENT_LENGTH}
          </span>
          <div className={styles.editButtons}>
            <Button variant="secondary" onClick={cancelEdit} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Save
            </Button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={styles.comment}>
      <header className={styles.header}>
        <Link
          to={`/users/${comment.author_id}`}
          className={styles.author}
        >
          <span className={styles.displayName}>
            {comment.author_display_name}
          </span>
          <span className={styles.username}>@{comment.author_username}</span>
        </Link>
      </header>

      <p className={styles.content}>{comment.content}</p>

      <footer className={styles.footer}>
        <span className={styles.timestamp}>
          {formatRelativeTime(comment.created_at)}
          {wasEdited && <span className={styles.editedTag}> · edited</span>}
        </span>
        {(canEdit || canDelete) && (
          <div className={styles.actions}>
            {canEdit && (
              <button
                type="button"
                className={styles.linkButton}
                onClick={enterEditMode}
              >
                Edit
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                className={`${styles.linkButton} ${styles.linkButtonDanger}`}
                onClick={handleDelete}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </footer>
    </article>
  );
};

export default Comment;