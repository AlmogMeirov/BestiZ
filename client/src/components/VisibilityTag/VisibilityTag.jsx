/**
 * The small label saying who can see a post.
 *
 * It used to be an emoji and a word. Emoji are drawn by the operating system,
 * so the same character is a different picture on Windows, macOS and Android
 * — different colours, different weight, sometimes a different subject. An
 * interface cannot be designed around a glyph it does not control, which is
 * why these are inline SVG instead: one line weight, one colour, inherited
 * from the text beside them.
 *
 * "friends" is the only value that gets the brand colour. Public is the
 * default and needs no emphasis; private concerns nobody but the author.
 */

import styles from './VisibilityTag.module.css';

const ICONS = {
  // A globe: the meridians are what make it read as a world rather than a
  // clock at this size.
  public: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
    </>
  ),
  // Two people, one slightly behind the other.
  friends: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <circle cx="17" cy="9" r="2.6" />
      <path d="M15.5 20a5.5 5.5 0 0 1 5.5-5.5" />
    </>
  ),
  private: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
};

const LABELS = {
  public: 'Public',
  friends: 'Friends',
  private: 'Only me',
};

const VisibilityTag = ({ visibility }) => {
  const key = ICONS[visibility] ? visibility : 'public';

  return (
    <span
      className={`${styles.tag} ${key === 'friends' ? styles.friends : ''}`}
      title={`Visible to: ${LABELS[key]}`}
    >
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        {ICONS[key]}
      </svg>
      {LABELS[key]}
    </span>
  );
};

export default VisibilityTag;
