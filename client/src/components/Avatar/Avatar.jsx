/**
 * Avatar.jsx
 *
 * A simple avatar component that generates a colored circle with the user's.
 * Renders a circular avatar with the user's initials on a colored background.
 * The color is derived deterministically from the user's id, so the same user always gets the same color across the app — like the avatars in Gmail or Slack.
 */

import styles from './Avatar.module.css';

// Predefined size presets in pixels.
const SIZE_PRESETS = {
  sm: 32,
  md: 44,
  lg: 64,
  xl: 96,
};


// A small palette of background colors. The hash function below picks an index into this palette.
const PALETTE = [
  '#6366f1', 
  '#8b5cf6', 
  '#ec4899', 
  '#ef4444', 
  '#f59e0b', 
  '#10b981',
  '#14b8a6',
  '#0ea5e9', 
  '#3b82f6', 
  '#f97316', 
];

// A simple hash function to convert a string into a number. This is used to pick a color from the palette based on the userId or name.
const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const getInitials = (name) => {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length === 0 || words[0].length === 0) return '?';
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (
    words[0].charAt(0).toUpperCase() +
    words[words.length - 1].charAt(0).toUpperCase()
  );
};

const Avatar = ({ name, userId, size = 'md', className = '' }) => {
  const pixelSize =
    typeof size === 'number' ? size : SIZE_PRESETS[size] || SIZE_PRESETS.md;

  // Use userId for deterministic coloring when available, otherwise fall back to the name. Either way, the same user always gets the same color.
  const seed = userId || name || 'unknown';
  const colorIndex = hashString(seed) % PALETTE.length;
  const backgroundColor = PALETTE[colorIndex];

  const initials = getInitials(name);

  // Font size proportional to the avatar, about 40% feels right.
  const fontSize = Math.round(pixelSize * 0.4);

  return (
    <div
      className={`${styles.avatar} ${className}`}
      style={{
        width: pixelSize,
        height: pixelSize,
        fontSize,
        backgroundColor,
      }}
      role="img"
      aria-label={name ? `${name}'s avatar` : 'avatar'}
    >
      {initials}
    </div>
  );
};

export default Avatar;