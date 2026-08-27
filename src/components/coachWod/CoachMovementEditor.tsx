import { useMemo, useState } from 'react';
import { CoachExerciseInfoModal } from '@/components/coachWod/CoachExerciseInfoModal';
import type { CoachExercise, CoachWorkoutMovement } from '@/lib/api/coachWod';
import { EXERCISE_LIBRARY } from '@/data/exerciseLibrary';

const NO_EXERCISE_VALUE = '';
const MOVEMENT_NAME_DATALIST_ID = 'coach-movement-name-options';

function blankMovement(): CoachWorkoutMovement {
  return { name: '' };
}

function newRowKey(): string {
  return crypto.randomUUID();
}

function LinkedExerciseInfo({ exercise }: { exercise: CoachExercise }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="col-span-2 sm:col-span-5">
      <button
        type="button"
        className="text-xs uppercase tracking-wide text-accent hover:underline"
        onClick={() => setOpen(true)}
      >
        How to
      </button>
      {open ? <CoachExerciseInfoModal exercise={exercise} onClose={() => setOpen(false)} /> : null}
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

  const nameOptions = useMemo(() => {
    const names = new Set<string>();
    for (const exercise of exercises) {
      names.add(exercise.name);
    }
    for (const info of EXERCISE_LIBRARY) {
      names.add(info.name);
    }
    return Array.from(names).sort();
  }, [exercises]);

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

  function moveMovement(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= movements.length) {
      return;
    }
    setRowKeys((keys) => {
      const next = keys.slice();
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    const next = movements.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
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

      <datalist id={MOVEMENT_NAME_DATALIST_ID}>
        {nameOptions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>

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
              list={MOVEMENT_NAME_DATALIST_ID}
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
              <div className="col-span-2 flex items-center gap-3 sm:col-span-5 sm:justify-end">
                <button
                  type="button"
                  className="text-xs uppercase tracking-wide text-secondary hover:text-ink hover:underline disabled:opacity-40"
                  disabled={index === 0}
                  onClick={() => moveMovement(index, -1)}
                >
                  Move up
                </button>
                <button
                  type="button"
                  className="text-xs uppercase tracking-wide text-secondary hover:text-ink hover:underline disabled:opacity-40"
                  disabled={index === movements.length - 1}
                  onClick={() => moveMovement(index, 1)}
                >
                  Move down
                </button>
                <button
                  type="button"
                  className="text-xs uppercase tracking-wide text-error hover:underline"
                  onClick={() => removeMovement(index)}
                >
                  Remove movement
                </button>
              </div>
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
