/**
 * EditProfileModal.
 * Lets the authenticated user update their profile: display name, email and bio.
 * The username is intentionally read-only, it serves as a stable identity and changing it would break mentions and existing links.
 * Form ergonomics:
 *  - Pre-fills the current values so the user only edits what they want.
 *  - Submits only the fields that actually changed (avoids a no-op write).
 *  - Closes on success; surfaces server errors inline on failure.
 */

import { useState } from 'react';

import * as usersApi from '../../api/usersApi.js';
import Button from '../Button/Button.jsx';

import styles from './EditProfileModal.module.css';

const BIO_MAX = 160;

const EditProfileModal = ({ user, onClose, onUpdated }) => {
  const [displayName, setDisplayName] = useState(user.display_name || '');
  const [email, setEmail] = useState(user.email || '');
  const [bio, setBio] = useState(user.bio || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Only include fields that actually changed to avoid unnecessary writes.
    const updates = {};
    if (displayName.trim() !== user.display_name) {
      updates.display_name = displayName.trim();
    }
    if (email.trim().toLowerCase() !== user.email) {
      updates.email = email.trim();
    }
    // For bio, compare against the trimmed-or-empty form of the current
    // value so toggling between '' and null doesn't show as a "change".
    const currentBio = (user.bio || '').trim();
    if (bio.trim() !== currentBio) {
      updates.bio = bio.trim();
    }

    if (Object.keys(updates).length === 0) {
      onClose();
      return;
    }

    setSubmitting(true);
    try {
      const updated = await usersApi.updateProfile(updates);
      onUpdated(updated);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.dialog} role="dialog" aria-modal="true">
        <h2 className={styles.title}>Edit profile</h2>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="edit-username">
              Username
            </label>
            <input
              id="edit-username"
              type="text"
              className={styles.input}
              value={user.username}
              disabled
            />
            <span className={styles.hint}>Usernames cannot be changed.</span>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="edit-display-name">
              Display name
            </label>
            <input
              id="edit-display-name"
              type="text"
              className={styles.input}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              required
              disabled={submitting}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="edit-email">
              Email
            </label>
            <input
              id="edit-email"
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="edit-bio">
              Bio
            </label>
            <textarea
              id="edit-bio"
              className={styles.textarea}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={BIO_MAX}
              rows={3}
              placeholder="Tell others a little about yourself..."
              disabled={submitting}
            />
            <span className={styles.counter}>
              {bio.length}/{BIO_MAX}
            </span>
          </div>

          {error && <div className={styles.alert}>{error}</div>}

          <div className={styles.actions}>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Save changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfileModal;