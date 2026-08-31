import type { FormEvent, ReactNode } from 'react';
import type { WorkoutTemplate } from '@/data/workoutTemplates';
import { formatTemplateMovementLine } from '@/lib/workout/templateToExercises';
import type { RallyDay } from '@/lib/session/rallySchedule';
import { HOST_ACTIVE_SESSION_LIMIT } from '@/lib/session/rallySchedule';
import { RallyScheduleFields } from '@/components/session/RallyScheduleFields';

const DURATION_OPTIONS = [5, 10, 15, 20] as const;

export type CreateScheduleMode = 'now' | 'rally';

interface CreateSessionSummaryPanelProps {
  nickname: string;
  durationMinutes: number;
  workoutSource: 'custom' | 'library' | 'coach';
  selectedTemplate: WorkoutTemplate | null;
  selectedCoachWorkout: {
    name: string;
    movements: { name: string; target?: number; unit?: string }[];
  } | null;
  scheduleMode: CreateScheduleMode;
  rallyDay: RallyDay;
  rallyTime: string;
  capReached: boolean;
  error: string | null;
  loading: boolean;
  onNicknameChange: (value: string) => void;
  onDurationChange: (value: number) => void;
  onScheduleModeChange: (value: CreateScheduleMode) => void;
  onRallyDayChange: (value: RallyDay) => void;
  onRallyTimeChange: (value: string) => void;
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

function chipClass(selected: boolean): string {
  return selected
    ? 'rounded-full bg-accent px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-on-accent'
    : 'rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-secondary hover:text-ink';
}

export function CreateSessionSummaryPanel({
  nickname,
  durationMinutes,
  workoutSource,
  selectedTemplate,
  selectedCoachWorkout,
  scheduleMode,
  rallyDay,
  rallyTime,
  capReached,
  error,
  loading,
  onNicknameChange,
  onDurationChange,
  onScheduleModeChange,
  onRallyDayChange,
  onRallyTimeChange,
  onSubmit,
}: CreateSessionSummaryPanelProps) {
  const durationLockedByTemplate =
    (workoutSource === 'library' && selectedTemplate !== null) ||
    (workoutSource === 'coach' && selectedCoachWorkout !== null);
  const submitDisabled = loading || capReached;
  const submitLabel = loading
    ? 'Creating…'
    : scheduleMode === 'rally'
      ? 'Schedule rally point'
      : 'Open rally point';

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
          <div className="space-y-2 rounded-card border border-border bg-page p-4">
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

      {workoutSource === 'coach' && selectedCoachWorkout ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Selected workout</p>
          <div className="space-y-2 rounded-card border border-border bg-page p-4">
            <p className="text-display text-base text-ink">{selectedCoachWorkout.name}</p>
            <ul className="space-y-1 text-sm text-ink">
              {selectedCoachWorkout.movements.map((movement, index) => (
                <li key={index}>
                  {movement.target ? `${movement.target} ` : ''}
                  {movement.name}
                  {movement.unit && movement.unit !== 'reps' ? ` ${movement.unit}` : ''}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-semibold">When</p>
        <div
          className="inline-flex rounded-full border border-border bg-page p-1"
          role="tablist"
          aria-label="Rally point timing"
        >
          <button
            type="button"
            role="tab"
            aria-selected={scheduleMode === 'now'}
            className={chipClass(scheduleMode === 'now')}
            onClick={() => onScheduleModeChange('now')}
          >
            Open rally point
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scheduleMode === 'rally'}
            className={chipClass(scheduleMode === 'rally')}
            onClick={() => onScheduleModeChange('rally')}
          >
            Schedule rally point
          </button>
        </div>
      </div>

      {scheduleMode === 'rally' ? (
        <RallyScheduleFields
          rallyDay={rallyDay}
          rallyTime={rallyTime}
          onRallyDayChange={onRallyDayChange}
          onRallyTimeChange={onRallyTimeChange}
        />
      ) : null}

      {capReached ? (
        <p className="alert-error text-sm">
          You already have {HOST_ACTIVE_SESSION_LIMIT} active sessions.
        </p>
      ) : null}

      {error ? <p className="text-error">Error: {error}</p> : null}

      <button type="submit" className="btn-primary w-full" disabled={submitDisabled}>
        {submitLabel}
      </button>
    </form>
  );
}
