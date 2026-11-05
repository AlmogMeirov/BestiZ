/**
 * The right rail on the feed: the people side of the page.
 *
 * Two sections, in the order they matter. Friend requests come first because
 * they are the only thing here waiting on a decision, and they can be settled
 * without leaving the feed. Friends come second, as a way back to the people
 * you already talk to.
 *
 * The rail listens for the same friendship events the rest of the application
 * does, so accepting a request in one tab empties it in the other. It does
 * not listen for post events: nothing here changes when somebody writes.
 *
 * A section with nothing in it renders nothing at all rather than an empty
 * state. An empty box in a margin is just a box.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import * as friendsApi from '../../api/friendsApi.js';
import { connectSocket } from '../../socket/socketClient.js';
import { SOCKET_EVENTS } from '../../socket/socketEvents.js';
import Avatar from '../Avatar/Avatar.jsx';
import { Bar, Circle } from '../Skeleton/Skeleton.jsx';

import styles from './ActivityRail.module.css';

const MAX_FRIENDS = 6;

const PersonRow = ({ id, name, handle, children }) => (
  <li className={styles.row}>
    <Link to={`/users/${id}`} className={styles.person}>
      <Avatar name={name} userId={id} size={38} />
      <span className={styles.identity}>
        <span className={styles.name}>{name}</span>
        {handle && <span className={styles.handle}>@{handle}</span>}
      </span>
    </Link>
    {children}
  </li>
);

const ActivityRail = () => {
  const [requests, setRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [incoming, friendList] = await Promise.all([
        friendsApi.getIncomingRequests(),
        friendsApi.getFriends(),
      ]);
      setRequests(incoming);
      setFriends(friendList);
    } catch {
      // A rail that cannot load is a rail that shows nothing. It is context,
      // not content, and an error message out here would be noise beside a
      // feed that loaded perfectly well.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return undefined;

    socket.on(SOCKET_EVENTS.FRIEND_REQUEST_RECEIVED, load);
    socket.on(SOCKET_EVENTS.FRIEND_REQUEST_ACCEPTED, load);
    socket.on(SOCKET_EVENTS.FRIEND_REMOVED, load);

    return () => {
      socket.off(SOCKET_EVENTS.FRIEND_REQUEST_RECEIVED, load);
      socket.off(SOCKET_EVENTS.FRIEND_REQUEST_ACCEPTED, load);
      socket.off(SOCKET_EVENTS.FRIEND_REMOVED, load);
    };
  }, [load]);

  const decide = async (requestId, accept) => {
    setBusyId(requestId);
    try {
      if (accept) {
        await friendsApi.acceptRequest(requestId);
      } else {
        await friendsApi.deleteFriendship(requestId);
      }
      await load();
    } catch {
      await load();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <aside className={styles.rail} aria-busy="true" aria-label="Loading">
        <section className={styles.section}>
          <Bar width={120} height={13} />
          <div className={styles.skeletonRow}>
            <Circle size={38} />
            <Bar width={110} />
          </div>
          <div className={styles.skeletonRow}>
            <Circle size={38} />
            <Bar width={86} />
          </div>
        </section>
      </aside>
    );
  }

  if (requests.length === 0 && friends.length === 0) return null;

  return (
    <aside className={styles.rail}>
      {requests.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.heading}>
            Friend requests
            <span className={styles.count}>{requests.length}</span>
          </h2>
          <ul className={styles.list}>
            {requests.map((request) => (
              <PersonRow
                key={request.id}
                id={request.requester_id}
                name={request.requester_display_name}
                handle={request.requester_username}
              >
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.accept}
                    onClick={() => decide(request.id, true)}
                    disabled={busyId === request.id}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className={styles.decline}
                    onClick={() => decide(request.id, false)}
                    disabled={busyId === request.id}
                  >
                    Ignore
                  </button>
                </div>
              </PersonRow>
            ))}
          </ul>
        </section>
      )}

      {friends.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.heading}>
            Friends
            <span className={styles.count}>{friends.length}</span>
          </h2>
          <ul className={styles.list}>
            {friends.slice(0, MAX_FRIENDS).map((friend) => (
              <PersonRow
                key={friend.id}
                id={friend.id}
                name={friend.display_name}
                handle={friend.username}
              />
            ))}
          </ul>
          {friends.length > MAX_FRIENDS && (
            <Link to="/friends" className={styles.more}>
              See all {friends.length}
            </Link>
          )}
        </section>
      )}
    </aside>
  );
};

export default ActivityRail;
