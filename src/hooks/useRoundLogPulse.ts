import { useCallback, useRef, useState } from 'react';

const SEAL_CLASS = 'animate-round-log-seal';

export interface UseRoundLogPulseReturn {
  /** Attach to the Log round button. It never remounts — see `pulse`. */
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  /**
   * Bumps on every pulse. Use as a `key` on decorative, non-interactive
   * overlays (the ripple waves, the clock-digit flash) so each one remounts
   * and replays, including back-to-back pulses a second apart.
   */
  pulseKey: number;
  /** Call once per logged round, from the same place `playRoundLogged()` fires. */
  pulse: () => void;
}

/**
 * Drives the "vault seal" visual feedback for a logged round.
 *
 * The button itself never remounts. It is tapped dozens of times over one
 * mission, and a `key`-remount would risk dropping an in-flight tap on a
 * touch device right as the element is torn down and recreated — the wrong
 * trade for the one piece here that is actually interactive. Instead its
 * animation class is removed, the layout is read once to force the browser
 * to flush that removal, and the class is added back — the standard way to
 * replay a CSS keyframe on a persistent element, including when a second tap
 * lands before the first animation has finished.
 *
 * The ripples and the clock-digit flash carry no interactive state, so they
 * use the simpler `key`-remount instead (ripples via a fixed portal so they
 * can expand past overflow containers).
 */
export function useRoundLogPulse(): UseRoundLogPulseReturn {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pulseKey, setPulseKey] = useState(0);

  const pulse = useCallback(() => {
    setPulseKey((key) => key + 1);

    const el = buttonRef.current;
    if (!el) {
      return;
    }
    el.classList.remove(SEAL_CLASS);
    // Reading a layout property forces the browser to flush the removal
    // before the class goes back on; skipping this, a second tap mid-animation
    // would see the class as already present and never restart it.
    void el.offsetWidth;
    el.classList.add(SEAL_CLASS);
  }, []);

  return { buttonRef, pulseKey, pulse };
}
