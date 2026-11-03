/**
 * Blocked users page.
 *
 * Lists the people the current user has blocked, with a way to lift each one.
 *
 * It lists only blocks this user PLACED. Who has blocked them is never shown,
 * and the API does not expose it — telling someone they have been blocked is
 * what turns a quiet boundary into an argument.
 *
 * Reached from the user's own profile rather than the header: it is a settings
 * screen people visit rarely, and a fifth nav link would cost every page to
 * serve a page almost nobody opens.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import * as blocksApi from '../../api/blocksApi.js';
import Button from '../../components/Button/Button.jsx';

import styles from './BlockedUsersPage.module.css';

const BlockedUsersPage = () => {
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Scoped to the row being acted on, so unblocking one person does not grey
  // out the whole list.
  const [busyId, setBusyId] = useState(null);

  const loadBlocked = useCallback(async () => {
    setError('');
    try {
      setBlocked(await blocksApi.getBlocked());
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load blocked users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBlocked();
  }, [loadBlocked]);

  const handleUnblock = async (person) => {
    if (
      !window.confirm(
        `Unblock ${person.display_name}?\n\n` +
          'You will see each other’s posts again and either of you can ' +
          'send a message request. Any friendship you had is not restored.'
      )
    ) {
      return;
    }

    setBusyId(person.id);
    setError('');
    try {
      await blocksApi.unblockUser(person.id);
      await loadBlocked();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to unblock');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className={styles.message}>Loading...</div>;
  }

  return (
    <div>
      <h1 className={styles.title}>Blocked users</h1>

      {error && <div className={styles.alert}>{error}</div>}

      {blocked.length === 0 ? (
        <div className={styles.emptyState}>
          <p>You haven&apos;t blocked anyone.</p>
          <p className={styles.emptyHint}>
            Blocking someone hides your posts from each other and stops either
            of you messaging the other. You can block from a person&apos;s
            profile.
          </p>
        </div>
      ) : (
        <ul className={styles.list}>
          {blocked.map((person) => (
            <li key={person.block_id} className={styles.item}>
              <Link to={`/users/${person.id}`} className={styles.userLink}>
                <span className={styles.displayName}>
                  {person.display_name}
                </span>
                <span className={styles.username}>@{person.username}</span>
              </Link>
              <div className={styles.actions}>
                <Button
                  variant="secondary"
                  onClick={() => handleUnblock(person)}
                  disabled={busyId === person.id}
                >
                  Unblock
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default BlockedUsersPage;
