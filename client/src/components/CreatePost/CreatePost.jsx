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
import Button from '../Button/Button.jsx';

import styles from './CreatePost.module.css';

const MAX_CONTENT_LENGTH = 5000;

const CreatePost = ({ onPostCreated }) => {
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
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
      <textarea
        className={styles.textarea}
        placeholder="What's on your mind?"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={MAX_CONTENT_LENGTH}
        rows={3}
        disabled={submitting}
      />

      <input
        type="url"
        className={styles.urlInput}
        placeholder="Image URL (optional)"
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
        disabled={submitting}
      />

      {error && <div className={styles.alert}>{error}</div>}

      <div className={styles.footer}>
        <div className={styles.left}>
          <label htmlFor="visibility-select" className={styles.visibilityLabel}>
            Who can see this?
          </label>
          <select
            id="visibility-select"
            className={styles.select}
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            disabled={submitting}
          >
            <option value="public">🌍 Public</option>
            <option value="friends">👥 Friends only</option>
            <option value="private">🔒 Only me</option>
          </select>
        </div>

        <div className={styles.right}>
          <span className={styles.counter}>
            {content.length}/{MAX_CONTENT_LENGTH}
          </span>
          <Button type="submit" disabled={!canSubmit} loading={submitting}>
            Post
          </Button>
        </div>
      </div>
    </form>
  );
};

export default CreatePost;