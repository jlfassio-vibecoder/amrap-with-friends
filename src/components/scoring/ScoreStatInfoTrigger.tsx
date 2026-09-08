import { useState, type MouseEvent } from 'react';
import { getScoreStatGuidance, type ScoreStatId } from '@/lib/scoring/scoreStatGuidance';
import { ScoreStatInfoModal } from '@/components/scoring/ScoreStatInfoModal';

interface ScoreStatInfoTriggerProps {
  statId: ScoreStatId;
  className?: string;
  /** Only read for statId="baseScore" — reps-countable workout vs. round-based, for its wording. */
  repsPerRound?: number;
}

/**
 * A small ⓘ beside a score stat's label — the same outlined-circle affordance
 * `HudInfoDisclosure` uses on the HUD cards, so "info exists here" reads as
 * one convention across the app rather than a different mark per screen.
 * Icon-only, unlike `ExerciseInfoTrigger` — these sit in cramped grid cells
 * where the label and value already fill the space, so a second line of
 * button text would crowd the number it is explaining rather than support it.
 *
 * Opens a modal rather than `HudInfoDisclosure`'s inline panel: these labels
 * sit inside a scorecard the reader is actively comparing against, where an
 * inline panel would push the very numbers around that it is explaining.
 */
export function ScoreStatInfoTrigger({
  statId,
  className,
  repsPerRound,
}: ScoreStatInfoTriggerProps) {
  const guidance = getScoreStatGuidance(statId, { repsPerRound });
  const [open, setOpen] = useState(false);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    event.preventDefault();
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-secondary text-[10px] font-semibold leading-none text-secondary hover:border-ink hover:text-ink ${className ?? ''}`}
        aria-label={`What is ${guidance.title}?`}
        title={`What is ${guidance.title}?`}
        onClick={handleClick}
      >
        i
      </button>
      {open ? <ScoreStatInfoModal guidance={guidance} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
