import { CUTS, type CutId } from '@/lib/share/cuts';

export const REPLAY_FPS = 30;

export interface FrameSchedule {
  totalFrames: number;
  /** Video-time seconds for frame `index`. */
  timeAt: (index: number) => number;
}

/**
 * Frame numbers to video seconds.
 *
 * Separated from the encoder so the count can be asserted without a browser:
 * an off-by-one here is 33 milliseconds of black at the end of every replay,
 * which is exactly the sort of thing nobody notices until it ships.
 */
export function frameSchedule(cutId: CutId, fps: number = REPLAY_FPS): FrameSchedule {
  const cut = CUTS[cutId];
  // Inclusive of the final frame: a 20s cut at 30fps is 600 intervals and 601
  // frames, and dropping the last one cuts the freeze short.
  const totalFrames = Math.round(cut.durationSeconds * fps) + 1;
  return {
    totalFrames,
    timeAt: (index) => Math.min(cut.durationSeconds, index / fps),
  };
}

/** Whole seconds remaining, the way a gym clock counts down. */
export function formatClockSeconds(capSeconds: number, elapsedSeconds: number): string {
  const remaining = Math.max(0, Math.ceil(capSeconds - elapsedSeconds));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
