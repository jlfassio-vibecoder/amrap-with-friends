import { useEffect, useRef, useState } from 'react';
import { buildRallyInviteUrl } from '@/lib/session/buildRallyInviteUrl';
import { track } from '@/lib/analytics/track';

const SECURED_MS = 2000;

export function useCopySessionInvite(sessionId: string) {
  const [secured, setSecured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  async function copyInvite() {
    setError(null);
    const inviteUrl = buildRallyInviteUrl(sessionId, window.location.origin);
    try {
      await navigator.clipboard.writeText(inviteUrl);
      track('rally_link_copied', {}, { sessionId });
      setSecured(true);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        setSecured(false);
        timerRef.current = null;
      }, SECURED_MS);
    } catch {
      setError(`Could not copy link. Copy this session link manually: ${inviteUrl}`);
    }
  }

  return { secured, error, copyInvite };
}
