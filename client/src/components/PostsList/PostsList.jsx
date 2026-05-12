/**
 * PostsList.jsx
 * A reusable wrapper that renders an array of posts as a stack of PostCards.
 * Handles loading, error, and empty states so callers don't have to.
 * `onDelete` and `onUpdate` are forwarded to each PostCard, the parent decides how to update its own state after a successful action.
 */

import PostCard from '../PostCard/PostCard.jsx';

import styles from './PostsList.module.css';

const PostsList = ({
  posts,
  loading,
  error,
  emptyMessage = 'Nothing to show yet.',
  onDelete,
  onUpdate,
}) => {
  if (loading) {
    return <div className={styles.message}>Loading posts...</div>;
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
        />
      ))}
    </div>
  );
};

export default PostsList;