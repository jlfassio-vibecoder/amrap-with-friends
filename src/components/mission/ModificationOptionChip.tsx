import { useId } from 'react';
import type { ScalingOption } from '@/data/exerciseScaling';

interface ModificationOptionChipProps {
  option: ScalingOption;
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
}

/**
 * Named modification choice with the "how" tip on hover/focus.
 *
 * Native `title` tooltips are too delayed and often fail to show in embedded
 * browsers, which made the how-line look missing. Same pattern as Daisy-chain:
 * a real tooltip that appears with the group hover/focus.
 */
export function ModificationOptionChip({
  option,
  pressed,
  disabled = false,
  onClick,
}: ModificationOptionChipProps) {
  const tipId = useId();

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-pressed={pressed}
        aria-describedby={tipId}
        disabled={disabled}
        className={
          pressed
            ? 'rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-on-accent'
            : 'rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-ink'
        }
        onClick={onClick}
      >
        {option.label}
      </button>
      <span
        id={tipId}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 w-max max-w-[16rem] -translate-x-1/2 rounded-card border border-border bg-surface px-2.5 py-1.5 text-left text-xs leading-snug text-secondary opacity-0 shadow-card transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {option.how}
      </span>
    </span>
  );
}
