/**
 * User profile page.
 * Visual layout (top to bottom):
 *  - Cover banner (gradient).
 *  - Profile card with avatar, display name, @username, bio, stats, and
 *    a primary action button (Edit profile / Add friend / etc).
 *  - Posts section with the user's posts and infinite scroll.
 * 
 * Mirrors the FeedPage in three ways:
 *  - Real-time: events update the visible post list (filtered to this profile's user and constrained by visibility).
 *  - Pagination: cursor-based infinite scroll using IntersectionObserver.
 *  - Friendship refresh: socket events for friendship changes trigger a full reload so the action buttons stay correct.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import * as usersApi from '../../api/usersApi.js';
import * as friendsApi from '../../api/friendsApi.js';
import * as postsApi from '../../api/postsApi.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { getSocket } from '../../socket/socketClient.js';
import { SOCKET_EVENTS } from '../../socket/socketEvents.js';
import Avatar from '../../components/Avatar/Avatar.jsx';
import Button from '../../components/Button/Button.jsx';
import EditProfileModal from '../../components/EditProfileModal/EditProfileModal.jsx';
import PostsList from '../../components/PostsList/PostsList.jsx';

import styles from './UserProfilePage.module.css';

const PAGE_SIZE = 10;

const canViewerSee = (post, currentUserId, friendIds) => {
  if (post.author_id === currentUserId) return true;
  if (post.visibility === 'public') return true;
  if (post.visibility === 'private') return false;
  if (post.visibility === 'friends') {
    return friendIds.has(post.author_id);
  }
  return false;
};

const formatJoinedDate = (isoString) => {
  if (!isoString) return null;
  const date = new Date(isoString);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
};
// Main component for the user profile page.
// Handles loading the profile user, their posts, and friendship status.
const UserProfilePage = () => {
  const { userId } = useParams();
  const { user: currentUser, setUser } = useAuth();

  const [profileUser, setProfileUser] = useState(null);
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [posts, setPosts] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionInFlight, setActionInFlight] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const sentinelRef = useRef(null);

  const isOwnProfile = currentUser?.id === userId;
  const friendIds = new Set(friends.map((f) => f.id));

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isOwnProfile) {
        const [userData, postsData, friendsData] = await Promise.all([
          usersApi.getUserById(userId),
          postsApi.getPostsByUser(userId, { limit: PAGE_SIZE }),
          friendsApi.getFriends(),
        ]);
        setProfileUser(userData);
        setPosts(postsData);
        setFriends(friendsData);
        setHasMore(postsData.length === PAGE_SIZE);
      } else {
        const [userData, friendsData, incomingData, outgoingData, postsData] =
          await Promise.all([
            usersApi.getUserById(userId),
            friendsApi.getFriends(),
            friendsApi.getIncomingRequests(),
            friendsApi.getOutgoingRequests(),
            postsApi.getPostsByUser(userId, { limit: PAGE_SIZE }),
          ]);
        setProfileUser(userData);
        setFriends(friendsData);
        setIncoming(incomingData);
        setOutgoing(outgoingData);
        setPosts(postsData);
        setHasMore(postsData.length === PAGE_SIZE);
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [userId, isOwnProfile]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Infinite scroll for posts.
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
          const next = await postsApi.getPostsByUser(userId, {
            before: oldest.created_at,
            limit: PAGE_SIZE,
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
  }, [posts, hasMore, loading, loadingMore, userId]);

  // Real-time post events scoped to THIS profile's user.
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !currentUser) return undefined;
    // For new posts, we only add them if they're by this user and visible to the current viewer.
    const handleCreated = ({ post }) => {
      if (post.author_id !== userId) return;
      if (post.author_id === currentUser.id) return;
      if (!canViewerSee(post, currentUser.id, friendIds)) return;
      setPosts((prev) => {
        if (prev.some((p) => p.id === post.id)) return prev;
        return [post, ...prev];
      });
    };
    // For updates, we have to check visibility in case it changed (e.g. from friends-only to public).
    // If the post becomes visible, add it to the list. If it becomes hidden, remove it.
    const handleUpdated = ({ post }) => {
      if (post.author_id !== userId) return;
      if (post.author_id === currentUser.id) return;
      const visible = canViewerSee(post, currentUser.id, friendIds);
      setPosts((prev) => {
        const exists = prev.some((p) => p.id === post.id);
        if (visible) {
          if (exists) {
            return prev.map((p) => (p.id === post.id ? post : p));
          }
          return [post, ...prev];
        }
        return prev.filter((p) => p.id !== post.id);
      });
    };

    const handleDeleted = ({ postId: deletedPostId }) => {
      setPosts((prev) => {
        const existing = prev.find((p) => p.id === deletedPostId);
        if (existing && existing.author_id === currentUser.id) {
          return prev;
        }
        return prev.filter((p) => p.id !== deletedPostId);
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
  }, [currentUser, userId, friends]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !currentUser) return undefined;

    const refresh = () => {
      loadAll();
    };

    socket.on(SOCKET_EVENTS.FRIEND_REQUEST_RECEIVED, refresh);
    socket.on(SOCKET_EVENTS.FRIEND_REQUEST_ACCEPTED, refresh);
    socket.on(SOCKET_EVENTS.FRIEND_REMOVED, refresh);

    return () => {
      socket.off(SOCKET_EVENTS.FRIEND_REQUEST_RECEIVED, refresh);
      socket.off(SOCKET_EVENTS.FRIEND_REQUEST_ACCEPTED, refresh);
      socket.off(SOCKET_EVENTS.FRIEND_REMOVED, refresh);
    };
  }, [currentUser, loadAll]);

  const friendRecord = friends.find((f) => f.id === userId);
  const incomingRequest = incoming.find((r) => r.requester_id === userId);
  const outgoingRequest = outgoing.find((r) => r.addressee_id === userId);
// Helper to run a friendship-related action, showing loading state and handling errors.
  const runAction = async (apiCall) => {
    setActionInFlight(true);
    setError('');
    try {
      await apiCall();
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.error || 'Action failed');
    } finally {
      setActionInFlight(false);
    }
  };
// Handlers for the various friendship actions, all using the runAction helper.
  const handleSendRequest = () => runAction(() => friendsApi.sendRequest(userId));
  const handleAcceptRequest = () =>
    runAction(() => friendsApi.acceptRequest(incomingRequest.id));
  const handleRejectRequest = () =>
    runAction(() => friendsApi.deleteFriendship(incomingRequest.id));
  const handleCancelRequest = () =>
    runAction(() => friendsApi.deleteFriendship(outgoingRequest.id));
  const handleUnfriend = () => {
    if (
      !window.confirm(`Remove ${profileUser.display_name} from your friends?`)
    ) {
      return;
    }
    runAction(() => friendsApi.deleteFriendship(friendRecord.friendship_id));
  };
// Optimistically remove a post from the list, then call the API to delete it.
// If the API call fails, restore the post and show an error.
  const handleDeletePost = async (postId) => {
    const backup = posts;
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    try {
      await postsApi.deletePost(postId);
    } catch (err) {
      setPosts(backup);
      setError(err?.response?.data?.error || 'Failed to delete post');
    }
  };
// Update a single post in the list after an edit.
  const handleUpdatePost = (updatedPost) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === updatedPost.id ? updatedPost : p))
    );
  };

  const handleProfileUpdated = (updatedUser) => {
    setProfileUser(updatedUser);
    if (setUser) {
      setUser(updatedUser);
    }
  };

  // ----- Render -----

  if (loading) {
    return <div className={styles.message}>Loading...</div>;
  }

  if (error && !profileUser) {
    return <div className={styles.alert}>{error}</div>;
  }

  if (!profileUser) {
    return <div className={styles.message}>User not found.</div>;
  }

  const joinedDate = formatJoinedDate(profileUser.created_at);
  // Friend count comes from the API for both own and other profiles.
  const friendCount = profileUser.friend_count ?? null;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.cover} aria-hidden="true" />

        <div className={styles.identityRow}>
          <Avatar
            name={profileUser.display_name}
            userId={profileUser.id}
            size="xl"
            className={styles.avatar}
          />
        </div>

        <div className={styles.identityText}>
          <h1 className={styles.displayName}>{profileUser.display_name}</h1>
          <p className={styles.username}>@{profileUser.username}</p>

          {profileUser.bio && (
            <p className={styles.bio}>{profileUser.bio}</p>
          )}

          <div className={styles.meta}>
            {joinedDate && (
              <span className={styles.metaItem}>
                <span className={styles.metaIcon} aria-hidden="true">📅</span>
                Joined {joinedDate}
              </span>
            )}
            {friendCount !== null && (
              <span className={styles.metaItem}>
                <span className={styles.metaIcon} aria-hidden="true">👥</span>
                {friendCount} {friendCount === 1 ? 'friend' : 'friends'}
              </span>
            )}
          </div>
        </div>

        <div className={styles.identityActions}>
          {isOwnProfile && (
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Edit profile
            </Button>
          )}

          {!isOwnProfile && friendRecord && (
            <>
              <span className={styles.statusBadge}>You&apos;re friends</span>
              <Button
                variant="danger"
                onClick={handleUnfriend}
                loading={actionInFlight}
              >
                Remove friend
              </Button>
            </>
          )}

          {!isOwnProfile && incomingRequest && (
            <>
              <Button onClick={handleAcceptRequest} loading={actionInFlight}>
                Accept request
              </Button>
              <Button
                variant="danger"
                onClick={handleRejectRequest}
                disabled={actionInFlight}
              >
                Reject
              </Button>
            </>
          )}

          {!isOwnProfile && outgoingRequest && (
            <Button
              variant="secondary"
              onClick={handleCancelRequest}
              loading={actionInFlight}
            >
              Cancel request
            </Button>
          )}

          {!isOwnProfile &&
            !friendRecord &&
            !incomingRequest &&
            !outgoingRequest && (
              <Button onClick={handleSendRequest} loading={actionInFlight}>
                Add friend
              </Button>
            )}
        </div>

        {error && <div className={styles.alert}>{error}</div>}
      </div>

      <section className={styles.postsSection}>
        <h2 className={styles.postsTitle}>Posts</h2>
        <PostsList
          posts={posts}
          emptyMessage={
            isOwnProfile
              ? "You haven't posted anything yet."
              : `${profileUser.display_name} hasn't posted anything you can see.`
          }
          onDelete={handleDeletePost}
          onUpdate={handleUpdatePost}
        />

        {hasMore && posts.length > 0 && (
          <div ref={sentinelRef} className={styles.sentinel}>
            {loadingMore && (
              <div className={styles.loadingMore}>Loading more...</div>
            )}
          </div>
        )}

        {!hasMore && posts.length > 0 && (
          <div className={styles.endMessage}>
            You&apos;ve reached the end.
          </div>
        )}
      </section>

      {editOpen && (
        <EditProfileModal
          user={profileUser}
          onClose={() => setEditOpen(false)}
          onUpdated={handleProfileUpdated}
        />
      )}
    </div>
  );
};

export default UserProfilePage;