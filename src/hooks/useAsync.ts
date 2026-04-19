import { useState, useCallback, useRef } from 'react';

/**
 * Generic hook that wraps any async function and exposes loading/error/execute.
 * Loading starts when execute() is called and stops when the promise resolves or rejects.
 *
 * Usage:
 *   const { loading, error, execute } = useAsync(myAsyncFn);
 *   await execute(arg1, arg2);
 */
export function useAsync<T = unknown, Args extends unknown[] = unknown[]>(
  asyncFn: (...args: Args) => Promise<T>,
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Keep a stable ref so callers don't need to memoize the passed-in function.
  const fnRef = useRef(asyncFn);
  fnRef.current = asyncFn;

  const execute = useCallback(async (...args: Args): Promise<T | undefined> => {
    setLoading(true);
    setError(null);
    try {
      return await fnRef.current(...args);
    } catch (err) {
      const caught = err instanceof Error ? err : new Error(String(err));
      setError(caught);
      throw caught;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, execute };
}
