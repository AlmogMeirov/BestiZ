/**
 * Layout component.
 * Wraps every protected page with a shared header. The header contains:
 *  - The BestiZ brand (links back to the feed).
 *  - A search bar for finding other users.
 *  - Navigation links (Feed, Friends, Requests) and a Messages button.
 *  - The current user's name (links to their profile) and a sign-out button.
 *
 * Messages is a button rather than a link: it opens a panel over whatever page
 * is showing instead of navigating away, so reading a message never costs the
 * reader their place in the feed.
 *
 * MessengerProvider wraps the whole layout because both the badge up here and
 * the panel below it read the same state, and the badge has to keep counting
 * while the panel is closed.
 */

import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext.jsx';
import {
  MessengerProvider,
  useMessenger,
} from '../../contexts/MessengerContext.jsx';
import Button from '../Button/Button.jsx';
import Messenger from '../Messenger/Messenger.jsx';
import SearchBar from '../SearchBar/SearchBar.jsx';

import styles from './Layout.module.css';

/**
 * The header's Messages control.
 *
 * Split out as its own component because it has to sit INSIDE
 * MessengerProvider to read the badge count, while the provider itself wraps
 * the layout.
 */
const MessagesButton = () => {
  const { toggleMessenger, isOpen, badgeCount } = useMessenger();

  return (
    <button
      type="button"
      onClick={toggleMessenger}
      className={`${styles.navLink} ${styles.navButton} ${
        isOpen ? styles.navLinkActive : ''
      }`}
      aria-expanded={isOpen}
    >
      Messages
      {badgeCount > 0 && (
        <span className={styles.navBadge}>{badgeCount}</span>
      )}
    </button>
  );
};

const LayoutInner = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/feed" className={styles.brand}>
            BestiZ
          </Link>

          <div className={styles.searchWrapper}>
            <SearchBar />
          </div>

          <nav className={styles.nav}>
            <NavLink
              to="/feed"
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              Feed
            </NavLink>
            <NavLink
              to="/friends"
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              Friends
            </NavLink>
            <NavLink
              to="/friends/requests"
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              Requests
            </NavLink>
            <MessagesButton />
          </nav>

          <div className={styles.userArea}>
            {user && (
              <Link to={`/users/${user.id}`} className={styles.userName}>
                {user.display_name || user.username}
              </Link>
            )}
            <Button variant="secondary" onClick={handleLogout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.mainInner}>
          <Outlet />
        </div>
      </main>

      <Messenger />
    </div>
  );
};

const Layout = () => (
  <MessengerProvider>
    <LayoutInner />
  </MessengerProvider>
);

export default Layout;