import { useEffect, useState, type FormEvent } from 'react';
import { CoachMovementEditor } from '@/components/coachWod/CoachMovementEditor';
import { CoachWorkoutHistory } from '@/components/coachWod/CoachWorkoutHistory';
import {
  cloneCoachWorkout,
  fetchCoachExercises,
  setCoachWorkoutStatus,
  upsertCoachWorkout,
  type CoachExercise,
  type CoachWorkout,
  type CoachWorkoutMovement,
} from '@/lib/api/coachWod';

const INTENSITY_OPTIONS: Array<{ tier: 1 | 2 | 3 | 4 | 5; label: string }> = [
  { tier: 1, label: 'Active Recovery' },
  { tier: 2, label: 'Foundational' },
  { tier: 3, label: 'Tactical' },
  { tier: 4, label: 'Crucible' },
  { tier: 5, label: 'Tier 1' },
];

const NOTES_MAX_LENGTH = 1000;
const FOCUS_MAX_LENGTH = 200;

function tagsToText(tags: string[]): string {
  return tags.join(', ');
}

function textToTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

interface CoachWorkoutFormProps {
  workout?: CoachWorkout | null;
  onSaved: (workout: CoachWorkout) => void;
  onCloned: (workout: CoachWorkout) => void;
  onStatusChanged?: (workout: CoachWorkout) => void;
  onCancel: () => void;
}

