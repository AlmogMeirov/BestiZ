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
 *
 * This page is also where a conversation STARTS. The messenger only lists
 * threads that already exist, so without a Message button here there would be
 * no way to write to someone for the first time.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import * as usersApi from '../../api/usersApi.js';
import * as friendsApi from '../../api/friendsApi.js';
import * as postsApi from '../../api/postsApi.js';
import * as blocksApi from '../../api/blocksApi.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useMessenger } from '../../contexts/MessengerContext.jsx';
import { connectSocket } from '../../socket/socketClient.js';
import { SOCKET_EVENTS } from '../../socket/socketEvents.js';
import Avatar from '../../components/Avatar/Avatar.jsx';
import Button from '../../components/Button/Button.jsx';
import EditProfileModal from '../../components/EditProfileModal/EditProfileModal.jsx';
import PostsList from '../../components/PostsList/PostsList.jsx';

import styles from './UserProfilePage.module.css';
import { SkeletonGroup } from '../../components/Skeleton/Skeleton.jsx';

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
  const { openMessenger, refreshMessenger } = useMessenger();

  const [profileUser, setProfileUser] = useState(null);
  const [friends, setFriends] = useState([]);
  const [blocked, setBlocked] = useState([]);
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

  /**
   * Whether the viewer has blocked THIS person.
   *
   * Only one direction is knowable: the API never reveals who has blocked the
   * viewer, so a profile that has blocked them looks like any other — minus
   * the posts, which the server withholds.
   */
  const isBlockedByMe = blocked.some((b) => b.id === userId);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isOwnProfile) {
        const [userData, postsData, friendsData, blockedData] =
          await Promise.all([
            usersApi.getUserById(userId),
            postsApi.getPostsByUser(userId, { limit: PAGE_SIZE }),
            friendsApi.getFriends(),
            blocksApi.getBlocked(),
          ]);
        setProfileUser(userData);
        setPosts(postsData);
        setFriends(friendsData);
        setBlocked(blockedData);
        setHasMore(postsData.length === PAGE_SIZE);
      } else {
        const [
          userData,
          friendsData,
          incomingData,
          outgoingData,
          postsData,
          blockedData,
        ] = await Promise.all([
          usersApi.getUserById(userId),
          friendsApi.getFriends(),
          friendsApi.getIncomingRequests(),
          friendsApi.getOutgoingRequests(),
          postsApi.getPostsByUser(userId, { limit: PAGE_SIZE }),
          blocksApi.getBlocked(),
        ]);
        setProfileUser(userData);
        setFriends(friendsData);
        setIncoming(incomingData);
        setOutgoing(outgoingData);
        setPosts(postsData);
        setBlocked(blockedData);
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
    /**
     * `connectSocket` rather than `getSocket`, because of effect ordering.
     *
     * AuthProvider opens the connection in its own effect, and effects run
     * child-first: anything below it asks for the socket on the render where the
     * session is restored, before the effect that creates it has run, and gets
     * null. A subscription skipped that way is never retried and says nothing.
     *
     * This page recovered from that by accident, the same way the feed did:
     * `friends` is in the dependency list and is replaced once the friends
     * request returns. That makes real-time updates here conditional on an
     * unrelated request succeeding, which is not a property worth keeping.
     *
     * connectSocket is idempotent — it returns the live socket when there is one.
     * Asking for the connection beats hoping it has already been made.
     */
    const socket = connectSocket();
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
    const socket = connectSocket();
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
  /**
   * Runs a relationship action, then reloads the page and re-syncs the
   * messenger.
   *
   * Every action here can change who may write to whom, and the messenger
   * panel floats over this page rather than being part of it — so a thread
   * with this person open beside the profile would otherwise keep showing a
   * composer the server has just stopped honouring. Blocking is the obvious
   * case, but unfriending changes it too: it drops the pair back to a single
   * permitted message.
   *
   * The whole panel, not just the thread: becoming friends settles a pending
   * message request server-side, which moves that conversation out of the
   * Requests tab and into Chats and changes the badge with it.
   *
   * Scoped to `userId`, so an open thread with someone else is left alone.
   */
  const runAction = async (apiCall) => {
    setActionInFlight(true);
    setError('');
    try {
      await apiCall();
      await loadAll();
      await refreshMessenger(userId);
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

  /**
   * Blocking is spelled out before it happens, because it does more than the
   * word suggests: it ends the friendship and hides both people's posts from
   * each other. A one-word button with that much behind it deserves a
   * confirmation that says so.
   */
  const handleBlock = () => {
    if (
      !window.confirm(
        `Block ${profileUser.display_name}?\n\n` +
          'You will not see each other\u2019s posts, neither of you can message ' +
          'the other, and any friendship between you is removed. Your message ' +
          'history is kept.'
      )
    ) {
      return;
    }
    runAction(() => blocksApi.blockUser(userId));
  };

  // Unblocking deliberately does not restore the friendship. Saying so here
  // stops it reading as an undo.
  const handleUnblock = () =>
    runAction(() => blocksApi.unblockUser(userId));
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
    return <SkeletonGroup label="Loading profile" count={2} />;
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
                <svg className={styles.metaIcon} viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3.5" y="5" width="17" height="15" rx="3" />
                  <path d="M3.5 10h17M8 3v4M16 3v4" />
                </svg>
                Joined {joinedDate}
              </span>
            )}
            {friendCount !== null && (
              <span className={styles.metaItem}>
                <svg className={styles.metaIcon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="9" cy="8" r="3.2" />
                  <path d="M3 20a6 6 0 0 1 12 0" />
                  <circle cx="17" cy="9" r="2.6" />
                  <path d="M15.5 20a5.5 5.5 0 0 1 5.5-5.5" />
                </svg>
                {friendCount} {friendCount === 1 ? 'friend' : 'friends'}
              </span>
            )}
          </div>
        </div>

        <div className={styles.identityActions}>
          {isOwnProfile && (
            <>
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                Edit profile
              </Button>
              <Link to="/blocked" className={styles.secondaryLink}>
                Blocked users
              </Link>
            </>
          )}

          {/* A blocked profile shows one action and nothing else. Every other
              button would be refused by the server, so offering them would
              only invite a dead end. */}
          {!isOwnProfile && isBlockedByMe && (
            <>
              <span className={styles.statusBadge}>Blocked</span>
              <Button
                variant="secondary"
                onClick={handleUnblock}
                loading={actionInFlight}
              >
                Unblock
              </Button>
            </>
          )}

          {!isOwnProfile && !isBlockedByMe && (
            <Button
              variant="secondary"
              onClick={() => openMessenger(profileUser)}
            >
              Message
            </Button>
          )}

          {!isOwnProfile && !isBlockedByMe && friendRecord && (
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

          {!isOwnProfile && !isBlockedByMe && incomingRequest && (
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

          {!isOwnProfile && !isBlockedByMe && outgoingRequest && (
            <Button
              variant="secondary"
              onClick={handleCancelRequest}
              loading={actionInFlight}
            >
              Cancel request
            </Button>
          )}

          {!isOwnProfile &&
            !isBlockedByMe &&
            !friendRecord &&
            !incomingRequest &&
            !outgoingRequest && (
              <Button onClick={handleSendRequest} loading={actionInFlight}>
                Add friend
              </Button>
            )}

          {!isOwnProfile && !isBlockedByMe && (
            <Button
              variant="danger"
              onClick={handleBlock}
              disabled={actionInFlight}
            >
              Block
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