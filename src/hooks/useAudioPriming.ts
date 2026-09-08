import { useEffect } from 'react';

/**
 * Warm the audio pipeline on the athlete's first touch of the mission view.
 *
 * The mission-start sample is 200KB. Autoplay policy means the AudioContext
 * cannot exist until a gesture, and until this hook the only gesture that made
 * one was the Start tap itself — the same tap that enters the setup phase and
 * fires the ignition cue. The fetch and decode could not possibly finish in
 * that tick, so `playVaultSample` reported not-ready and mission start fell
 * through to the synthesised sweep. Nothing was removed; the sample simply
 * never arrived in time to be heard.
 *
 * Any earlier tap is enough. This listens once, on the first pointer or key
 * event anywhere in the view, and then removes itself — so by the time the host
 * reaches Start the sample is decoded and waiting.
 *
 * Capture phase, and passive: it must not depend on the event reaching a
 * handler that might stop propagation, and it must never delay a scroll.
 */
export function useAudioPriming(unlock: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let primed = false;
    const prime = () => {
      if (primed) {
        return;
      }
      primed = true;
      unlock();
      remove();
    };

    const options = { capture: true, passive: true } as const;
    const remove = () => {
      window.removeEventListener('pointerdown', prime, options);
      window.removeEventListener('keydown', prime, options);
      window.removeEventListener('touchstart', prime, options);
    };

    window.addEventListener('pointerdown', prime, options);
    window.addEventListener('keydown', prime, options);
    window.addEventListener('touchstart', prime, options);

    return remove;
  }, [unlock, enabled]);
}
