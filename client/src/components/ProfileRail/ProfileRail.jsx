/**
 * The left rail on the feed: who you are, and where you go next.
 *
 * A single column of posts centred in a wide window reads as an unfinished
 * page — the eye registers the empty margins before it registers the content.
 * The fix is not to widen the column, which would make the lines too long to
 * read comfortably, but to give the margins something that belongs there.
 *
 * What belongs here is the two things a person checks most: their own profile,
 * and the handful of places they move between. Both are already a click away
 * in the header, which is the point — a shortcut is allowed to be redundant.
 * It is not navigation, it is a reminder of where you are.
 *
 * It fetches nothing. Everything shown is already in AuthContext, so the rail
 * costs one render and no request.
 */

import { Link, NavLink } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext.jsx';
import Avatar from '../Avatar/Avatar.jsx';

import styles from './ProfileRail.module.css';

const LINKS = [
  {
    to: '/friends',
    label: 'Friends',
    icon: (
      <>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3 20a6 6 0 0 1 12 0" />
        <circle cx="17" cy="9" r="2.6" />
        <path d="M15.5 20a5.5 5.5 0 0 1 5.5-5.5" />
      </>
    ),
  },
  {
    to: '/friends/requests',
    label: 'Friend requests',
    icon: (
      <>
        <circle cx="10" cy="8" r="3.4" />
        <path d="M3.5 20a6.5 6.5 0 0 1 13 0" />
        <path d="M19 7v6M16 10h6" />
      </>
    ),
  },
  {
    to: '/blocked',
    label: 'Blocked users',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="m6 6 12 12" />
      </>
    ),
  },
];

const ProfileRail = () => {
  const { user } = useAuth();

  if (!user) return null;

  const name = user.display_name || user.username;

  return (
    <aside className={styles.rail}>
      <Link to={`/users/${user.id}`} className={styles.card}>
        <Avatar name={name} userId={user.id} size={52} />
        <span className={styles.identity}>
          <span className={styles.name}>{name}</span>
          <span className={styles.handle}>@{user.username}</span>
        </span>
      </Link>

      <nav className={styles.links}>
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `${styles.link} ${isActive ? styles.linkActive : ''}`
            }
          >
            <svg
              className={styles.icon}
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              {link.icon}
            </svg>
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default ProfileRail;
