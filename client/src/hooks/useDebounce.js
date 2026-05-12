/**
 * useDebounce.js
 * Returns a value that only updates after `delay` ms have passed without the input value changing.
 * Useful for search inputs: instead of firing an API request on every keystroke, the request fires once the user pauses typing.
 *
 * Usage:
 *   const [query, setQuery] = useState('');
 *   const debouncedQuery = useDebounce(query, 300);
 *
 *   useEffect(() => {
 *     // runs only after the user stops typing for 300ms
 *     fetchResults(debouncedQuery);
 *   }, [debouncedQuery]);
 */

import { useEffect, useState } from 'react';

export const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Schedule an update after the delay.
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // If the value changes again before the delay elapses, cancel the  previous timeout.
    // The latest cleanup runs after every render where value changed, ensuring we only ever have one pending timeout.
    return () => clearTimeout(timeoutId);
  }, [value, delay]);

  return debouncedValue;
};