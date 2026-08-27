import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { CoachExercise } from '@/lib/api/coachWod';
import { upsertCoachExercise } from '@/lib/api/coachWod';
import {
  getCoachExerciseMediaUrl,
  uploadCoachExerciseImage,
} from '@/lib/media/coachExerciseMedia';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';

const TIPS_MAX_LENGTH = 280;

function linesToList(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(exercise?.imagePath ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blobPreviewUrl = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : null),
    [imageFile]
  );

  useEffect(() => {
    if (!blobPreviewUrl) {
      return;
    }
    return () => {
      URL.revokeObjectURL(blobPreviewUrl);
    };
  }, [blobPreviewUrl]);

  const previewUrl = blobPreviewUrl
    ? blobPreviewUrl
    : imagePath
      ? getCoachExerciseMediaUrl(imagePath)
      : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }

    setSubmitting(true);

    const result = await upsertCoachExercise({
      id: exercise?.id,
      name: trimmedName,
      instructions: linesToList(instructions),
      cues: linesToList(cues),
      tips: tips.trim() || null,
      imagePath,
    });

    if (result.error || !result.data) {
      setSubmitting(false);
      setError(result.error?.message ?? 'Something went wrong. Please try again.');
      return;
    }

    let saved = result.data;

    if (imageFile && user) {
      const uploadResult = await uploadCoachExerciseImage(user.id, saved.id, imageFile);
      if (uploadResult.error) {
        setSubmitting(false);
        setError(uploadResult.error);
        return;
      }

      const withImage = await upsertCoachExercise({
        id: saved.id,
        name: saved.name,
        instructions: saved.instructions,
        cues: saved.cues,
        tips: saved.tips,
        imagePath: uploadResult.path,
      });

      if (withImage.error || !withImage.data) {
        setSubmitting(false);
        setError(withImage.error?.message ?? 'Something went wrong. Please try again.');
        return;
      }

      saved = withImage.data;
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

      <label className="block space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Image (optional)
        </span>
        {previewUrl ? (
          <div className="flex items-center gap-3">
            <img
              src={previewUrl}
              alt=""
              className="h-32 w-32 rounded-card border border-border object-cover"
            />
            <button
              type="button"
              className="text-xs uppercase tracking-wide text-error hover:underline"
              onClick={() => {
                setImageFile(null);
                setImagePath(null);
              }}
            >
              Remove image
            </button>
          </div>
        ) : null}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="block text-sm text-secondary"
          onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
        />
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
