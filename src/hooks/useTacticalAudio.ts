import { useCallback, useEffect, useRef } from 'react';
import { selectTacticalCue } from '@/lib/audio/selectTacticalCue';
import type { TacticalClockSnapshot } from '@/lib/audio/selectTacticalCue';
import {
  playRoundLogged as playRoundLoggedTone,
  playTacticalCue,
  unlockTacticalAudio,
} from '@/lib/audio/tacticalSynthesis';
import type { LiveSessionPhase } from '@/lib/sessionSync/types';
import { track } from '@/lib/analytics/track';

interface UseTacticalAudioInput {
  phase: LiveSessionPhase;
  timeLeftSec: number;
  isPaused: boolean;
  workDurationSec: number;
}

export interface UseTacticalAudioReturn {
  unlock: () => void;
  playRoundLogged: () => void;
}

export function useTacticalAudio({
  phase,
  timeLeftSec,
  isPaused,
  workDurationSec,
}: UseTacticalAudioInput): UseTacticalAudioReturn {
  const prevRef = useRef<TacticalClockSnapshot | null>(null);
  const hasTrackedUnlockRef = useRef(false);

  const unlock = useCallback(() => {
    const context = unlockTacticalAudio();
    if (hasTrackedUnlockRef.current || !context) {
      return;
    }
    hasTrackedUnlockRef.current = true;
    void context.resume().then(
      () => track('audio_unlock_result', { state: context.state }),
      () => track('audio_unlock_result', { state: context.state, error: true })
    );
  }, []);

  const playRoundLogged = useCallback(() => {
    unlockTacticalAudio();
    playRoundLoggedTone();
  }, []);

  useEffect(() => {
    const next: TacticalClockSnapshot = {
      phase,
      timeLeftSec,
      isPaused,
      workDurationSec,
    };
    const cues = selectTacticalCue(prevRef.current, next);
    prevRef.current = next;
    for (const cue of cues) {
      playTacticalCue(cue);
    }
  }, [phase, timeLeftSec, isPaused, workDurationSec]);

  return { unlock, playRoundLogged };
}
