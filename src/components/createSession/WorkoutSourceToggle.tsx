export type WorkoutSource = 'custom' | 'library';

interface WorkoutSourceToggleProps {
  value: WorkoutSource;
  onChange: (value: WorkoutSource) => void;
}

export function WorkoutSourceToggle({ value, onChange }: WorkoutSourceToggleProps) {
  return (
    <div
      className="inline-flex rounded-full border border-border bg-page p-1"
      role="tablist"
      aria-label="Workout source"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === 'custom'}
        className={
          value === 'custom'
            ? 'rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent'
            : 'rounded-full px-4 py-2 text-sm font-semibold text-secondary hover:text-ink'
        }
        onClick={() => onChange('custom')}
      >
        Custom
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'library'}
        className={
          value === 'library'
            ? 'rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent'
            : 'rounded-full px-4 py-2 text-sm font-semibold text-secondary hover:text-ink'
        }
        onClick={() => onChange('library')}
      >
        Choose from library
      </button>
    </div>
  );
}
