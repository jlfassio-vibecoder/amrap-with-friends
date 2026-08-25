import { useEffect, useRef, useState } from 'react';
import { buildRallyInviteUrl } from '@/lib/session/buildRallyInviteUrl';

interface CopyInviteLinkProps {
  sessionId: string;
}

const SECURED_MS = 2000;

export function CopyInviteLink({ sessionId }: CopyInviteLinkProps) {
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

  async function handleCopy() {
    setError(null);
    const inviteUrl = buildRallyInviteUrl(sessionId, window.location.origin);
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setSecured(true);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        setSecured(false);
        timerRef.current = null;
      }, SECURED_MS);
    } catch {
      setError('Could not copy link. Copy it manually from the address bar after sharing.');
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn-primary w-full uppercase tracking-widest"
        onClick={() => void handleCopy()}
      >
        {secured ? 'LINK SECURED' : 'COPY RALLY LINK'}
      </button>
      {error ? <p className="text-error text-sm">{error}</p> : null}
    </div>
  );
}
