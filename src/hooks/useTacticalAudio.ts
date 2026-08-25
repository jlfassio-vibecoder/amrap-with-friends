import { useCallback, useEffect, useRef } from 'react';
import { selectTacticalCue } from '@/lib/audio/selectTacticalCue';
import type { TacticalClockSnapshot } from '@/lib/audio/selectTacticalCue';
import {
  playRoundLogged as playRoundLoggedTone,
  playTacticalCue,
  unlockTacticalAudio,
} from '@/lib/audio/tacticalSynthesis';
import type { LiveSessionPhase } from '@/lib/sessionSync/types';

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

  const unlock = useCallback(() => {
    unlockTacticalAudio();
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
