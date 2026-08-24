import type { FormEvent, ReactNode } from 'react';
import type { WorkoutTemplate } from '@/data/workoutTemplates';
import { formatTemplateMovementLine } from '@/lib/workout/templateToExercises';

const DURATION_OPTIONS = [5, 10, 15, 20] as const;

interface CreateSessionSummaryPanelProps {
  nickname: string;
  durationMinutes: number;
  workoutSource: 'custom' | 'library';
  selectedTemplate: WorkoutTemplate | null;
  error: string | null;
  loading: boolean;
  onNicknameChange: (value: string) => void;
  onDurationChange: (value: number) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function SummaryField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

export function CreateSessionSummaryPanel({
  nickname,
  durationMinutes,
  workoutSource,
  selectedTemplate,
  error,
  loading,
  onNicknameChange,
  onDurationChange,
  onSubmit,
}: CreateSessionSummaryPanelProps) {
  const durationLockedByTemplate =
    workoutSource === 'library' && selectedTemplate !== null;

  return (
    <form className="card space-y-4 p-6" onSubmit={onSubmit}>
      <SummaryField label="Your nickname">
        <input
          className="input-field"
          value={nickname}
          onChange={(event) => onNicknameChange(event.target.value)}
          placeholder="Host nickname"
          maxLength={50}
          required
        />
      </SummaryField>

      <SummaryField label="Duration">
        {durationLockedByTemplate ? (
          <p className="text-sm font-semibold text-accent">
            {durationMinutes} min — set by selected workout
          </p>
        ) : (
          <select
            className="input-field"
            value={durationMinutes}
            onChange={(event) => onDurationChange(Number(event.target.value))}
          >
            {DURATION_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes}
              </option>
            ))}
          </select>
        )}
      </SummaryField>

      {workoutSource === 'library' && selectedTemplate ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Selected workout</p>
          <div className="rounded-card border border-border bg-page p-4 space-y-2">
            <p className="text-display text-base text-ink">{selectedTemplate.name}</p>
            <ul className="space-y-1 text-sm text-ink">
              {selectedTemplate.movements.map((movement) => (
                <li key={`${selectedTemplate.id}-${movement.name}`}>
                  {formatTemplateMovementLine(movement)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-error">Error: {error}</p> : null}

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? 'Creating…' : 'Create session'}
      </button>
    </form>
  );
}
