/**
 * Message requests: the opening message from someone who is not a friend,
 * waiting on a decision.
 *
 * The message itself is shown rather than just the sender's name, because the
 * decision is about what they wrote. "Someone wants to message you" gives the
 * recipient nothing to decide with.
 */

import { useState } from 'react';

import Avatar from '../Avatar/Avatar.jsx';
import { useMessenger } from '../../contexts/MessengerContext.jsx';
import { formatRelativeTime } from './formatRelativeTime.js';

import styles from './Messenger.module.css';

const RequestList = () => {
  const { requests, accept, decline, openConversation } = useMessenger();
  // Disables both buttons on the row being acted on, so a double-click cannot
  // fire accept and decline at once.
  const [busyId, setBusyId] = useState(null);

  const act = async (requestId, action) => {
    setBusyId(requestId);
    try {
      await action(requestId);
    } finally {
      setBusyId(null);
    }
  };

  if (requests.length === 0) {
    return <p className={styles.empty}>No message requests.</p>;
  }

  return (
    <ul className={styles.list}>
      {requests.map((request) => (
        <li key={request.request_id} className={styles.requestRow}>
          <button
            type="button"
            className={styles.requestMain}
            onClick={() => openConversation(request)}
          >
            <Avatar
              name={request.display_name}
              userId={request.id}
              size="md"
            />
            <span className={styles.rowBody}>
              <span className={styles.rowTop}>
                <span className={styles.rowName}>{request.display_name}</span>
                <span className={styles.rowTime}>
                  {formatRelativeTime(request.requested_at)}
                </span>
              </span>
              <span className={styles.rowPreview}>
                {request.opening_message}
              </span>
            </span>
          </button>

          <div className={styles.requestActions}>
            <button
              type="button"
              className={styles.acceptButton}
              disabled={busyId === request.request_id}
              onClick={() => act(request.request_id, accept)}
            >
              Accept
            </button>
            <button
              type="button"
              className={styles.declineButton}
              disabled={busyId === request.request_id}
              onClick={() => act(request.request_id, decline)}
            >
              Decline
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
};

export default RequestList;
