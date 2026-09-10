import { useEffect, useRef } from 'react';

/**
 * Call `refetch` when the tab becomes visible again.
 * Skips the initial mount — callers load on their own mount effect.
 */
export function useRefetchOnVisible(enabled: boolean, refetch: () => void): void {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  const skipNextVisibleRef = useRef(true);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    skipNextVisibleRef.current = true;

    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') {
        return;
      }
      if (skipNextVisibleRef.current) {
        skipNextVisibleRef.current = false;
        return;
      }
      refetchRef.current();
    }

    // If we mount while already visible, the first "visible" is the mount —
    // clear the skip flag without fetching so a later hide→show does refetch.
    if (document.visibilityState === 'visible') {
      skipNextVisibleRef.current = false;
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled]);
}
