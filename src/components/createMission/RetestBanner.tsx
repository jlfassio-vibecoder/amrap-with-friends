import { formatVariantBadge } from '@/lib/mission/exerciseScaling';
import type { MovementVariantSelection } from '@/lib/mission/exerciseScaling';

interface RetestBannerProps {
  workoutTitle: string;
  durationMinutes: number;
  movementVariants: MovementVariantSelection;
  onCancel: () => void;
}

/**
 * The workout and clock are fixed while retesting a benchmark.
 *
 * A retest at a different clock, or with the movements performed differently,
 * is not a retest — the number it produces cannot be compared to the one it is
 * supposed to be compared to. So the picker is replaced rather than merely
 * pre-filled: a pre-filled picker is one stray tap away from silently
 * measuring nothing.
 *
 * There is still a way out. Locking without an exit turns a wrong tap into a
 * trap, so "Start a different mission instead" drops the retest and gives the
 * picker back — the athlete gets a deliberate choice rather than a blocked one.
 */
export function RetestBanner({
  workoutTitle,
  durationMinutes,
  movementVariants,
  onCancel,
}: RetestBannerProps) {
  const variantLine = formatVariantBadge(movementVariants);

  return (
    <div className="rounded-card border border-accent bg-accent-tint p-4">
      <p className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-on-accent">
          Retest
        </span>
        <span className="text-display text-lg text-ink">{workoutTitle}</span>
        <span className="text-sm text-secondary">· {durationMinutes} min</span>
      </p>

      {variantLine ? (
        <p className="mt-2 text-sm text-secondary">
          Set up the way you benchmarked it — {variantLine.toLowerCase()}.
        </p>
      ) : null}

      <p className="mt-2 text-sm text-secondary">
        Same workout, same clock. That is what makes the two scores comparable.
      </p>

      <button type="button" className="link-accent mt-3 text-xs" onClick={onCancel}>
        Start a different mission instead
      </button>
    </div>
  );
}
