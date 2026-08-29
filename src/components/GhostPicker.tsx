import { useEffect, useState } from 'react';
import { AuthModal } from '@/components/AuthModal';
import {
  fetchAvailableGhosts,
  type GhostRunRef,
} from '@/lib/api/ghost';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { ghostRunRefToStoredSelection } from '@/hooks/useGhostPacer';
import {
  setStoredGhostSelection,
  type StoredGhostSelection,
} from '@/lib/sessionIdentity';

export type GhostPickerValue = 'none' | 'personal-best';

interface GhostPickerProps {
  sessionId: string;
  templateId: string;
  durationMinutes: number;
  value: StoredGhostSelection | null;
  onChange: (selection: StoredGhostSelection | null) => void;
  /** When true, omit the Select Pacer title/intro — parent step supplies the label. */
  embedded?: boolean;
}

function formatGhostDate(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function personalBestLabel(ghost: GhostRunRef): string {
  const dateLabel = formatGhostDate(ghost.createdAt);
  return dateLabel
    ? `Personal Best · ${ghost.finalScore} reps · ${dateLabel}`
    : `Personal Best · ${ghost.finalScore} reps`;
}

export function GhostPicker({
  sessionId,
  templateId,
  durationMinutes,
  value,
  onChange,
  embedded = false,
}: GhostPickerProps) {
  const { isAuthenticated, isAuthLoading } = useAmrapAuth();
  const [personalBest, setPersonalBest] = useState<GhostRunRef | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const canFetchGhosts = !isAuthLoading && isAuthenticated;

  useEffect(() => {
    if (!canFetchGhosts) {
      return;
    }

    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        setIsLoading(true);
        setLoadError(null);
      }
    });

    fetchAvailableGhosts(templateId, durationMinutes).then((result) => {
      if (cancelled) {
        return;
      }

      if (result.error) {
        setPersonalBest(null);
        setLoadError(result.error.message);
        setIsLoading(false);
        return;
      }

      setPersonalBest(result.data?.personalBest ?? null);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [canFetchGhosts, templateId, durationMinutes]);

  const displayedPersonalBest = canFetchGhosts ? personalBest : null;

  // Copilot suggestion ignored: selectedValue is already gated on displayedPersonalBest to avoid orphan options.
  const selectedValue: GhostPickerValue =
    value?.label.startsWith('Personal Best') && displayedPersonalBest
      ? 'personal-best'
      : 'none';

  function handleSelect(nextValue: GhostPickerValue) {
    if (nextValue === 'none') {
      setStoredGhostSelection(sessionId, null);
      onChange(null);
      return;
    }

    if (!displayedPersonalBest) {
      return;
    }

    const label = personalBestLabel(displayedPersonalBest);
    const selection = ghostRunRefToStoredSelection(displayedPersonalBest, label);
    setStoredGhostSelection(sessionId, selection);
    onChange(selection);
  }

  return (
    <section
      className={
        embedded
          ? 'space-y-1.5 text-left'
          : 'card space-y-1.5 p-3 text-left lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none'
      }
      data-walkthrough-id={embedded ? undefined : 'pacer'}
    >
      {embedded ? null : (
        <div className="space-y-0.5">
          <label
            htmlFor="ghost-picker"
            className="text-display text-xs uppercase tracking-widest text-secondary"
          >
            Select Pacer
          </label>
          <p className="text-[11px] text-secondary">
            Race your personal best pacing curve in real time.
          </p>
        </div>
      )}

      {!isAuthenticated && !isAuthLoading ? (
        <div className="space-y-2 text-sm">
          <p className="text-secondary">Sign in to load your personal best ghost.</p>
          <button
            type="button"
            className="btn-outline text-sm"
            onClick={() => setAuthOpen(true)}
          >
            Sign in
          </button>
        </div>
      ) : (
        <select
          id="ghost-picker"
          className="input-field w-full py-1.5 text-sm"
          value={selectedValue}
          disabled={isLoading || !canFetchGhosts}
          onChange={(event) =>
            handleSelect(event.target.value as GhostPickerValue)
          }
        >
          <option value="none">None</option>
          {displayedPersonalBest ? (
            <option value="personal-best">
              {personalBestLabel(displayedPersonalBest)}
            </option>
          ) : null}
        </select>
      )}

      {isLoading && canFetchGhosts ? (
        <p className="text-xs text-muted">Loading personal best…</p>
      ) : null}

      {loadError ? (
        <p className="text-xs text-error">{loadError}</p>
      ) : null}

      {canFetchGhosts && !isLoading && !displayedPersonalBest && !loadError ? (
        <p className="text-xs text-muted">
          No locked personal best found for this template yet.
        </p>
      ) : null}

      {authOpen ? <AuthModal onClose={() => setAuthOpen(false)} /> : null}
    </section>
  );
}
