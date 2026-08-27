import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { CoachExercise, CoachExercisePhoto } from '@/lib/api/coachWod';
import { upsertCoachExercise } from '@/lib/api/coachWod';
import {
  getCoachExerciseMediaUrl,
  uploadCoachExercisePhoto,
} from '@/lib/media/coachExerciseMedia';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';

const TIPS_MAX_LENGTH = 280;
const MAX_PHOTOS = 6;

function linesToList(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

type PendingPhoto = { key: string; file: File; caption: string };
type ExistingPhoto = { key: string; path: string; caption: string };

interface CoachExerciseFormProps {
  exercise?: CoachExercise | null;
  onSaved: (exercise: CoachExercise) => void;
  onCancel: () => void;
}

export function CoachExerciseForm({ exercise, onSaved, onCancel }: CoachExerciseFormProps) {
  const { user } = useAmrapAuth();
  const [name, setName] = useState(exercise?.name ?? '');
  const [instructions, setInstructions] = useState(exercise?.instructions.join('\n') ?? '');
  const [cues, setCues] = useState(exercise?.cues.join('\n') ?? '');
  const [tips, setTips] = useState(exercise?.tips ?? '');
  const [isShared, setIsShared] = useState(exercise?.isShared ?? false);
  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>(() =>
    (exercise?.photos ?? []).map((photo, index) => ({
      key: `existing-${index}`,
      path: photo.path,
      caption: photo.caption ?? '',
    }))
  );
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingPreviewUrls = useMemo(
    () => new Map(pendingPhotos.map((p) => [p.key, URL.createObjectURL(p.file)])),
    [pendingPhotos]
  );

  useEffect(() => {
    return () => {
      for (const url of pendingPreviewUrls.values()) {
        URL.revokeObjectURL(url);
      }
    };
  }, [pendingPreviewUrls]);

  const totalPhotoCount = existingPhotos.length + pendingPhotos.length;

  function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }
    const remaining = MAX_PHOTOS - totalPhotoCount;
    const toAdd = Array.from(files).slice(0, Math.max(remaining, 0));
    setPendingPhotos((current) => [
      ...current,
      ...toAdd.map((file) => ({ key: crypto.randomUUID(), file, caption: '' })),
    ]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }

    setSubmitting(true);

    const keptPhotos: CoachExercisePhoto[] = existingPhotos.map((p) =>
      p.caption.trim() ? { path: p.path, caption: p.caption.trim() } : { path: p.path }
    );

    const firstSave = await upsertCoachExercise({
      id: exercise?.id,
      name: trimmedName,
      instructions: linesToList(instructions),
      cues: linesToList(cues),
      tips: tips.trim() || null,
      photos: keptPhotos,
      isShared,
    });

    if (firstSave.error || !firstSave.data) {
      setSubmitting(false);
      setError(firstSave.error?.message ?? 'Something went wrong. Please try again.');
      return;
    }

    let saved = firstSave.data;

    if (pendingPhotos.length > 0 && user) {
      const uploadedPhotos: CoachExercisePhoto[] = [];
      for (const pending of pendingPhotos) {
        const uploadResult = await uploadCoachExercisePhoto(
          user.id,
          saved.id,
          crypto.randomUUID(),
          pending.file
        );
        if (uploadResult.error || !uploadResult.path) {
          setSubmitting(false);
          setError(uploadResult.error ?? 'Something went wrong. Please try again.');
          return;
        }
        const path = uploadResult.path;
        uploadedPhotos.push(
          pending.caption.trim() ? { path, caption: pending.caption.trim() } : { path }
        );
      }

      const withPhotos = await upsertCoachExercise({
        id: saved.id,
        name: saved.name,
        instructions: saved.instructions,
        cues: saved.cues,
        tips: saved.tips,
        photos: [...saved.photos, ...uploadedPhotos],
        isShared: saved.isShared,
      });

      if (withPhotos.error || !withPhotos.data) {
        setSubmitting(false);
        setError(withPhotos.error?.message ?? 'Something went wrong. Please try again.');
        return;
      }

      saved = withPhotos.data;
    }

    setSubmitting(false);
    onSaved(saved);
  }

  return (
    <form className="card space-y-4 p-4" onSubmit={handleSubmit}>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary">
        {exercise ? 'Edit exercise' : 'New exercise'}
      </h3>

      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-secondary">Name</span>
        <input
          type="text"
          className="input-field"
          value={name}
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Toe Hook Traverse"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Instructions (one step per line)
        </span>
        <textarea
          className="input-field min-h-24"
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          placeholder={'Set up on the wall\nHook toe over the hold\nShift weight through the hip'}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Coaching cues (one per line)
        </span>
        <textarea
          className="input-field min-h-20"
          value={cues}
          onChange={(event) => setCues(event.target.value)}
          placeholder={'Keep hips close to the wall\nDrive through the heel'}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Tip (optional)
        </span>
        <input
          type="text"
          className="input-field"
          value={tips ?? ''}
          maxLength={TIPS_MAX_LENGTH}
          onChange={(event) => setTips(event.target.value)}
          placeholder="Great for grip endurance in AMRAP rounds."
        />
      </label>

      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Photos (optional, up to {MAX_PHOTOS})
        </span>

        {existingPhotos.length > 0 || pendingPhotos.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {existingPhotos.map((photo) => (
              <div key={photo.key} className="space-y-1">
                <img
                  src={getCoachExerciseMediaUrl(photo.path)}
                  alt=""
                  className="h-24 w-full rounded-card border border-border object-cover"
                />
                <input
                  type="text"
                  className="input-field text-xs"
                  value={photo.caption}
                  placeholder="Caption (optional)"
                  onChange={(event) =>
                    setExistingPhotos((current) =>
                      current.map((p) =>
                        p.key === photo.key ? { ...p, caption: event.target.value } : p
                      )
                    )
                  }
                />
                <button
                  type="button"
                  className="text-xs uppercase tracking-wide text-error hover:underline"
                  onClick={() =>
                    setExistingPhotos((current) => current.filter((p) => p.key !== photo.key))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            {pendingPhotos.map((photo) => (
              <div key={photo.key} className="space-y-1">
                <img
                  src={pendingPreviewUrls.get(photo.key)}
                  alt=""
                  className="h-24 w-full rounded-card border border-border object-cover"
                />
                <input
                  type="text"
                  className="input-field text-xs"
                  value={photo.caption}
                  placeholder="Caption (optional)"
                  onChange={(event) =>
                    setPendingPhotos((current) =>
                      current.map((p) =>
                        p.key === photo.key ? { ...p, caption: event.target.value } : p
                      )
                    )
                  }
                />
                <button
                  type="button"
                  className="text-xs uppercase tracking-wide text-error hover:underline"
                  onClick={() =>
                    setPendingPhotos((current) => current.filter((p) => p.key !== photo.key))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {totalPhotoCount < MAX_PHOTOS ? (
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="block text-sm text-secondary"
            onChange={(event) => {
              handleFilesSelected(event.target.files);
              event.target.value = '';
            }}
          />
        ) : (
          <p className="text-xs text-secondary">Maximum of {MAX_PHOTOS} photos reached.</p>
        )}
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isShared}
          onChange={(event) => setIsShared(event.target.checked)}
        />
        <span className="text-sm text-ink">Share with other coaches</span>
      </label>

      {error ? <p className="text-error text-sm">{error}</p> : null}

      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save exercise'}
        </button>
        <button type="button" className="btn-outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}
