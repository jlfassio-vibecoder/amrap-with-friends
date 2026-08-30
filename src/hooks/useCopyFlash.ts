import { useEffect, useRef, useState } from 'react';

const FLASH_MS = 2000;

/**
 * Copies text and flashes a confirmation for two seconds.
 *
 * `useCopySessionInvite` predates this and still has its own copy of the
 * mechanism plus session-specific analytics; it is left alone rather than
 * refactored, since it is shipped and covered by its own tests.
 */
export function useCopyFlash() {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  async function copy(text: string, failureMessage: string) {
    setError(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        setCopied(false);
        timerRef.current = null;
      }, FLASH_MS);
      return true;
    } catch {
      // Clipboard access can be denied outright; surfacing the text keeps the
      // invite usable by hand rather than dead-ending.
      setError(failureMessage);
      return false;
    }
  }

  return { copied, error, copy };
}
