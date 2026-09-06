import type { FormEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { TimeDomain, WorkoutTemplate } from '@/data/workoutTemplates';
import { formatTemplateMovementLine } from '@/lib/workout/templateToExercises';
import type { RallyDay } from '@/lib/mission/rallySchedule';
import { HOST_ACTIVE_MISSION_LIMIT } from '@/lib/mission/rallySchedule';
import { RallyScheduleFields } from '@/components/mission/RallyScheduleFields';
import { TimeCapControl } from '@/components/createMission/TimeCapControl';
import { TIME_DOMAINS } from '@/data/workoutTemplates';
import type { MissionTimeCap } from '@/lib/timeDomains';

export type CreateScheduleMode = 'now' | 'rally';

interface CreateMissionSummaryPanelProps {
  nickname: string;
  /** The mission clock. */
  durationMinutes: MissionTimeCap;
  /** The library bucket the clock belongs to. */
  selectedDomain: TimeDomain;
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
  /** Optional link shown under the error (e.g. finish profile). */
  errorAction?: { to: string; label: string } | null;
  /** Soft copy when the visitor is signed out. */
  unsignedHint?: string | null;
  /** Mission chain builder slot (library Create only). */
  chainBuilder?: ReactNode;
  /** When true, hide the single-template preview — the chain list owns that job. */
  hideSelectedWorkoutPreview?: boolean;
  loading: boolean;
  onNicknameChange: (value: string) => void;
  /** Changes the time domain, and with it the canonical clock. */
  onDurationChange: (value: number) => void;
  /** Moves the clock inside the current domain. */
  onCapChange: (value: MissionTimeCap) => void;
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

export function CreateMissionSummaryPanel({
  nickname,
  durationMinutes,
  selectedDomain,
  workoutSource,
  selectedTemplate,
  selectedCoachWorkout,
  scheduleMode,
  rallyDay,
  rallyTime,
  capReached,
  error,
  errorAction = null,
  unsignedHint = null,
  chainBuilder = null,
  hideSelectedWorkoutPreview = false,
  loading,
  onNicknameChange,
  onDurationChange,
  onCapChange,
  onScheduleModeChange,
  onRallyDayChange,
  onRallyTimeChange,
  onSubmit,
}: CreateMissionSummaryPanelProps) {
  // A coach WOD carries its own clock and may sit outside every domain range,
  // so it stays locked. A library workout no longer does: its minute is the
  // default, not a cage.
  const durationLockedByCoachWorkout = workoutSource === 'coach' && selectedCoachWorkout !== null;
  const templateSelected = workoutSource === 'library' && selectedTemplate !== null;
  const showSingleTemplatePreview =
    workoutSource === 'library' && selectedTemplate !== null && !hideSelectedWorkoutPreview;
  const submitDisabled = loading || capReached;
  const submitLabel = loading
    ? 'Creating…'
    : scheduleMode === 'rally'
      ? 'Schedule rally point'
      : 'Launch';

  return (
    <form id="create-mission-form" className="card space-y-4 p-6" onSubmit={onSubmit}>
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

      {chainBuilder}

      {durationLockedByCoachWorkout ? (
        <SummaryField label="Duration">
          <p className="text-sm font-semibold text-accent">
            {durationMinutes} min — set by selected workout
          </p>
        </SummaryField>
      ) : hideSelectedWorkoutPreview ? null : (
        <div className="space-y-3">
          {templateSelected ? null : (
            <SummaryField label="Time domain">
              <select
                className="input-field"
                value={selectedDomain}
                onChange={(event) => onDurationChange(Number(event.target.value))}
              >
                {TIME_DOMAINS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} min
                  </option>
                ))}
              </select>
            </SummaryField>
          )}
          <TimeCapControl
            key={selectedDomain}
            domain={selectedDomain}
            cap={durationMinutes}
            onCapChange={onCapChange}
            templateCap={templateSelected ? (selectedTemplate?.durationMinutes ?? null) : null}
            templateName={templateSelected ? (selectedTemplate?.name ?? null) : null}
          />
        </div>
      )}

      {showSingleTemplatePreview ? (
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

      {unsignedHint ? <p className="text-sm text-secondary">{unsignedHint}</p> : null}

      {capReached ? (
        <p className="alert-error text-sm">
          You already have {HOST_ACTIVE_MISSION_LIMIT} active missions.
        </p>
      ) : null}

      {error ? (
        <div className="space-y-2">
          <p className="text-error">Error: {error}</p>
          {errorAction ? (
            <p className="text-sm">
              <Link className="link-accent" to={errorAction.to}>
                {errorAction.label}
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      <button type="submit" className="btn-primary w-full" disabled={submitDisabled}>
        {submitLabel}
      </button>
    </form>
  );
}
