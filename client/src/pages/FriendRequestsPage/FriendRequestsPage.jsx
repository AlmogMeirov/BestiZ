/**
 * Friend requests page
 * Two sections:
 *  - Incoming: pending requests received from other users.
 *    Each shows "Accept" and "Reject" buttons.
 *  - Outgoing: pending requests this user has sent.
 *    Each shows "Cancel" button.
 *
 * Empty sections are hidden, if there's nothing to show in one of them,the section disappears entirely.
 * If both are empty, a single friendly empty state is shown.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import * as friendsApi from '../../api/friendsApi.js';
import Button from '../../components/Button/Button.jsx';

import styles from './FriendRequestsPage.module.css';
// The main component for the Friend Requests page. It manages state for incoming and outgoing requests,
// handles loading and error states, and defines actions for accepting, rejecting, or canceling requests.
const FriendRequestsPage = () => {
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionInFlight, setActionInFlight] = useState(false);

  const loadRequests = useCallback(async () => {
    setError('');
    try {
      const [incomingData, outgoingData] = await Promise.all([
        friendsApi.getIncomingRequests(),
        friendsApi.getOutgoingRequests(),
      ]);
      setIncoming(incomingData);
      setOutgoing(outgoingData);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const runAction = async (apiCall) => {
    setActionInFlight(true);
    setError('');
    try {
      await apiCall();
      await loadRequests();
    } catch (err) {
      setError(err?.response?.data?.error || 'Action failed');
    } finally {
      setActionInFlight(false);
    }
  };

  const handleAccept = (id) => runAction(() => friendsApi.acceptRequest(id));
  const handleReject = (id) => runAction(() => friendsApi.deleteFriendship(id));
  const handleCancel = (id) => runAction(() => friendsApi.deleteFriendship(id));

  if (loading) {
    return <div className={styles.message}>Loading...</div>;
  }

  const hasNoRequests = incoming.length === 0 && outgoing.length === 0;

  return (
    <div>
      <h1 className={styles.title}>Friend requests</h1>

      {error && <div className={styles.alert}>{error}</div>}

      {hasNoRequests && (
        <div className={styles.emptyState}>
          <p>No pending friend requests.</p>
          <p className={styles.emptyHint}>
            Use the search bar above to find people to connect with.
          </p>
        </div>
      )}

      {/* ----- Incoming (only if not empty) ----- */}
      {incoming.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Incoming <span className={styles.count}>({incoming.length})</span>
          </h2>

          <ul className={styles.list}>
            {incoming.map((req) => (
              <li key={req.id} className={styles.item}>
                <Link
                  to={`/users/${req.requester_id}`}
                  className={styles.userLink}
                >
                  <span className={styles.displayName}>
                    {req.requester_display_name}
                  </span>
                  <span className={styles.username}>
                    @{req.requester_username}
                  </span>
                </Link>
                <div className={styles.actions}>
                  <Button
                    onClick={() => handleAccept(req.id)}
                    disabled={actionInFlight}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => handleReject(req.id)}
                    disabled={actionInFlight}
                  >
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ----- Outgoing (only if not empty) ----- */}
      {outgoing.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Sent <span className={styles.count}>({outgoing.length})</span>
          </h2>

          <ul className={styles.list}>
            {outgoing.map((req) => (
              <li key={req.id} className={styles.item}>
                <Link
                  to={`/users/${req.addressee_id}`}
                  className={styles.userLink}
                >
                  <span className={styles.displayName}>
                    {req.addressee_display_name}
                  </span>
                  <span className={styles.username}>
                    @{req.addressee_username}
                  </span>
                </Link>
                <div className={styles.actions}>
                  <Button
                    variant="secondary"
                    onClick={() => handleCancel(req.id)}
                    disabled={actionInFlight}
                  >
                    Cancel
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default FriendRequestsPage;