import type { WorkoutTemplate } from '@/data/workoutTemplates';
import { formatTemplateMovementLine } from '@/lib/workout/templateToExercises';

interface WorkoutTemplateCardProps {
  template: WorkoutTemplate;
  selected: boolean;
  onSelect: (template: WorkoutTemplate) => void;
}

export function WorkoutTemplateCard({ template, selected, onSelect }: WorkoutTemplateCardProps) {
  return (
    <button
      type="button"
      className={
        selected
          ? 'card relative w-full space-y-3 border-2 border-accent p-4 text-left shadow-card'
          : 'card w-full space-y-3 p-4 text-left hover:border-accent/40'
      }
      aria-pressed={selected}
      onClick={() => onSelect(template)}
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
          <li key={`${template.id}-${movement.name}`}>
            {formatTemplateMovementLine(movement)}
          </li>
        ))}
      </ul>
      <p className="text-xs italic text-secondary">{template.tacticalNote}</p>
    </button>
  );
}
