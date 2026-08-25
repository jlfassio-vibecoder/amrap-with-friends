import { useState } from 'react';
import { LOBBY_COUNTDOWN_MAX_SECONDS } from '@/lib/session/lobbyCountdown';
import {
  cancelLobbyCountdown,
  setLobbyCountdown,
} from '@/lib/api/sessionSync';
import type { LiveSessionPhase } from '@/lib/sessionSync/types';
import { getStoredHostToken } from '@/lib/sessionIdentity';

const PRESET_SECONDS = [
  { label: '2 MIN', seconds: 120 },
  { label: '5 MIN', seconds: 300 },
  { label: '10 MIN', seconds: 600 },
] as const;

interface LobbyCountdownPanelProps {
  sessionId: string;
  isHost: boolean;
  phase: LiveSessionPhase;
  countdownArmed: boolean;
  ticking: boolean;
  onStart: () => void;
  onAudioUnlock?: () => void;
}

export function LobbyCountdownPanel({
  sessionId,
  isHost,
  phase,
  countdownArmed,
  ticking,
  onStart,
  onAudioUnlock,
}: LobbyCountdownPanelProps) {
  const [selectedSeconds, setSelectedSeconds] = useState(300);
  const [customSeconds, setCustomSeconds] = useState('300');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (phase !== 'waiting' || !isHost) {
    return null;
  }

  async function engageClock() {
    onAudioUnlock?.();
    const hostToken = getStoredHostToken(sessionId);
    if (!hostToken) {
      setError('Host credentials are missing. Reopen the session as host.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await setLobbyCountdown({
        sessionId,
        hostToken,
        seconds: selectedSeconds,
      });
      if (result.error) {
        setError(result.error.message);
      }
    } finally {
      setBusy(false);
    }
  }

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

  function selectPreset(seconds: number) {
    setSelectedSeconds(seconds);
    setCustomSeconds(String(seconds));
  }

  function applyCustomSeconds(raw: string) {
    setCustomSeconds(raw);
    const parsed = Number(raw);
    if (
      Number.isInteger(parsed) &&
      parsed > 0 &&
      parsed <= LOBBY_COUNTDOWN_MAX_SECONDS
    ) {
      setSelectedSeconds(parsed);
    }
  }

  return (
    <div className="space-y-3">
      {!countdownArmed ? (
        <section className="card space-y-3 p-4">
          <p className="text-sm font-semibold uppercase tracking-widest">
            T-Minus console
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESET_SECONDS.map((preset) => (
              <button
                key={preset.seconds}
                type="button"
                className={
                  selectedSeconds === preset.seconds
                    ? 'rounded-full bg-accent px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-on-accent'
                    : 'rounded-full border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-secondary hover:text-ink'
                }
                onClick={() => selectPreset(preset.seconds)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Custom seconds (1–600)</span>
            <input
              className="input-field"
              type="number"
              min={1}
              max={LOBBY_COUNTDOWN_MAX_SECONDS}
              value={customSeconds}
              onChange={(event) => applyCustomSeconds(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn-primary w-full uppercase tracking-widest"
            disabled={
              busy ||
              !Number.isInteger(selectedSeconds) ||
              selectedSeconds <= 0 ||
              selectedSeconds > LOBBY_COUNTDOWN_MAX_SECONDS
            }
            onClick={() => void engageClock()}
          >
            {busy ? 'Engaging…' : 'Engage clock'}
          </button>
        </section>
      ) : null}

      {countdownArmed ? (
        <section className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-outline uppercase tracking-widest"
            disabled={busy}
            onClick={() => void abortClock()}
          >
            Abort clock
          </button>
          <button
            type="button"
            className="btn-primary uppercase tracking-widest"
            disabled={busy}
            onClick={() => {
              onAudioUnlock?.();
              onStart();
            }}
          >
            {ticking ? 'Override: start now' : 'Start now'}
          </button>
        </section>
      ) : null}

      {error ? <p className="text-error text-sm">{error}</p> : null}
    </div>
  );
}