export function CoachWorkoutForm({
  workout,
  onSaved,
  onCloned,
  onStatusChanged,
  onCancel,
}: CoachWorkoutFormProps) {
  const isOwner = workout?.isOwner ?? true;
  const isLocked = (workout?.isLocked ?? false) || !isOwner;
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [status, setStatus] = useState(workout?.status ?? 'draft');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [name, setName] = useState(workout?.name ?? '');
  const [focus, setFocus] = useState(workout?.focus ?? '');
  const [durationMinutes, setDurationMinutes] = useState(String(workout?.durationMinutes ?? 15));
  const [intensityTier, setIntensityTier] = useState<1 | 2 | 3 | 4 | 5>(
    (workout?.intensityTier as 1 | 2 | 3 | 4 | 5) ?? 3
  );
  const [movements, setMovements] = useState<CoachWorkoutMovement[]>(
    workout?.movements ?? [{ name: '' }]
  );
  const [tagsText, setTagsText] = useState(tagsToText(workout?.tags ?? []));
  const [notes, setNotes] = useState(workout?.notes ?? '');
  const [isShared, setIsShared] = useState(workout?.isShared ?? false);
  const [exercises, setExercises] = useState<CoachExercise[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCoachExercises().then((result) => {
      if (!cancelled && !result.error) {
        setExercises(result.data ?? []);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }

    const duration = Number(durationMinutes);
    if (!Number.isInteger(duration) || duration < 1 || duration > 90) {
      setError('Duration must be between 1 and 90 minutes.');
      return;
    }

    const cleanedMovements = movements
      .map((m) => ({ ...m, name: m.name.trim() }))
      .filter((m) => m.name.length > 0);

    if (cleanedMovements.length === 0) {
      setError('Add at least one movement.');
      return;
    }

    setSubmitting(true);

    const result = await upsertCoachWorkout({
      id: workout?.id,
      name: trimmedName,
      focus: focus.trim() || null,
      durationMinutes: duration,
      intensityTier,
      movements: cleanedMovements,
      tags: textToTags(tagsText),
      notes: notes.trim() || null,
      isShared,
    });

    setSubmitting(false);

    if (result.error || !result.data) {
      setError(result.error?.message ?? 'Something went wrong. Please try again.');
      return;
    }

    onSaved(result.data);
  }

  async function handleClone() {
    if (!workout) {
      return;
    }
    setCloneError(null);
    setCloning(true);
    const result = await cloneCoachWorkout(workout.id);
    setCloning(false);

    if (result.error || !result.data) {
      setCloneError(result.error?.message ?? 'Something went wrong. Please try again.');
      return;
    }

    onCloned(result.data);
  }

  async function handleTogglePublish() {
    if (!workout) {
      return;
    }
    setPublishError(null);
    setPublishing(true);
    const nextStatus = status === 'published' ? 'draft' : 'published';
    const result = await setCoachWorkoutStatus(workout.id, nextStatus);
    setPublishing(false);

    if (result.error || !result.data) {
      setPublishError(result.error?.message ?? 'Something went wrong. Please try again.');
      return;
    }

    setStatus(result.data.status);
    onStatusChanged?.(result.data);
  }

  return (
    <div className="space-y-4">
      <form className="card space-y-4 p-4" onSubmit={handleSubmit}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary">
            {workout ? 'Edit workout' : 'New workout'}
          </h3>
          {workout ? (
            <div className="flex items-center gap-2">
              <span
                className={
                  status === 'published'
                    ? 'rounded-card bg-success-tint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success-text'
                    : 'rounded-card border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary'
                }
              >
                {status === 'published' ? 'Published' : 'Draft'}
              </span>
              {isOwner ? (
                <button
                  type="button"
                  className="btn-outline text-xs"
                  onClick={handleTogglePublish}
                  disabled={publishing}
                >
                  {publishing ? 'Saving…' : status === 'published' ? 'Unpublish' : 'Publish'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {publishError ? <p className="text-error text-sm">{publishError}</p> : null}
        {status === 'published' ? (
          <p className="text-xs text-secondary">
            Visible to every signed-in user in Create Mission → Coach WODs.
          </p>
        ) : null}

        {isLocked ? (
          <div className="bg-accent-tint/60 space-y-2 rounded-card border border-border p-3 text-sm">
            <p className="text-ink">
              {!isOwner
                ? 'This workout was shared by another coach — you can view and clone it, but only its owner can edit it.'
                : 'This workout is locked — it has a completed mission, so its history stays comparable. Clone it to make changes.'}
            </p>
            {cloneError ? <p className="text-error text-sm">{cloneError}</p> : null}
            <button
              type="button"
              className="btn-primary text-sm"
              onClick={handleClone}
              disabled={cloning}
            >
              {cloning ? 'Cloning…' : 'Clone to edit'}
            </button>
          </div>
        ) : null}

        <fieldset disabled={isLocked} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
                Name
              </span>
              <input
                type="text"
                className="input-field"
                value={name}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Crimp Conditioning"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
                Focus (optional)
              </span>
              <input
                type="text"
                className="input-field"
                value={focus ?? ''}
                maxLength={FOCUS_MAX_LENGTH}
                onChange={(event) => setFocus(event.target.value)}
                placeholder="Grip endurance for climbers"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
              Duration (minutes)
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={90}
              className="input-field w-32 tabular-nums"
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value)}
            />
          </label>

          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
              Intensity
            </span>
            <div className="grid grid-cols-5 gap-2" role="group" aria-label="Intensity">
              {INTENSITY_OPTIONS.map((option) => {
                const selected = intensityTier === option.tier;
                return (
                  <button
                    key={option.tier}
                    type="button"
                    aria-pressed={selected}
                    className={
                      selected
                        ? 'rounded-card bg-accent px-2 py-2 text-center text-xs font-bold uppercase tracking-wide text-on-accent'
                        : 'hover:border-accent/40 rounded-card border border-border px-2 py-2 text-center text-xs font-bold uppercase tracking-wide text-ink'
                    }
                    onClick={() => setIntensityTier(option.tier)}
                  >
                    {option.tier}
                    <span className="block text-[10px] font-medium normal-case tracking-normal">
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <CoachMovementEditor
            movements={movements}
            exercises={exercises}
            onChange={setMovements}
            readOnly={isLocked}
          />

          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
              Tags (comma separated — functional purpose, e.g. rock climbing, cycling)
            </span>
            <input
              type="text"
              className="input-field"
              value={tagsText}
              onChange={(event) => setTagsText(event.target.value)}
              placeholder="rock climbing, grip"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
              Coaching notes (optional)
            </span>
            <textarea
              className="input-field min-h-20"
              value={notes ?? ''}
              maxLength={NOTES_MAX_LENGTH}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Scale hang time to ability."
            />
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isShared}
              onChange={(event) => setIsShared(event.target.checked)}
            />
            <span className="text-sm text-ink">Share with other coaches</span>
          </label>
        </fieldset>

        {error ? <p className="text-error text-sm">{error}</p> : null}

        <div className="flex gap-2">
          {!isLocked ? (
            <button type="submit" className="btn-primary flex-1" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save workout'}
            </button>
          ) : null}
          <button
            type="button"
            className={isLocked ? 'btn-outline flex-1' : 'btn-outline'}
            onClick={onCancel}
            disabled={submitting}
          >
            {isLocked ? 'Back' : 'Cancel'}
          </button>
        </div>
      </form>
      {workout && isOwner ? <CoachWorkoutHistory key={workout.id} workoutId={workout.id} /> : null}
    </div>
  );
}
