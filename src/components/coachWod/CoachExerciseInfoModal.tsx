import { useEffect, useId } from 'react';
import type { CoachExercisePhoto } from '@/lib/api/coachWod';
import { getCoachExerciseMediaUrl } from '@/lib/media/coachExerciseMedia';
import { getPhotoGridColumnCount } from '@/components/exerciseInfo/getPhotoGridColumnCount';

export interface CoachExerciseInfoModalContent {
  name: string;
  photos: CoachExercisePhoto[];
  instructions: string[];
  cues: string[];
  tips: string | null;
}

interface CoachExerciseInfoModalProps {
  exercise: CoachExerciseInfoModalContent;
  onClose: () => void;
}

/** Same layout as ExerciseInfoModal, mapped onto coach exercise fields
 * (instructions → setup, cues → coaching cue, tips → AMRAP tip, photos). */
export function CoachExerciseInfoModal({ exercise, onClose }: CoachExerciseInfoModalProps) {
  const titleId = useId();
  const photoColumns = getPhotoGridColumnCount(exercise.photos.length);
  const coachingCue = exercise.cues.length > 0 ? exercise.cues.join(' ') : null;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="card max-h-[90vh] w-full max-w-lg space-y-5 overflow-y-auto p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-display text-2xl text-ink">
            {exercise.name}
          </h2>
          <button
            type="button"
            className="text-sm text-secondary hover:text-ink"
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <section className="space-y-3">
          {exercise.photos.length === 0 ? (
            <p className="rounded-card border border-border bg-page p-4 text-sm text-secondary">
              No photos yet
            </p>
          ) : (
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${photoColumns}, minmax(0, 1fr))`,
              }}
              data-testid="coach-exercise-photo-grid"
              data-columns={photoColumns}
            >
              {exercise.photos.map((photo, index) => (
                <figure key={`${photo.path}-${index}`} className="space-y-1">
                  <img
                    src={getCoachExerciseMediaUrl(photo.path)}
                    alt={photo.caption || exercise.name}
                    className="h-auto w-full rounded-card border border-border object-contain"
                  />
                  {photo.caption ? (
                    <figcaption className="text-center text-xs text-secondary">
                      {photo.caption}
                    </figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
          )}
        </section>

        {exercise.instructions.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-ink">Setup &amp; execution</h3>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
              {exercise.instructions.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
        ) : null}

        {coachingCue ? (
          <section className="rounded-card border border-[color:color-mix(in_srgb,var(--color-accent)_35%,transparent)] bg-accent-tint p-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-accent">
              Coaching cue
            </h3>
            <p className="mt-1 text-sm italic text-ink">{coachingCue}</p>
          </section>
        ) : null}

        {exercise.tips ? (
          <section className="rounded-card border border-border bg-page p-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-secondary">
              AMRAP tip
            </h3>
            <p className="mt-1 text-sm text-ink">{exercise.tips}</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
