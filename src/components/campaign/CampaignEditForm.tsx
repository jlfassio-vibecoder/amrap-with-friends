import { useState, type FormEvent } from 'react';

interface CampaignEditFormProps {
  name: string;
  goal: string;
  /** Resolves to an error message, or null when the save went through. */
  onSave: (input: { name: string; goal: string }) => Promise<string | null>;
  onCancel: () => void;
}

/**
 * Renames a campaign and rewrites its goal. Deliberately not a workout editor:
 * the benchmark is what every result is measured against, so it is not the
 * host's to swap once the crew has started training toward it.
 */
export function CampaignEditForm({ name, goal, onSave, onCancel }: CampaignEditFormProps) {
  const [draftName, setDraftName] = useState(name);
  const [draftGoal, setDraftGoal] = useState(goal);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const message = await onSave({ name: draftName, goal: draftGoal });
    setSaving(false);
    setError(message);
  }

  return (
    <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-ink">Campaign name</span>
        <input
          className="input-field"
          value={draftName}
          maxLength={80}
          required
          autoFocus
          onChange={(event) => setDraftName(event.target.value)}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-semibold text-ink">
          The goal <span className="font-normal text-muted">(optional)</span>
        </span>
        <textarea
          className="input-field min-h-20"
          value={draftGoal}
          maxLength={280}
          placeholder="What does the crew want to be able to do at the end?"
          onChange={(event) => setDraftGoal(event.target.value)}
        />
      </label>

      {error ? <p className="alert-error">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" className="btn-outline" disabled={saving} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
