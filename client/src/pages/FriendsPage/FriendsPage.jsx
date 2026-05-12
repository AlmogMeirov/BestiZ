/**
 * Friends list page.
 * Lists the current user's accepted friends.
 * Each friend links to their profile page, with a "Remove" button for unfriending.
 * Empty state directs the user to search for people.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import * as friendsApi from '../../api/friendsApi.js';
import Button from '../../components/Button/Button.jsx';

import styles from './FriendsPage.module.css';

const FriendsPage = () => {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionInFlight, setActionInFlight] = useState(false);

  const loadFriends = useCallback(async () => {
    setError('');
    try {
      const data = await friendsApi.getFriends();
      setFriends(data);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load friends');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  const handleRemove = async (friend) => {
    if (
      !window.confirm(
        `Remove ${friend.display_name} from your friends?`
      )
    ) {
      return;
    }

    setActionInFlight(true);
    setError('');
    try {
      await friendsApi.deleteFriendship(friend.friendship_id);
      await loadFriends();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to remove friend');
    } finally {
      setActionInFlight(false);
    }
  };

  if (loading) {
    return <div className={styles.message}>Loading...</div>;
  }

  if (error && friends.length === 0) {
    return <div className={styles.alert}>{error}</div>;
  }

  return (
    <div>
      <h1 className={styles.title}>Friends</h1>

      {error && <div className={styles.alert}>{error}</div>}

      {friends.length === 0 ? (
        <div className={styles.emptyState}>
          <p>You don&apos;t have any friends yet.</p>
          <p className={styles.emptyHint}>
            Use the search bar above to find people and send friend requests.
          </p>
        </div>
      ) : (
        <ul className={styles.list}>
          {friends.map((friend) => (
            <li key={friend.friendship_id} className={styles.item}>
              <Link to={`/users/${friend.id}`} className={styles.userLink}>
                <span className={styles.displayName}>{friend.display_name}</span>
                <span className={styles.username}>@{friend.username}</span>
              </Link>
              <div className={styles.actions}>
                <Button
                  variant="danger"
                  onClick={() => handleRemove(friend)}
                  disabled={actionInFlight}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FriendsPage;