import type { LeaderboardEntry } from '@/lib/sessionSync/types';
import { resolvePacingData } from '@/lib/scoring/resolvePacingData';
import { ScoreBreakdownDisplay } from '@/components/ScoreBreakdownDisplay';
import { Link } from 'react-router-dom';

export type SessionScorecardSaveState = 'idle' | 'saving' | 'saved' | 'unavailable';

interface SessionScorecardProps {
  entry: LeaderboardEntry;
  durationMinutes: number;
  onClose: () => void;
  saveState: SessionScorecardSaveState;
  onSave: () => void;
  saveError?: string | null;
  saveMessage?: string | null;
  /** When set (lobby daisy-chain), primary exit goes back to staging. */
  stagingHref?: string | null;
}

function saveButtonLabel(saveState: SessionScorecardSaveState): string {
  switch (saveState) {
    case 'saving':
      return 'Saving…';
    case 'saved':
      return 'Saved to my account';
    case 'idle':
      return 'Save to my account';
    default:
      return '';
  }
}

export function SessionScorecard({
  entry,
  durationMinutes,
  onClose,
  saveState,
  onSave,
  saveError = null,
  saveMessage = null,
  stagingHref = null,
}: SessionScorecardProps) {
  const titleId = 'session-scorecard-title';
  const showSaveAction = saveState !== 'unavailable';
  const saveDisabled = saveState === 'saving' || saveState === 'saved';
  const pacingData = resolvePacingData({
    roundCount: entry.roundCount,
    partialReps: entry.partialReps,
    liveRounds: entry.rounds,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="card max-h-[90vh] w-full max-w-lg space-y-5 overflow-y-auto p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-display text-xl text-ink">
            Session results
          </h2>
          <button
            type="button"
            className="text-sm text-secondary hover:text-ink"
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <ScoreBreakdownDisplay
          breakdown={{
            baseScore: entry.baseScore,
            pvi: entry.pvi,
            pviMultiplier: entry.pviMultiplier,
            domainWeight: entry.domainWeight,
            finalScore: entry.finalScore,
            roundCount: pacingData?.roundCount,
            roundSplits: pacingData?.roundSplits,
          }}
          roundCount={pacingData?.roundCount}
          partialReps={pacingData?.partialReps}
          roundSplits={pacingData?.roundSplits}
          durationMinutes={durationMinutes}
          showPacingChart
        />

        {showSaveAction ? (
          <div className="space-y-2">
            <button
              type="button"
              className={
                saveState === 'saved'
                  ? 'btn-outline w-full text-sm'
                  : 'btn-primary w-full text-sm'
              }
              disabled={saveDisabled}
              onClick={onSave}
            >
              {saveButtonLabel(saveState)}
            </button>
            {saveMessage ? (
              <p className="text-sm text-accent">{saveMessage}</p>
            ) : null}
            {saveError ? (
              <p className="text-sm text-error">{saveError}</p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-secondary">
            This session can no longer be saved from this device. Rejoin the session if you still
            have access.
          </p>
        )}

        {stagingHref ? (
          <div className="space-y-2">
            <Link className="btn-primary inline-flex w-full justify-center text-sm" to={stagingHref}>
              Back to staging
            </Link>
            <button type="button" className="btn-neutral w-full text-sm" onClick={onClose}>
              Close
            </button>
            <Link className="link-accent block text-center text-sm" to="/">
              Back home
            </Link>
          </div>
        ) : (
          <button type="button" className="btn-neutral w-full text-sm" onClick={onClose}>
            Close
          </button>
        )}
      </div>
    </div>
  );
}
