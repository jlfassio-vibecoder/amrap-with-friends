import { useState } from 'react';
import type { CoachExercise, CoachWorkoutMovement } from '@/lib/api/coachWod';
import { getCoachExerciseMediaUrl } from '@/lib/media/coachExerciseMedia';

const NO_EXERCISE_VALUE = '';

function blankMovement(): CoachWorkoutMovement {
  return { name: '' };
}

function newRowKey(): string {
  return crypto.randomUUID();
}

function LinkedExerciseInfo({ exercise }: { exercise: CoachExercise }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="col-span-2 sm:col-span-5">
      <button
        type="button"
        className="text-xs uppercase tracking-wide text-accent hover:underline"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? 'Hide how-to' : 'How to'}
      </button>
      {expanded ? (
        <div className="mt-2 space-y-2 rounded-card border border-border bg-page p-3 text-sm">
          {exercise.imagePath ? (
            <img
              src={getCoachExerciseMediaUrl(exercise.imagePath)}
              alt={exercise.name}
              className="h-32 w-32 rounded-card border border-border object-cover"
            />
          ) : null}
          {exercise.instructions.length > 0 ? (
            <ol className="list-decimal space-y-1 pl-4 text-ink">
              {exercise.instructions.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          ) : null}
          {exercise.cues.length > 0 ? (
            <ul className="list-disc space-y-1 pl-4 text-secondary">
              {exercise.cues.map((cue, i) => (
                <li key={i}>{cue}</li>
              ))}
            </ul>
          ) : null}
          {exercise.tips ? <p className="text-xs italic text-secondary">{exercise.tips}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

interface CoachMovementEditorProps {
  movements: CoachWorkoutMovement[];
  exercises: CoachExercise[];
  onChange: (movements: CoachWorkoutMovement[]) => void;
  readOnly?: boolean;
}

export function CoachMovementEditor({
  movements,
  exercises,
  onChange,
  readOnly = false,
}: CoachMovementEditorProps) {
  const [rowKeys, setRowKeys] = useState(() => movements.map(() => newRowKey()));

  function updateMovement(index: number, patch: Partial<CoachWorkoutMovement>) {
    const next = movements.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  function removeMovement(index: number) {
    setRowKeys((keys) => keys.filter((_, i) => i !== index));
    onChange(movements.filter((_, i) => i !== index));
  }

  function addMovement() {
    setRowKeys((keys) => [...keys, newRowKey()]);
    onChange([...movements, blankMovement()]);
  }

  function findExercise(id: string | undefined): CoachExercise | null {
    if (!id) {
      return null;
    }
    return exercises.find((e) => e.id === id) ?? null;
  }

  function handleLinkChange(index: number, exerciseId: string) {
    if (exerciseId === NO_EXERCISE_VALUE) {
      const rest = { ...movements[index] };
      delete rest.coachExerciseId;
      const next = movements.slice();
      next[index] = rest;
      onChange(next);
      return;
    }

    const linked = exercises.find((e) => e.id === exerciseId);
    updateMovement(index, {
      coachExerciseId: exerciseId,
      name: movements[index].name.trim() ? movements[index].name : (linked?.name ?? ''),
    });
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
        Movements
      </span>

      {movements.map((movement, index) => {
        const linkedExercise = findExercise(movement.coachExerciseId);
        return (
          <div
            key={rowKeys[index] ?? `movement-${index}`}
            className="grid grid-cols-2 gap-2 rounded-card border border-border p-3 sm:grid-cols-5"
          >
            <input
              type="text"
              className="input-field col-span-2 text-sm sm:col-span-2"
              placeholder="Movement name"
              value={movement.name}
              disabled={readOnly}
              onChange={(event) => updateMovement(index, { name: event.target.value })}
            />
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              className="input-field text-sm tabular-nums"
              placeholder="Target"
              value={movement.target ?? ''}
              disabled={readOnly}
              onChange={(event) => {
                const value = event.target.value;
                if (value === '') {
                  updateMovement(index, { target: undefined });
                  return;
                }
                const parsed = Number(value);
                if (!Number.isInteger(parsed) || parsed < 1) {
                  return;
                }
                updateMovement(index, { target: parsed });
              }}
            />
            <input
              type="text"
              className="input-field text-sm"
              placeholder="Unit"
              value={movement.unit ?? ''}
              disabled={readOnly}
              onChange={(event) => updateMovement(index, { unit: event.target.value || undefined })}
            />
            <select
              className="input-field text-sm"
              value={movement.coachExerciseId ?? NO_EXERCISE_VALUE}
              disabled={readOnly}
              onChange={(event) => handleLinkChange(index, event.target.value)}
            >
              <option value={NO_EXERCISE_VALUE}>No linked exercise</option>
              {exercises.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                </option>
              ))}
            </select>
            {!readOnly ? (
              <button
                type="button"
                className="text-xs uppercase tracking-wide text-error hover:underline sm:justify-self-end"
                onClick={() => removeMovement(index)}
              >
                Remove movement
              </button>
            ) : null}
            {linkedExercise ? <LinkedExerciseInfo exercise={linkedExercise} /> : null}
          </div>
        );
      })}

      {!readOnly ? (
        <button type="button" className="btn-outline text-sm" onClick={addMovement}>
          Add movement
        </button>
      ) : null}
    </div>
  );
}
