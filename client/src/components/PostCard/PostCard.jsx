/**
 * PostCard.jsx
 * Displays a single post with two modes (view / edit) and a collapsible comments section below.
 * Comments are loaded lazily' only when the user clicks "Show comments" for this specific post.
 * This keeps the feed fast: scrolling past 50 posts doesn't trigger 50 comment requests.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext.jsx';
import * as postsApi from '../../api/postsApi.js';
import Button from '../Button/Button.jsx';
import CommentsList from '../CommentsList/CommentsList.jsx';

import styles from './PostCard.module.css';

const MAX_CONTENT_LENGTH = 5000;

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

const visibilityMeta = {
  public: { label: 'Public', icon: '🌍' },
  friends: { label: 'Friends', icon: '👥' },
  private: { label: 'Private', icon: '🔒' },
};

const PostCard = ({ post, onDelete, onUpdate }) => {
  const { user: currentUser } = useAuth();

  const isOwnPost = currentUser?.id === post.author_id;
  const meta = visibilityMeta[post.visibility] || visibilityMeta.public;
  const wasEdited = post.updated_at && post.updated_at !== post.created_at;

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [editImageUrl, setEditImageUrl] = useState(post.image_url || '');
  const [editVisibility, setEditVisibility] = useState(post.visibility);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Comments state
  const [showComments, setShowComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState(null);

  const enterEditMode = () => {
    setEditContent(post.content);
    setEditImageUrl(post.image_url || '');
    setEditVisibility(post.visibility);
    setEditError('');
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditError('');
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this post? This cannot be undone.')) {
      return;
    }
    onDelete?.(post.id);
  };

  const handleSave = async () => {
    const trimmed = editContent.trim();
    if (trimmed.length === 0) {
      setEditError('Content cannot be empty');
      return;
    }

    const updates = {};
    if (trimmed !== post.content) {
      updates.content = trimmed;
    }
    const newImageUrl = editImageUrl.trim();
    if (newImageUrl !== (post.image_url || '')) {
      updates.imageUrl = newImageUrl === '' ? null : newImageUrl;
    }
    if (editVisibility !== post.visibility) {
      updates.visibility = editVisibility;
    }

    if (Object.keys(updates).length === 0) {
      setIsEditing(false);
      return;
    }

    setSaving(true);
    setEditError('');
    try {
      const updatedPost = await postsApi.updatePost(post.id, updates);
      onUpdate?.(updatedPost);
      setIsEditing(false);
    } catch (err) {
      setEditError(err?.response?.data?.error || 'Failed to update post');
    } finally {
      setSaving(false);
    }
  };

  //Edit mode render 

  if (isEditing) {
    return (
      <article className={styles.card}>
        <header className={styles.header}>
          <div className={styles.author}>
            <span className={styles.displayName}>{post.author_display_name}</span>
            <span className={styles.username}>@{post.author_username}</span>
          </div>
          <span className={styles.editingBadge}>Editing</span>
        </header>

        <textarea
          className={styles.editTextarea}
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          maxLength={MAX_CONTENT_LENGTH}
          rows={3}
          disabled={saving}
          autoFocus
        />

        <input
          type="url"
          className={styles.editInput}
          placeholder="Image URL (optional)"
          value={editImageUrl}
          onChange={(e) => setEditImageUrl(e.target.value)}
          disabled={saving}
        />

        {editError && <div className={styles.alert}>{editError}</div>}

        <div className={styles.editFooter}>
          <select
            className={styles.editSelect}
            value={editVisibility}
            onChange={(e) => setEditVisibility(e.target.value)}
            disabled={saving}
          >
            <option value="public">🌍 Public</option>
            <option value="friends">👥 Friends only</option>
            <option value="private">🔒 Only me</option>
          </select>

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

  // View mode render

  // Build the comments toggle label. Once we know the count, show it.
  const commentsLabel = showComments
    ? 'Hide comments'
    : commentsCount === null
      ? 'Show comments'
      : commentsCount === 0
        ? 'Add a comment'
        : `Show comments (${commentsCount})`;

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <Link to={`/users/${post.author_id}`} className={styles.author}>
          <span className={styles.displayName}>{post.author_display_name}</span>
          <span className={styles.username}>@{post.author_username}</span>
        </Link>
        <span className={styles.visibility} title={meta.label}>
          {meta.icon} {meta.label}
        </span>
      </header>

      <p className={styles.content}>{post.content}</p>

      {post.image_url && (
        <img
          src={post.image_url}
          alt=""
          className={styles.image}
          loading="lazy"
        />
      )}

      <footer className={styles.footer}>
        <span className={styles.timestamp}>
          {formatRelativeTime(post.created_at)}
          {wasEdited && <span className={styles.editedTag}> · edited</span>}
        </span>
        <div className={styles.footerRight}>
          <button
            type="button"
            className={styles.commentsToggle}
            onClick={() => setShowComments((prev) => !prev)}
          >
            {commentsLabel}
          </button>
          {isOwnPost && (
            <div className={styles.actions}>
              <Button variant="secondary" onClick={enterEditMode}>
                Edit
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          )}
        </div>
      </footer>

      {showComments && (
        <CommentsList
          postId={post.id}
          postAuthorId={post.author_id}
          onCountChange={setCommentsCount}
        />
      )}
    </article>
  );
};

export default PostCard;