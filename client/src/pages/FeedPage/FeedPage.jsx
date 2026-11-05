/**
 * Feed page.jsx
 * This is the main feed page where users see posts from themselves and others.
 * Key features:
 * Filters: a tab strip lets the user switch the feed between:
 *  - 'all' — everything they can see (default).
 *  - 'mine' — only their own posts.
 *  - 'friends' — only their friends' posts.
 * Switching the filter resets the list and starts pagination from the
 * top of the new filtered timeline.
 *
 * Pagination: cursor based infinite scroll via IntersectionObserver.
 * Stable cursors mean real-time inserts at the top don't cause duplicate or skipped rows in older pages.
 *
 * Real-time: server emits to a broad audience, client filters by both
 * visibility (canViewerSee) AND the active filter tab — a friends-only
 * post arriving while we're on the 'mine' tab is correctly ignored.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import * as postsApi from '../../api/postsApi.js';
import * as friendsApi from '../../api/friendsApi.js';
import CreatePost from '../../components/CreatePost/CreatePost.jsx';
import FilterTabs from '../../components/FilterTabs/FilterTabs.jsx';
import PostsList from '../../components/PostsList/PostsList.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { connectSocket } from '../../socket/socketClient.js';
import { SOCKET_EVENTS } from '../../socket/socketEvents.js';

import styles from './FeedPage.module.css';
import ProfileRail from '../../components/ProfileRail/ProfileRail.jsx';
import ActivityRail from '../../components/ActivityRail/ActivityRail.jsx';

const PAGE_SIZE = 10;

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'Mine' },
  { value: 'friends', label: 'Friends' },
];

const canViewerSee = (post, currentUserId, friendIds) => {
  if (post.author_id === currentUserId) return true;
  if (post.visibility === 'public') return true;
  if (post.visibility === 'private') return false;
  if (post.visibility === 'friends') {
    return friendIds.has(post.author_id);
  }
  return false;
};

// Determines if a post matches the active filter and should be shown in the feed.
// Mirrors the server-side filter logic in postRepository,findFeed.
const matchesFilter = (post, filter, currentUserId, friendIds) => {
  if (filter === 'mine') {
    return post.author_id === currentUserId;
  }
  if (filter === 'friends') {
    if (post.author_id === currentUserId) return false;
    if (post.visibility === 'private') return false;
    return friendIds.has(post.author_id);
  }
  // 'all' — defer to standard visibility rules.
  return canViewerSee(post, currentUserId, friendIds);
};

const FeedPage = () => {
  const { user: currentUser } = useAuth();
  const [posts, setPosts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [friendIds, setFriendIds] = useState(() => new Set());
  /**
   * Posts that arrived over the socket.
   *
   * Held in a ref rather than state: the value is only ever read while
   * rendering a post that has just been added, and putting it in state would
   * schedule a second render for information the first one already has.
   *
   * Nothing is ever removed. The CSS animation runs once when the element
   * mounts, so an id that stays in the set has no further effect, and the set
   * is discarded with the page.
   */
  const livePostIds = useRef(new Set());

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');

  const sentinelRef = useRef(null);

  const loadFirstPage = useCallback(async (activeFilter) => {
    setLoading(true);
    setError('');
    try {
      const data = await postsApi.getFeed({
        limit: PAGE_SIZE,
        filter: activeFilter === 'all' ? undefined : activeFilter,
      });
      setPosts(data);
      setHasMore(data.length === PAGE_SIZE);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load feed');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFriendIds = useCallback(async () => {
    try {
      const friends = await friendsApi.getFriends();
      setFriendIds(new Set(friends.map((f) => f.id)));
    } catch {
      // Non-fatal; visibility falls back to server on refresh.
    }
  }, []);

  // Initial load and reload when the filter changes.
  useEffect(() => {
    loadFirstPage(filter);
  }, [filter, loadFirstPage]);

  useEffect(() => {
    loadFriendIds();
  }, [loadFriendIds]);

  // Infinite scroll: load older posts when the sentinel enters the viewport.
  useEffect(() => {
    if (!hasMore || loading || posts.length === 0) return undefined;

    const observer = new IntersectionObserver(
      async (entries) => {
        const entry = entries[0];
        if (!entry.isIntersecting || loadingMore) return;

        setLoadingMore(true);
        setError('');
        try {
          const oldest = posts[posts.length - 1];
          const next = await postsApi.getFeed({
            before: oldest.created_at,
            limit: PAGE_SIZE,
            filter: filter === 'all' ? undefined : filter,
          });
          setPosts((prev) => {
            const known = new Set(prev.map((p) => p.id));
            const fresh = next.filter((p) => !known.has(p.id));
            return [...prev, ...fresh];
          });
          setHasMore(next.length === PAGE_SIZE);
        } catch (err) {
          setError(err?.response?.data?.error || 'Failed to load more posts');
        } finally {
          setLoadingMore(false);
        }
      },
      { rootMargin: '200px' }
    );

    const node = sentinelRef.current;
    if (node) observer.observe(node);

    return () => {
      if (node) observer.unobserve(node);
      observer.disconnect();
    };
  }, [posts, hasMore, loading, loadingMore, filter]);

  useEffect(() => {
    /**
     * `connectSocket` rather than `getSocket`, because of effect ordering.
     *
     * AuthProvider opens the connection in its own effect, and effects run
     * child-first: anything below it asks for the socket on the render where the
     * session is restored, before the effect that creates it has run, and gets
     * null. A subscription skipped that way is never retried and says nothing.
     *
     * This page recovered from that by accident: `friendIds` is in the dependency
     * list, it is replaced with a fresh Set once the friends request returns, and
     * the re-run landed after the socket existed. Real-time updates therefore
     * depended on an unrelated HTTP request succeeding — one failed
     * `GET /api/friends`, a rate-limit 429 among them, left this page silently
     * unsubscribed for the whole session.
     *
     * connectSocket is idempotent — it returns the live socket when there is one.
     * Asking for the connection beats hoping it has already been made.
     */
    const socket = connectSocket();
    if (!socket || !currentUser) return undefined;

    const handleCreated = ({ post }) => {
      if (post.author_id === currentUser.id) return;
      if (!matchesFilter(post, filter, currentUser.id, friendIds)) return;
      setPosts((prev) => {
        if (prev.some((p) => p.id === post.id)) return prev;
        // Marked before the state update, so the card has the flag on the
        // render that mounts it — which is the only render the entrance
        // animation can play on.
        livePostIds.current.add(post.id);
        return [post, ...prev];
      });
    };

    const handleUpdated = ({ post }) => {
      if (post.author_id === currentUser.id) return;
      const matches = matchesFilter(post, filter, currentUser.id, friendIds);
      setPosts((prev) => {
        const exists = prev.some((p) => p.id === post.id);
        if (matches) {
          if (exists) {
            return prev.map((p) => (p.id === post.id ? post : p));
          }
          return [post, ...prev];
        }
        return prev.filter((p) => p.id !== post.id);
      });
    };

    const handleDeleted = ({ postId }) => {
      setPosts((prev) => {
        const existing = prev.find((p) => p.id === postId);
        if (existing && existing.author_id === currentUser.id) {
          return prev;
        }
        return prev.filter((p) => p.id !== postId);
      });
    };

    socket.on(SOCKET_EVENTS.POST_CREATED, handleCreated);
    socket.on(SOCKET_EVENTS.POST_UPDATED, handleUpdated);
    socket.on(SOCKET_EVENTS.POST_DELETED, handleDeleted);

    return () => {
      socket.off(SOCKET_EVENTS.POST_CREATED, handleCreated);
      socket.off(SOCKET_EVENTS.POST_UPDATED, handleUpdated);
      socket.off(SOCKET_EVENTS.POST_DELETED, handleDeleted);
    };
  }, [currentUser, friendIds, filter]);

  useEffect(() => {
    const socket = connectSocket();
    if (!socket || !currentUser) return undefined;

    const refresh = () => {
      loadFriendIds();
    };

    socket.on(SOCKET_EVENTS.FRIEND_REQUEST_ACCEPTED, refresh);
    socket.on(SOCKET_EVENTS.FRIEND_REMOVED, refresh);

    return () => {
      socket.off(SOCKET_EVENTS.FRIEND_REQUEST_ACCEPTED, refresh);
      socket.off(SOCKET_EVENTS.FRIEND_REMOVED, refresh);
    };
  }, [currentUser, loadFriendIds]);

  const handlePostCreated = (newPost) => {
    // Only insert into the visible list if it matches the current filter.
    if (!matchesFilter(newPost, filter, currentUser.id, friendIds)) return;
    setPosts((prev) => {
      if (prev.some((p) => p.id === newPost.id)) return prev;
      return [newPost, ...prev];
    });
  };

  const handlePostUpdated = (updatedPost) => {
    const matches = matchesFilter(
      updatedPost,
      filter,
      currentUser.id,
      friendIds
    );
    setPosts((prev) => {
      const exists = prev.some((p) => p.id === updatedPost.id);
      if (matches) {
        if (exists) {
          return prev.map((p) => (p.id === updatedPost.id ? updatedPost : p));
        }
        return [updatedPost, ...prev];
      }
      return prev.filter((p) => p.id !== updatedPost.id);
    });
  };

  const handleDelete = async (postId) => {
    const backup = posts;
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    try {
      await postsApi.deletePost(postId);
    } catch (err) {
      setPosts(backup);
      setError(err?.response?.data?.error || 'Failed to delete post');
    }
  };

  // Choose a contextual empty message based on the active filter.
  const emptyMessage = {
    all: 'Your feed is empty. Add friends and create your first post!',
    mine: "You haven't posted anything yet.",
    friends:
      "Your friends haven't posted anything yet or you don't have any friends here.",
  }[filter];

  return (
    /*
     * Three columns, not one.
     *
     * A single centred column of posts leaves a wide screen reading as empty
     * margins with something in the middle. Widening the column is not the
     * answer — past about 70 characters a line stops being comfortable — so
     * the margins get content of their own instead: who you are on the left,
     * who is waiting on you on the right.
     *
     * Both rails are supporting material. They drop away as the window
     * narrows, right one first, and the feed keeps its width the whole way
     * down.
     */
    <div className={styles.layout}>
      <ProfileRail />

      <div className={styles.page}>
        <CreatePost onPostCreated={handlePostCreated} />

        <div className={styles.filtersRow}>
          <FilterTabs
            options={FILTER_OPTIONS}
            value={filter}
            onChange={setFilter}
          />
        </div>

        <PostsList
          posts={posts}
          loading={loading}
          error={error}
          emptyMessage={emptyMessage}
          onDelete={handleDelete}
          onUpdate={handlePostUpdated}
          livePostIds={livePostIds.current}
        />

        {!loading && hasMore && posts.length > 0 && (
          <div ref={sentinelRef} className={styles.sentinel}>
            {loadingMore && (
              <div className={styles.loadingMore}>Loading more...</div>
            )}
          </div>
        )}

        {!loading && !hasMore && posts.length > 0 && (
          <div className={styles.endMessage}>You&apos;ve reached the end.</div>
        )}
      </div>

      <ActivityRail />
    </div>
  );
};

export default FeedPage;