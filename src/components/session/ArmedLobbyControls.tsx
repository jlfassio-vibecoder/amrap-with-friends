import { useState } from 'react';
import {
  cancelLobbyCountdown,
} from '@/lib/api/sessionSync';
import { getStoredHostToken } from '@/lib/sessionIdentity';

interface ArmedLobbyControlsProps {
  sessionId: string;
  ticking: boolean;
  actionsEnabled?: boolean;
  onStart: () => void;
  onAudioUnlock?: () => void;
}

/** Abort / override controls shown after the lobby countdown is armed. */
export function ArmedLobbyControls({
  sessionId,
  ticking,
  actionsEnabled = true,
  onStart,
  onAudioUnlock,
}: ArmedLobbyControlsProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function abortClock() {
    onAudioUnlock?.();
    const hostToken = getStoredHostToken(sessionId);
    if (!hostToken) {
      setError('Host credentials are missing. Reopen the session as host.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await cancelLobbyCountdown({ sessionId, hostToken });
      if (result.error) {
        setError(result.error.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2" data-walkthrough-id="t-minus">
      <section className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-outline px-3 py-1.5 text-xs uppercase tracking-widest"
          disabled={busy}
          onClick={() => void abortClock()}
        >
          Abort clock
        </button>
        <button
          type="button"
          className="btn-primary px-3 py-1.5 text-xs uppercase tracking-widest"
          disabled={busy || !actionsEnabled}
          onClick={() => {
            onAudioUnlock?.();
            onStart();
          }}
        >
          {ticking ? 'Override: start now' : 'Start now'}
        </button>
      </section>
      {error ? <p className="text-error text-sm">{error}</p> : null}
    </div>
  );
}
