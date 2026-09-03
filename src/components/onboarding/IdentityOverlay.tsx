import { useEffect, useId, useRef, useState } from 'react';
import { track } from '@/lib/analytics/track';
import type { AthleteIdentityInput } from '@/lib/api/athleteProfile';
import {
  sanitizeCallsignUsername,
  suggestAthleteIdentity,
  type AthleteIdentitySuggestion,
} from '@/lib/onboarding/tacticalCallsign';

const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-';
const DEFAULT_SCRAMBLE_STEPS = 12;
const DEFAULT_SCRAMBLE_MS = 50;
const GENERATED_RETRY_LIMIT = 4;

export interface IdentityOverlayProps {
  onClose: () => void;
  onAccept: (input: AthleteIdentityInput) => Promise<{ error: string | null }>;
  acceptLabel?: string;
  /** False on host gates so Esc/backdrop cannot skip identity. */
  dismissible?: boolean;
  suggestIdentity?: () => AthleteIdentitySuggestion;
  scrambleSteps?: number;
  scrambleIntervalMs?: number;
}

export function IdentityOverlay({
  onClose,
  onAccept,
  acceptLabel = 'Accept & Launch',
  dismissible = true,
  suggestIdentity = suggestAthleteIdentity,
  scrambleSteps = DEFAULT_SCRAMBLE_STEPS,
  scrambleIntervalMs = DEFAULT_SCRAMBLE_MS,
}: IdentityOverlayProps) {
  const titleId = useId();
  const [suggestion, setSuggestion] = useState<AthleteIdentitySuggestion>(() => suggestIdentity());
  const [displayName, setDisplayName] = useState('········');
  const [settled, setSettled] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrambleGenRef = useRef(0);

  useEffect(() => {
    track('micro_dossier_shown');
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && dismissible && !saving) {
        track('micro_dossier_cancelled');
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dismissible, onClose, saving]);

  useEffect(() => {
    const generation = scrambleGenRef.current;
    const target = suggestion.nickname;
    if (scrambleIntervalMs <= 0 || scrambleSteps <= 1) {
      setDisplayName(target);
      setSettled(true);
      return;
    }

    setSettled(false);
    setDisplayName(
      target
        .split('')
        .map(() => SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)])
        .join('')
    );

    let step = 0;
    const interval = window.setInterval(() => {
      if (generation !== scrambleGenRef.current) {
        window.clearInterval(interval);
        return;
      }
      step += 1;
      const revealed = Math.ceil((step / scrambleSteps) * target.length);
      setDisplayName(
        target
          .split('')
          .map((letter, index) => {
            if (index < revealed) {
              return letter;
            }
            return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
          })
          .join('')
      );
      if (step >= scrambleSteps) {
        window.clearInterval(interval);
        setDisplayName(target);
        setSettled(true);
      }
    }, scrambleIntervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [suggestion, scrambleIntervalMs, scrambleSteps]);

  function regenerate() {
    if (saving) {
      return;
    }
    scrambleGenRef.current += 1;
    setError(null);
    setSuggestion(suggestIdentity());
  }

  function toggleCustom() {
    if (saving) {
      return;
    }
    setError(null);
    setCustomMode((current) => {
      if (current) {
        return false;
      }
      setCustomName(suggestion.nickname);
      return true;
    });
  }

  function acceptedNickname(): string {
    return customMode ? customName.trim() : suggestion.nickname;
  }

  function nicknameError(value: string): string | null {
    if (value.length < 1 || value.length > 50) {
      return 'Enter a name (1–50 characters).';
    }
    if (!sanitizeCallsignUsername(value)) {
      return 'Enter a name we can turn into a handle.';
    }
    return null;
  }

  async function handleAccept() {
    const nickname = acceptedNickname();
    const localError = nicknameError(nickname);
    if (localError) {
      setError(localError);
      return;
    }

    setSaving(true);
    setError(null);
    let nextNickname = nickname;
    let generated = !customMode;

    for (let attempt = 0; attempt < GENERATED_RETRY_LIMIT; attempt += 1) {
      const username = sanitizeCallsignUsername(nextNickname);
      const result = await onAccept({ username, nickname: nextNickname });
      if (!result.error) {
        track('micro_dossier_accepted', { callsign_accepted: generated });
        setSaving(false);
        return;
      }
      const taken = result.error.includes('already taken');
      if (taken && generated && attempt < GENERATED_RETRY_LIMIT - 1) {
        const retry = suggestIdentity();
        nextNickname = retry.nickname;
        setSuggestion(retry);
        continue;
      }
      setError(result.error);
      setSaving(false);
      return;
    }
    setSaving(false);
  }

  const acceptReady = customMode || settled;
  const acceptDisabled = saving || !acceptReady;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => {
        if (dismissible && !saving) {
          track('micro_dossier_cancelled');
          onClose();
        }
      }}
    >
      <div
        className="card w-full max-w-sm space-y-4 p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="space-y-2">
          <h2 id={titleId} className="text-display text-xl text-ink">
            Your name
          </h2>
          <p className="text-sm text-secondary">
            We need a name for the leaderboard and your squad. Accept or edit.
          </p>
        </div>

        {customMode ? (
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
              Your name
            </span>
            <input
              className="input-field text-center"
              value={customName}
              maxLength={50}
              autoComplete="nickname"
              onChange={(event) => {
                setCustomName(event.target.value);
                setError(null);
              }}
            />
          </label>
        ) : (
          <div className="space-y-2 rounded-card border border-border bg-page p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Suggested</p>
            <p className="text-display text-2xl text-ink" aria-live="polite">
              {displayName}
            </p>
            <button
              type="button"
              className="text-xs font-semibold uppercase tracking-wide text-accent disabled:opacity-50"
              disabled={saving || !settled}
              onClick={regenerate}
            >
              Suggest another
            </button>
          </div>
        )}

        <button
          type="button"
          className="w-full text-center text-sm text-secondary underline-offset-2 hover:text-ink hover:underline"
          disabled={saving}
          onClick={toggleCustom}
        >
          {customMode ? 'Use the suggestion' : 'I want to type my own'}
        </button>

        {error ? (
          <p className="text-error text-sm" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          className="btn-primary w-full"
          disabled={acceptDisabled}
          onClick={() => void handleAccept()}
        >
          {saving ? 'Saving…' : acceptLabel}
        </button>
      </div>
    </div>
  );
}
