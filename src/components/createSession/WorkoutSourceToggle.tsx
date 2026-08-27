export type WorkoutSource = 'custom' | 'library' | 'coach';

const OPTIONS: Array<{ value: WorkoutSource; label: string }> = [
  { value: 'custom', label: 'Custom' },
  { value: 'library', label: 'Choose from library' },
  { value: 'coach', label: 'Coach WODs' },
];

interface WorkoutSourceToggleProps {
  value: WorkoutSource;
  onChange: (value: WorkoutSource) => void;
}

export function WorkoutSourceToggle({ value, onChange }: WorkoutSourceToggleProps) {
  return (
    <div
      className="inline-flex flex-wrap rounded-full border border-border bg-page p-1"
      role="tablist"
      aria-label="Workout source"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className={
            value === option.value
              ? 'rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent'
              : 'rounded-full px-4 py-2 text-sm font-semibold text-secondary hover:text-ink'
          }
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
