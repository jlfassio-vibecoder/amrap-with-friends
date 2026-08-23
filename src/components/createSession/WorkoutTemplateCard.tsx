import type { KeyboardEvent } from 'react';
import type { WorkoutTemplate } from '@/data/workoutTemplates';
import { ExerciseInfoTrigger } from '@/components/exerciseInfo/ExerciseInfoTrigger';
import { formatTemplateMovementLine } from '@/lib/workout/templateToExercises';

interface WorkoutTemplateCardProps {
  template: WorkoutTemplate;
  selected: boolean;
  onSelect: (template: WorkoutTemplate) => void;
}

export function WorkoutTemplateCard({ template, selected, onSelect }: WorkoutTemplateCardProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(template);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      className={
        selected
          ? 'card relative w-full cursor-pointer space-y-3 border-2 border-accent p-4 text-left shadow-card'
          : 'card w-full cursor-pointer space-y-3 p-4 text-left hover:border-accent/40'
      }
      onClick={() => onSelect(template)}
      onKeyDown={handleKeyDown}
    >
      {selected ? (
        <span
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent"
          aria-hidden="true"
        >
          ✓
        </span>
      ) : null}
      <div className="space-y-1">
        <h3 className="text-display text-base text-ink">{template.name}</h3>
        {template.focus ? (
          <span className="inline-block rounded-full border border-border bg-page px-2 py-0.5 text-xs font-semibold text-secondary">
            {template.focus}
          </span>
        ) : null}
      </div>
      <ul className="space-y-1 text-sm text-ink">
        {template.movements.map((movement) => (
          <li
            key={`${template.id}-${movement.name}`}
            className="flex items-center justify-between gap-2"
          >
            <span>{formatTemplateMovementLine(movement)}</span>
            <ExerciseInfoTrigger name={movement.name} size="sm" />
          </li>
        ))}
      </ul>
      <p className="text-xs italic text-secondary">{template.tacticalNote}</p>
    </div>
  );
}
