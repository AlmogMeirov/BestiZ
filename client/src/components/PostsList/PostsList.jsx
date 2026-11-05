/**
 * PostsList.jsx
 * A reusable wrapper that renders an array of posts as a stack of PostCards.
 * Handles loading, error, and empty states so callers don't have to.
 * `onDelete` and `onUpdate` are forwarded to each PostCard, the parent decides how to update its own state after a successful action.
 */

import PostCard from '../PostCard/PostCard.jsx';

import styles from './PostsList.module.css';
import { SkeletonGroup } from '../Skeleton/Skeleton.jsx';

const PostsList = ({
  posts,
  loading,
  error,
  emptyMessage = 'Nothing to show yet.',
  onDelete,
  onUpdate,
  /* Ids of posts that reached this list over the socket rather than from
     something the viewer did. They get a brief entrance so a live update is
     distinguishable from a page that was reloaded. */
  livePostIds,
}) => {
  if (loading) {
    return <SkeletonGroup label="Loading posts" count={3} />;
  }

  if (error) {
    return <div className={styles.alert}>{error}</div>;
  }

  if (!posts || posts.length === 0) {
    return <div className={styles.empty}>{emptyMessage}</div>;
  }

  return (
    <div className={styles.list}>
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onDelete={onDelete}
          onUpdate={onUpdate}
          arrivedLive={livePostIds?.has(post.id) ?? false}
        />
      ))}
    </div>
  );
};

export default PostsList;