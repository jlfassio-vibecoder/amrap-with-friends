import { useEffect, useRef, useState } from 'react';
import { buildRallyInviteUrl } from '@/lib/session/buildRallyInviteUrl';
import { track } from '@/lib/analytics/track';

const SECURED_MS = 2000;

export function useCopySessionInvite(sessionId: string) {
  const [secured, setSecured] = useState(false);
  const [idSecured, setIdSecured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const linkTimerRef = useRef<number | null>(null);
  const idTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (linkTimerRef.current !== null) {
        window.clearTimeout(linkTimerRef.current);
      }
      if (idTimerRef.current !== null) {
        window.clearTimeout(idTimerRef.current);
      }
    };
  }, []);

  function flash(
    setFlag: (value: boolean) => void,
    timerRef: { current: number | null }
  ) {
    setFlag(true);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setFlag(false);
      timerRef.current = null;
    }, SECURED_MS);
  }

  async function copyInvite() {
    setError(null);
    const inviteUrl = buildRallyInviteUrl(sessionId, window.location.origin);
    try {
      await navigator.clipboard.writeText(inviteUrl);
      track('rally_link_copied', {}, { sessionId });
      flash(setSecured, linkTimerRef);
    } catch {
      setError(`Could not copy link. Copy this session link manually: ${inviteUrl}`);
    }
  }

  async function copySessionId() {
    setError(null);
    try {
      await navigator.clipboard.writeText(sessionId);
      track('session_id_copied', {}, { sessionId });
      flash(setIdSecured, idTimerRef);
    } catch {
      setError(`Could not copy session ID. Copy it manually: ${sessionId}`);
    }
  }

  return { secured, idSecured, error, copyInvite, copySessionId };
}
