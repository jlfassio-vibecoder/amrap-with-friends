import type { LeaderboardEntry } from '@/lib/missionSync/types';
import { formatModifiedBadge } from '@/lib/mission/modifiedMovements';
import { formatVariantBadge } from '@/lib/mission/exerciseScaling';
import { AppLink } from '@/components/AppLink';
import { resolvePacingData } from '@/lib/scoring/resolvePacingData';
import { ScoreBreakdownDisplay } from '@/components/ScoreBreakdownDisplay';
import { DaisyChainCta } from '@/components/mission/DaisyChainCta';
import { ShareCardSection } from '@/components/share/ShareCardSection';
import { announceNextMission } from '@/lib/api/rallyPoint';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export type MissionScorecardSaveState = 'idle' | 'saving' | 'saved' | 'unavailable';

interface MissionScorecardProps {
  entry: LeaderboardEntry;
  durationMinutes: number;
  onClose: () => void;
  saveState: MissionScorecardSaveState;
  onSave: () => void;
  saveError?: string | null;
  saveMessage?: string | null;
  /** When set (rallyPoint daisy-chain), primary exit opens the next-mission picker. */
  rallyPointHref?: string | null;
  rallyPointId?: string | null;
  isHost?: boolean;
  /** Pre-planned chain: hide Daisy-chain CTA and show the next queued name. */
  nextUpMissionName?: string | null;
  /** After chain advance: primary Continue navigates here instead of Daisy-chain / hub. */
  nextMissionId?: string | null;
  /** Set to offer the share card. Omitted where there is no mission to share (previews, tests). */
  missionId?: string | null;
  templateId?: string | null;
}

function saveButtonLabel(saveState: MissionScorecardSaveState): string {
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

export function MissionScorecard({
  entry,
  durationMinutes,
  onClose,
  saveState,
  onSave,
  saveError = null,
  saveMessage = null,
  rallyPointHref = null,
  rallyPointId = null,
  isHost = false,
  nextUpMissionName = null,
  nextMissionId = null,
  missionId = null,
  templateId = null,
}: MissionScorecardProps) {
  const navigate = useNavigate();
  const titleId = 'mission-scorecard-title';
  const modifiedBadge =
    formatVariantBadge(entry.movementVariants) ?? formatModifiedBadge(entry.modifiedMovements);
  const showSaveAction = saveState !== 'unavailable';
  const saveDisabled = saveState === 'saving' || saveState === 'saved';
  const [daisyError, setDaisyError] = useState<string | null>(null);
  const pacingData = resolvePacingData({
    roundCount: entry.roundCount,
    partialReps: entry.partialReps,
    liveRounds: entry.rounds,
  });

  function handleContinueToRest() {
    if (!nextMissionId) {
      return;
    }
    navigate(`/mission/${nextMissionId}`);
  }

  async function handleDaisyChain() {
    if (!rallyPointHref) {
      return;
    }
    setDaisyError(null);
    if (isHost && rallyPointId) {
      const result = await announceNextMission(rallyPointId);
      if (result.error) {
        setDaisyError(result.error.message);
        return;
      }
    }
    navigate(rallyPointHref);
  }

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
            Mission results
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

        {modifiedBadge ? (
          <p className="rounded-card border border-border bg-page px-3 py-2 text-xs text-secondary">
            <span className="font-semibold text-ink">{modifiedBadge}.</span> Recorded on your score
            so it can be read fairly. It does not lower it.
          </p>
        ) : null}

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
          repsPerRound={entry.repsPerRound}
          showPacingChart
        />

        {showSaveAction ? (
          <div className="space-y-2">
            <button
              type="button"
              className={
                saveState === 'saved' ? 'btn-outline w-full text-sm' : 'btn-primary w-full text-sm'
              }
              disabled={saveDisabled}
              onClick={onSave}
            >
              {saveButtonLabel(saveState)}
            </button>
            {saveMessage ? <p className="text-sm text-accent">{saveMessage}</p> : null}
            {saveError ? <p className="text-error text-sm">{saveError}</p> : null}
          </div>
        ) : (
          <p className="text-sm text-secondary">
            This mission can no longer be saved from this device. Rejoin the mission if you still
            have access.
          </p>
        )}

        {rallyPointHref || nextMissionId ? (
          <div className="space-y-2">
            {nextMissionId ? (
              <>
                <button
                  type="button"
                  className="btn-primary w-full text-sm"
                  onClick={handleContinueToRest}
                >
                  Continue
                </button>
                {nextUpMissionName ? (
                  <p className="text-center text-sm text-secondary">
                    Next up: <span className="font-semibold text-ink">{nextUpMissionName}</span>
                  </p>
                ) : null}
              </>
            ) : nextUpMissionName ? (
              <p className="text-center text-sm text-secondary">
                Next up: <span className="font-semibold text-ink">{nextUpMissionName}</span>
              </p>
            ) : (
              <DaisyChainCta onActivate={handleDaisyChain} />
            )}
            {daisyError ? <p className="text-error text-sm">{daisyError}</p> : null}
            {/* Before the exits: a guest who shares and leaves has still put
                the link in front of their followers. */}
            {missionId ? <ShareCardSection missionId={missionId} templateId={templateId} /> : null}
            <button type="button" className="btn-neutral w-full text-sm" onClick={onClose}>
              Close
            </button>
            <AppLink className="link-accent block text-center text-sm" to="/">
              Back home
            </AppLink>
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
