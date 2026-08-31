import { useState } from 'react';
import { cancelRallyPointCountdown } from '@/lib/api/sessionSync';
import { getStoredHostToken } from '@/lib/sessionIdentity';
import { formatPlusElapsed } from '@/lib/session/rallyPointCountdown';

interface ArmedRallyPointControlsProps {
  sessionId: string;
  ticking: boolean;
  /** Seconds past T-0; null while still ticking / not past end. */
  overtimeSec: number | null;
  actionsEnabled?: boolean;
  onStart: () => void;
  onAudioUnlock?: () => void;
}

/** Abort / override controls shown after the rally point countdown is armed. */
export function ArmedRallyPointControls({
  sessionId,
  ticking,
  overtimeSec,
  actionsEnabled = true,
  onStart,
  onAudioUnlock,
}: ArmedRallyPointControlsProps) {
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
      const result = await cancelRallyPointCountdown({ sessionId, hostToken });
      if (result.error) {
        setError(result.error.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2" data-walkthrough-id="t-minus">
      <section className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          className="btn-outline px-3 py-1.5 text-xs uppercase tracking-widest"
          disabled={busy}
          onClick={() => void abortClock()}
        >
          Abort clock
        </button>
        {ticking ? (
          <button
            type="button"
            className="btn-primary px-3 py-1.5 text-xs uppercase tracking-widest"
            disabled={busy || !actionsEnabled}
            onClick={() => {
              onAudioUnlock?.();
              onStart();
            }}
          >
            Override: start now
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn-primary px-3 py-1.5 text-xs uppercase tracking-widest"
              disabled={busy || !actionsEnabled}
              onClick={() => {
                onAudioUnlock?.();
                onStart();
              }}
            >
              Start
            </button>
            {overtimeSec != null ? (
              <span
                className="font-mono text-sm tabular-nums text-accent"
                aria-label="Time past countdown end"
              >
                {formatPlusElapsed(overtimeSec)}
              </span>
            ) : null}
          </>
        )}
      </section>
      {error ? <p className="text-error text-sm">{error}</p> : null}
    </div>
  );
}
