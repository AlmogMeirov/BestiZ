/**
 * Layout component.
 * Wraps every protected page with a shared header. The header contains:
 *  - The BestiZ brand (links back to the feed).
 *  - A search bar for finding other users.
 *  - Navigation links (Feed, Friends, Requests).
 *  - The current user's name (links to their profile) and a sign-out button.
 */

import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext.jsx';
import Button from '../Button/Button.jsx';
import SearchBar from '../SearchBar/SearchBar.jsx';

import styles from './Layout.module.css';

const Layout = () => {
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
    </div>
  );
};

export default Layout;