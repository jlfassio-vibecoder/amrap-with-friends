import { useState } from 'react';
import {
  shouldCloseMissionLockedModal,
  shouldShowMissionLockedModal,
} from '@/lib/mission/shouldShowMissionLockedModal';
import type { LiveMissionPhase } from '@/lib/missionSync/types';

export interface UseMissionLockedModalReturn {
  visible: boolean;
  dismiss: () => void;
}

/**
 * Opens the MISSION LOCKED modal on the transition into the setup countdown,
 * for every participant watching the same `phase` — not only the host who
 * pressed Start. Auto-closes the instant setup ends, and `dismiss` can close
 * it early; neither one blocks or delays the countdown running underneath it.
 *
 * Reacts to `phase` by adjusting state during render rather than in a
 * `useEffect` — React's own documented alternative for "state changed
 * because a prop changed," and it sidesteps the cascading-render effect a
 * setState-in-effect would otherwise cause here.
 */
export function useMissionLockedModal(
  phase: LiveMissionPhase,
  isPractice: boolean
): UseMissionLockedModalReturn {
  const [visible, setVisible] = useState(false);
  const [renderedForPhase, setRenderedForPhase] = useState<LiveMissionPhase | null>(null);

  if (phase !== renderedForPhase) {
    const prevPhase = renderedForPhase;
    setRenderedForPhase(phase);
    if (shouldShowMissionLockedModal({ prevPhase, nextPhase: phase, isPractice })) {
      setVisible(true);
    } else if (shouldCloseMissionLockedModal(phase)) {
      setVisible(false);
    }
  }

  return {
    visible,
    dismiss: () => setVisible(false),
  };
}
