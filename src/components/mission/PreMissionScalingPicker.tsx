import { ModificationOptionChip } from '@/components/mission/ModificationOptionChip';
import type { WorkoutExercise } from '@/lib/api/missionTypes';
import {
  scalingOptionsForMovement,
  type MovementVariantSelection,
} from '@/lib/mission/exerciseScaling';

interface PreMissionScalingPickerProps {
  workout: WorkoutExercise[];
  variants: MovementVariantSelection;
  disabled?: boolean;
  onChange: (variants: MovementVariantSelection) => void;
}

/**
 * Choosing a modification before the clock starts, so the athlete decides how
 * they are going to move rather than discovering mid-round that they cannot.
 *
 * Only movements with a named ladder appear here. A bare "I modified this" has
 * no meaning until it has happened, and the end-of-mission checklist is still
 * where any movement can be marked — this surface exists to name a *known*
 * variant early, which is the thing that becomes a progression later.
 *
 * Collapsed by default: most athletes on most missions modify nothing, and a
 * rally point that opens with a list of ways to make the workout easier is
 * selling the wrong idea.
 */
export function PreMissionScalingPicker({
  workout,
  variants,
  disabled = false,
  onChange,
}: PreMissionScalingPickerProps) {
  const scalable = workout.filter(
    (exercise) => scalingOptionsForMovement(exercise.name).length > 0
  );

  if (scalable.length === 0) {
    return null;
  }

  const chosenCount = Object.keys(variants).length;

  function choose(name: string, optionId: string) {
    if (variants[name] === optionId) {
      onChange(Object.fromEntries(Object.entries(variants).filter(([key]) => key !== name)));
      return;
    }
    onChange({ ...variants, [name]: optionId });
  }

  return (
    <details className="rounded-card border border-border bg-page p-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="text-[0.75em] leading-none">
          ▼
        </span>
        Need to modify a movement?
        {chosenCount > 0 ? (
          <span className="ml-auto text-xs font-normal text-secondary">{chosenCount} chosen</span>
        ) : null}
      </summary>

      <div className="mt-3 space-y-3">
        {scalable.map((exercise) => {
          const options = scalingOptionsForMovement(exercise.name);
          return (
            <div key={exercise.name} className="space-y-1.5">
              <p className="text-sm text-ink">{exercise.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {options.map((option) => (
                  <ModificationOptionChip
                    key={option.id}
                    option={option}
                    pressed={variants[exercise.name] === option.id}
                    disabled={disabled}
                    onClick={() => choose(exercise.name, option.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
        <p className="text-xs text-muted">
          Pick one now and it is waiting for you on your score. You can still change it when the
          mission ends. Modifying does not lower your score.
        </p>
      </div>
    </details>
  );
}
