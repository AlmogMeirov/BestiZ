/**
 * CreatePost.
 * A form for composing a new post:
 *  - Content textarea (required, up to 5000 chars).
 *  - Optional image URL.
 *  - Visibility selector (public / friends / private).
 * On successful submission, calls `onPostCreated` with the new post so the parent can prepend it to the feed without a full reload.
 */

import { useState } from 'react';

import * as postsApi from '../../api/postsApi.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import Avatar from '../Avatar/Avatar.jsx';
import Button from '../Button/Button.jsx';

import styles from './CreatePost.module.css';

const MAX_CONTENT_LENGTH = 5000;

/*
 * The three audiences, in order of reach. Each is a radio rather than an
 * option in a dropdown: there are only three, they are the single most
 * consequential choice on this form, and a dropdown hides two thirds of a
 * decision behind a click.
 */
const AUDIENCES = [
  { value: 'public', label: 'Public' },
  { value: 'friends', label: 'Friends' },
  { value: 'private', label: 'Only me' },
];

const CreatePost = ({ onPostCreated }) => {
  const { user } = useAuth();

  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  // The image field stays out of the way until it is wanted. Most posts are
  // text, and an empty input is still a thing to read past.
  const [showImageField, setShowImageField] = useState(false);
  const [visibility, setVisibility] = useState('public');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const trimmedContent = content.trim();
  const canSubmit = trimmedContent.length > 0 && !submitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError('');
    try {
      const post = await postsApi.createPost({
        content: trimmedContent,
        imageUrl: imageUrl.trim() || undefined,
        visibility,
      });
      // Reset the form on success.
      setContent('');
      setImageUrl('');
      setVisibility('public');
      // Hand the new post to the parent so it can update its list.
      onPostCreated?.(post);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to create post');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className={styles.card} onSubmit={handleSubmit}>
      <div className={styles.composeRow}>
        {user && (
          <Avatar
            name={user.display_name || user.username}
            userId={user.id}
            size={42}
          />
        )}
        <textarea
          className={styles.textarea}
          placeholder="What's on your mind?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={MAX_CONTENT_LENGTH}
          rows={2}
          disabled={submitting}
          aria-label="Post content"
        />
      </div>

      {showImageField && (
        <input
          type="url"
          className={styles.urlInput}
          placeholder="Paste an image link"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          disabled={submitting}
          aria-label="Image URL"
          autoFocus
        />
      )}

      {error && <div className={styles.alert}>{error}</div>}

      <div className={styles.footer}>
        <fieldset className={styles.audience} disabled={submitting}>
          <legend className={styles.srOnly}>Who can see this?</legend>
          {AUDIENCES.map((option) => (
            <label key={option.value} className={styles.chip}>
              <input
                type="radio"
                name="visibility"
                value={option.value}
                checked={visibility === option.value}
                onChange={(e) => setVisibility(e.target.value)}
                className={styles.srOnly}
              />
              <span className={styles.chipFace}>{option.label}</span>
            </label>
          ))}
        </fieldset>

        <button
          type="button"
          className={`${styles.iconButton} ${
            showImageField ? styles.iconButtonOn : ''
          }`}
          onClick={() => {
            setShowImageField((open) => !open);
            if (showImageField) setImageUrl('');
          }}
          disabled={submitting}
          aria-pressed={showImageField}
          aria-label="Add an image"
          title="Add an image"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <circle cx="8.5" cy="9.5" r="1.6" />
            <path d="m4 17 5-5 4 4 2.5-2.5L20 17" />
          </svg>
        </button>

        <span className={styles.counter}>
          {content.length} / {MAX_CONTENT_LENGTH}
        </span>

        <Button type="submit" disabled={!canSubmit} loading={submitting}>
          Post
        </Button>
      </div>
    </form>
  );
};

export default CreatePost;