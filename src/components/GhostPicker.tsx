import { useEffect, useState } from 'react';
import { AuthModal } from '@/components/AuthModal';
import { fetchAvailableGhosts, type GhostRunRef } from '@/lib/api/ghost';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { ghostRunRefToStoredSelection } from '@/hooks/useGhostPacer';
import { setStoredGhostSelection, type StoredGhostSelection } from '@/lib/missionIdentity';

export type GhostPickerValue = 'none' | 'personal-best' | 'variant-best' | `crew:${string}`;

interface GhostPickerProps {
  missionId: string;
  templateId: string;
  durationMinutes: number;
  value: StoredGhostSelection | null;
  onChange: (selection: StoredGhostSelection | null) => void;
  /**
   * The version the athlete has said they will perform, from `versionKeyFor`.
   *
   * Empty means as programmed, and only the standard best is offered. Naming a
   * version additionally offers their best previous run of that same version —
   * the like-for-like curve, and the only one they can actually chase.
   */
  versionKey?: string;
  /** How that version reads, e.g. "Diamond Push-ups: from the knees". */
  versionLabel?: string | null;
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

/** Prefixed, because on its own "48 reps" gives no clue which version it was. */
function variantBestLabel(ghost: GhostRunRef, versionLabel: string | null): string {
  const dateLabel = formatGhostDate(ghost.createdAt);
  const version = versionLabel ?? 'Same modification';
  return dateLabel
    ? `${version} · ${ghost.finalScore} reps · ${dateLabel}`
    : `${version} · ${ghost.finalScore} reps`;
}

function personalBestLabel(ghost: GhostRunRef): string {
  const dateLabel = formatGhostDate(ghost.createdAt);
  return dateLabel
    ? `Personal Best · ${ghost.finalScore} reps · ${dateLabel}`
    : `Personal Best · ${ghost.finalScore} reps`;
}

function crewGhostLabel(ghost: GhostRunRef): string {
  const dateLabel = formatGhostDate(ghost.createdAt);
  return dateLabel
    ? `${ghost.nickname} · ${ghost.finalScore} reps · ${dateLabel}`
    : `${ghost.nickname} · ${ghost.finalScore} reps`;
}

function crewOptionValue(participantId: string): GhostPickerValue {
  return `crew:${participantId}`;
}

export function GhostPicker({
  missionId,
  templateId,
  durationMinutes,
  value,
  onChange,
  versionKey = '',
  versionLabel = null,
  embedded = false,
}: GhostPickerProps) {
  const { isAuthenticated, isAuthLoading } = useAmrapAuth();
  const [personalBest, setPersonalBest] = useState<GhostRunRef | null>(null);
  const [variantBest, setVariantBest] = useState<GhostRunRef | null>(null);
  const [crewRuns, setCrewRuns] = useState<GhostRunRef[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // False until a fetch for the current inputs has come back. `isLoading` is
  // set in a microtask, so on the very first render nothing is loading and
  // nothing has loaded — and those two are not the same state.
  const [hasLoaded, setHasLoaded] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const canFetchGhosts = !isAuthLoading && isAuthenticated;

  useEffect(() => {
    if (!canFetchGhosts) {
      return;
    }

    let cancelled = false;
    setHasLoaded(false);

    queueMicrotask(() => {
      if (!cancelled) {
        setIsLoading(true);
        setLoadError(null);
      }
    });

    fetchAvailableGhosts(templateId, durationMinutes, missionId, versionKey).then((result) => {
      if (cancelled) {
        return;
      }

      if (result.error) {
        setPersonalBest(null);
        setVariantBest(null);
        setCrewRuns([]);
        setLoadError(result.error.message);
        setIsLoading(false);
        setHasLoaded(true);
        return;
      }

      setPersonalBest(result.data?.personalBest ?? null);
      setVariantBest(result.data?.variantBest ?? null);
      setCrewRuns(result.data?.friends ?? []);
      setIsLoading(false);
      setHasLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [canFetchGhosts, templateId, durationMinutes, missionId, versionKey]);

  const displayedPersonalBest = canFetchGhosts ? personalBest : null;
  const displayedVariantBest = canFetchGhosts ? variantBest : null;
  const displayedCrew = canFetchGhosts ? crewRuns : [];

  function isSameRun(run: GhostRunRef, selection: StoredGhostSelection): boolean {
    return run.participantId === selection.participantId && run.missionId === selection.missionId;
  }

  let selectedValue: GhostPickerValue = 'none';
  if (value) {
    // Matched by run, not by label. A label is display copy; two of the three
    // option kinds now start with a movement name, and the athlete's selection
    // has to survive the copy changing.
    const crewMatch = displayedCrew.find((run) => isSameRun(run, value));
    if (crewMatch) {
      selectedValue = crewOptionValue(crewMatch.participantId);
    } else if (displayedVariantBest && isSameRun(displayedVariantBest, value)) {
      selectedValue = 'variant-best';
    } else if (displayedPersonalBest && isSameRun(displayedPersonalBest, value)) {
      selectedValue = 'personal-best';
    }
  }

  // An athlete who picks the knee-push-up ghost and then unticks the modification has
  // a selection the server will no longer offer. Left alone it stays invisible
  // in the select while still pacing the mission, so drop it rather than race a
  // version they have said they are not doing.
  const selectionIsStale =
    value !== null &&
    selectedValue === 'none' &&
    canFetchGhosts &&
    hasLoaded &&
    !isLoading &&
    !loadError;
  useEffect(() => {
    if (!selectionIsStale) {
      return;
    }
    setStoredGhostSelection(missionId, null);
    onChange(null);
  }, [selectionIsStale, missionId, onChange]);

  function handleSelect(nextValue: GhostPickerValue) {
    if (nextValue === 'none') {
      setStoredGhostSelection(missionId, null);
      onChange(null);
      return;
    }

    if (nextValue === 'variant-best') {
      if (!displayedVariantBest) {
        return;
      }
      const label = variantBestLabel(displayedVariantBest, versionLabel);
      const selection = ghostRunRefToStoredSelection(displayedVariantBest, label);
      setStoredGhostSelection(missionId, selection);
      onChange(selection);
      return;
    }

    if (nextValue === 'personal-best') {
      if (!displayedPersonalBest) {
        return;
      }
      const label = personalBestLabel(displayedPersonalBest);
      const selection = ghostRunRefToStoredSelection(displayedPersonalBest, label);
      setStoredGhostSelection(missionId, selection);
      onChange(selection);
      return;
    }

    if (nextValue.startsWith('crew:')) {
      const participantId = nextValue.slice('crew:'.length);
      const run = displayedCrew.find((entry) => entry.participantId === participantId);
      if (!run) {
        return;
      }
      const label = crewGhostLabel(run);
      const selection = ghostRunRefToStoredSelection(run, label);
      setStoredGhostSelection(missionId, selection);
      onChange(selection);
    }
  }

  const intro =
    displayedCrew.length > 0
      ? 'Race a crewmate from the mission you missed, or your personal best.'
      : 'Race your personal best pacing curve in real time.';

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
          <p className="text-[11px] text-secondary">{intro}</p>
        </div>
      )}

      {!isAuthenticated && !isAuthLoading ? (
        <div className="space-y-2 text-sm">
          <p className="text-secondary">Sign in to load your personal best ghost.</p>
          <button type="button" className="btn-outline text-sm" onClick={() => setAuthOpen(true)}>
            Sign in
          </button>
        </div>
      ) : (
        <select
          id="ghost-picker"
          className="input-field w-full py-1.5 text-sm"
          value={selectedValue}
          disabled={isLoading || !canFetchGhosts}
          onChange={(event) => handleSelect(event.target.value as GhostPickerValue)}
        >
          <option value="none">None</option>
          {displayedCrew.map((run) => (
            <option key={run.participantId} value={crewOptionValue(run.participantId)}>
              {crewGhostLabel(run)}
            </option>
          ))}
          {displayedVariantBest ? (
            <option value="variant-best">
              {variantBestLabel(displayedVariantBest, versionLabel)}
            </option>
          ) : null}
          {displayedPersonalBest ? (
            <option value="personal-best">{personalBestLabel(displayedPersonalBest)}</option>
          ) : null}
        </select>
      )}

      {isLoading && canFetchGhosts ? <p className="text-xs text-muted">Loading pacers…</p> : null}

      {loadError ? <p className="text-error text-xs">{loadError}</p> : null}

      {canFetchGhosts &&
      !isLoading &&
      !displayedPersonalBest &&
      !displayedVariantBest &&
      displayedCrew.length === 0 &&
      !loadError ? (
        <p className="text-xs text-muted">No locked personal best found for this template yet.</p>
      ) : null}

      {canFetchGhosts && !isLoading && versionKey !== '' && !displayedVariantBest && !loadError ? (
        <p className="text-xs text-muted">
          First time doing it this way — finish it and it becomes the pace to beat.
        </p>
      ) : null}

      {authOpen ? <AuthModal onClose={() => setAuthOpen(false)} /> : null}
    </section>
  );
}
