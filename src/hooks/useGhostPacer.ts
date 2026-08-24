import { useEffect, useMemo, useState } from 'react';
import type { GhostRunRef } from '@/lib/api/ghost';
import { fetchGhostCurveData } from '@/lib/api/ghost';
import {
  buildGhostRepCurve,
  ghostRepsAtElapsed,
  type GhostRepCurvePoint,
} from '@/lib/scoring/ghostCurve';
import type { StoredGhostSelection } from '@/lib/sessionIdentity';

export interface UseGhostPacerInput {
  sessionId: string;
  ghostSelection: StoredGhostSelection | null;
  repsPerRound: number;
  workDurationSec: number;
  elapsedSec: number;
  selfBaseScore: number;
}

export interface UseGhostPacerResult {
  ghostReps: number;
  selfReps: number;
  deltaReps: number;
  ghostLabel: string | null;
  isLoading: boolean;
  error: string | null;
}

export function ghostRunRefToStoredSelection(
  ghost: GhostRunRef,
  label: string
): StoredGhostSelection {
  return {
    sessionId: ghost.sessionId,
    participantId: ghost.participantId,
    label,
    nickname: ghost.nickname,
    finalScore: ghost.finalScore,
    baseScore: ghost.baseScore,
    createdAt: ghost.createdAt,
  };
}

interface GhostCurveFetchState {
  curve: GhostRepCurvePoint[] | null;
  error: string | null;
  isLoading: boolean;
}

export function useGhostPacer({
  ghostSelection,
  elapsedSec,
  selfBaseScore,
}: UseGhostPacerInput): UseGhostPacerResult {
  const ghostKey = ghostSelection
    ? `${ghostSelection.sessionId}:${ghostSelection.participantId}`
    : null;

  const [fetchState, setFetchState] = useState<GhostCurveFetchState | null>(null);

  useEffect(() => {
    if (!ghostKey || !ghostSelection) {
      return;
    }

    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        setFetchState({ curve: null, error: null, isLoading: true });
      }
    });

    fetchGhostCurveData(ghostSelection.sessionId, ghostSelection.participantId).then(
      (result) => {
        if (cancelled) {
          return;
        }

        if (result.error || !result.data) {
          setFetchState({
            curve: null,
            error: result.error?.message ?? 'Could not load ghost pacing data.',
            isLoading: false,
          });
          return;
        }

        const builtCurve = buildGhostRepCurve(
          result.data.rounds,
          result.data.repsPerRound,
          result.data.partialReps,
          result.data.durationSec
        );

        setFetchState({
          curve: builtCurve,
          error: null,
          isLoading: false,
        });
      }
    );

    return () => {
      cancelled = true;
    };
  }, [ghostKey, ghostSelection]);

  const curve = ghostSelection ? (fetchState?.curve ?? null) : null;
  const error = ghostSelection ? (fetchState?.error ?? null) : null;
  const isLoading = ghostSelection ? (fetchState?.isLoading ?? true) : false;

  const ghostReps = useMemo(() => {
    if (!curve) {
      return 0;
    }
    return ghostRepsAtElapsed(curve, elapsedSec);
  }, [curve, elapsedSec]);

  const selfReps = selfBaseScore;
  const deltaReps = selfReps - ghostReps;

  return {
    ghostReps,
    selfReps,
    deltaReps,
    ghostLabel: ghostSelection?.label ?? null,
    isLoading,
    error,
  };
}
