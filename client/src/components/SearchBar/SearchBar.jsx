/**
 * SearchBar.jsx
 * Header-mounted user search with debounced autocomplete.
 * Behavior:
 *  - User types in the input.
 *  - After 300ms of no typing, the API is queried.
 *  - Matching users render in a dropdown below the input.
 *  - Clicking a result navigates to that user's profile and closes the dropdown.
 *  - Clicking outside the search area also closes the dropdown.
 *  - Empty queries show no dropdown (don't surprise the user with old results).
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import * as usersApi from '../../api/usersApi.js';
import { useDebounce } from '../../hooks/useDebounce.js';

import styles from './SearchBar.module.css';

const SearchBar = () => {
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);

  // Wait until the user pauses typing before hitting the API.
  const debouncedQuery = useDebounce(query, 300);

  // Run the search whenever the debounced query changes.
  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (trimmed.length === 0) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    usersApi
      .searchUsers(trimmed)
      .then((users) => {
        if (!cancelled) {
          setResults(users);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    // If the query changes again before this request resolves, mark this one as stale so it doesn't overwrite newer results.
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // Close the dropdown when clicking outside the search area.
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (user) => {
    setQuery('');
    setResults([]);
    setOpen(false);
    navigate(`/users/${user.id}`);
  };

  // Show the dropdown when there's a query to display or while loading.
  const showDropdown =
    open && (loading || results.length > 0 || debouncedQuery.trim().length > 0);

  return (
    <div className={styles.container} ref={containerRef}>
      <input
        type="text"
        className={styles.input}
        placeholder="Search users..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />

      {showDropdown && (
        <ul className={styles.dropdown}>
          {loading && <li className={styles.message}>Searching...</li>}

          {!loading && results.length === 0 && debouncedQuery.trim().length > 0 && (
            <li className={styles.message}>No users found</li>
          )}

          {!loading &&
            results.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  className={styles.resultItem}
                  onClick={() => handleSelect(user)}
                >
                  <span className={styles.displayName}>{user.display_name}</span>
                  <span className={styles.username}>@{user.username}</span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
};

export default SearchBar;