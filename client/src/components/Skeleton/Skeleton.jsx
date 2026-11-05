/**
 * Loading placeholders.
 *
 * These replaced the word "Loading…", which told the reader that something
 * was happening but nothing about what. A skeleton is a promise with a
 * shape: it occupies the space the real content will occupy, so when the data
 * lands nothing moves, and the page never reflows under someone's eyes.
 *
 * The shimmer is what separates "still loading" from "empty". Without it a
 * grey block is indistinguishable from a broken image, which is why the
 * animation lives in the global stylesheet and is switched off — but not
 * replaced — for anyone who has asked for reduced motion.
 *
 * Every placeholder is hidden from assistive technology and announced once by
 * the wrapper instead. A screen reader should hear "Loading", not a list of
 * eleven empty boxes.
 */

import styles from './Skeleton.module.css';

/** One shimmering bar. Width is given per use; height defaults to a line. */
export const Bar = ({ width = '100%', height = 11, radius, style }) => (
  <span
    className="bestiz-skeleton"
    aria-hidden="true"
    style={{
      display: 'block',
      width,
      height,
      borderRadius: radius,
      ...style,
    }}
  />
);

/** A circle, for where an avatar is about to appear. */
export const Circle = ({ size = 42 }) => (
  <Bar width={size} height={size} radius="50%" />
);

/**
 * The shape of a post: avatar, two lines of identity, a visibility tag, and
 * three lines of text that stop short the way a paragraph does.
 */
export const PostSkeleton = () => (
  <div className={styles.post}>
    <div className={styles.head}>
      <Circle />
      <div className={styles.headText}>
        <Bar width={132} />
        <Bar width={84} height={9} />
      </div>
      <Bar width={76} height={24} radius="999px" />
    </div>
    <Bar />
    <Bar width="94%" />
    <Bar width="61%" />
  </div>
);

/** The shape of a row in a list of people. */
export const PersonSkeleton = () => (
  <div className={styles.person}>
    <Circle size={44} />
    <div className={styles.headText}>
      <Bar width={148} />
      <Bar width={92} height={9} />
    </div>
    <Bar width={104} height={34} radius="999px" />
  </div>
);

/** The shape of a conversation: bubbles alternating sides. */
export const ThreadSkeleton = () => (
  <div className={styles.thread}>
    <Bar width="62%" height={38} radius="16px" />
    <Bar
      width="74%"
      height={54}
      radius="16px"
      style={{ marginLeft: 'auto' }}
    />
    <Bar width="48%" height={38} radius="16px" />
    <Bar
      width="68%"
      height={38}
      radius="16px"
      style={{ marginLeft: 'auto' }}
    />
  </div>
);

/**
 * Wraps a set of placeholders and gives them a single spoken label.
 *
 * `aria-busy` tells assistive technology the region is mid-update, so the
 * announcement happens once rather than on every placeholder.
 */
export const SkeletonGroup = ({ label = 'Loading', count = 2, children }) => (
  <div className={styles.group} role="status" aria-busy="true" aria-label={label}>
    {children ??
      Array.from({ length: count }, (_, index) => (
        <PostSkeleton key={index} />
      ))}
  </div>
);

export default SkeletonGroup;
