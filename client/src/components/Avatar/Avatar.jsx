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


/**
 * The palette.
 *
 * Each entry is a pair: a lighter top and a darker bottom, rendered as a
 * short diagonal gradient. A flat disc of colour looks like a placeholder;
 * the gradient, plus the highlight in the CSS, makes it read as an object.
 *
 * Eight hues rather than ten, each at a similar lightness, so a feed of
 * avatars looks like one set instead of a paint chart — and so white
 * initials stay legible on every one of them.
 */
const PALETTE = [
  ['#8A7BFF', '#5A48E8'], // violet, the brand hue
  ['#6FA8FF', '#2F6FE4'], // blue
  ['#2FD3A8', '#10A37F'], // green
  ['#FF8A7D', '#F2553F'], // coral
  ['#FFB65C', '#E8871E'], // amber
  ['#F27DBB', '#D4479A'], // pink
  ['#5FD0E0', '#1F9BB3'], // cyan
  ['#A98BFF', '#7C4DE0'], // purple
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
  const [light, dark] = PALETTE[hashString(seed) % PALETTE.length];

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
        backgroundImage: `linear-gradient(145deg, ${light}, ${dark})`,
      }}
      role="img"
      aria-label={name ? `${name}'s avatar` : 'avatar'}
    >
      {initials}
    </div>
  );
};

export default Avatar;