import { useEffect, useState } from 'react';

/**
 * Delays a value until it stops changing.
 *
 * Search runs a text query against the database, so firing on every keystroke
 * would mean a request per character and results arriving out of order. 350ms
 * is long enough to swallow a burst of typing and short enough to still feel
 * immediate.
 */
export function useDebounce<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
