import type { WorkoutTemplate } from '@/data/workoutTemplates';

interface WorkoutTemplateCardProps {
  template: WorkoutTemplate;
  selected: boolean;
  onSelect: (template: WorkoutTemplate) => void;
}

function formatMovementLine(movement: WorkoutTemplate['movements'][number]): string {
  if (movement.reps === undefined) {
    return movement.name;
  }

  return `${movement.reps} ${movement.name}`;
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
      <h3 className="text-display text-base text-ink">{template.name}</h3>
      <ul className="space-y-1 text-sm text-ink">
        {template.movements.map((movement) => (
          <li key={`${template.id}-${movement.name}`}>{formatMovementLine(movement)}</li>
        ))}
      </ul>
      <p className="text-xs italic text-secondary">{template.tacticalNote}</p>
    </button>
  );
}
