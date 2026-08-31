import { useEffect, useState } from 'react';
import { assignWorkout } from '@/lib/api/assignedWorkouts';
import { fetchMySquad, type SquadAthlete } from '@/lib/api/squad';
import type { WorkoutExercise } from '@/lib/api/sessionTypes';

interface SendWorkoutToSquadProps {
  durationMinutes: number;
  workout: WorkoutExercise[];
  templateId?: string | null;
  intensityTier?: number | null;
  /** False while the form has no usable workout yet. */
  ready: boolean;
}

/**
 * Puts the workout the host has configured on a squad friend's My sessions
 * page instead of running it now. Reach is enforced in Postgres against
 * squad_friends; this only offers the people it will accept.
 */
export function SendWorkoutToSquad({
  durationMinutes,
  workout,
  templateId,
  intensityTier,
  ready,
}: SendWorkoutToSquadProps) {
  const [friends, setFriends] = useState<SquadAthlete[]>([]);
  const [open, setOpen] = useState(false);
  const [toUserId, setToUserId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (!open || friends.length > 0) {
      return;
    }
    let cancelled = false;
    void fetchMySquad().then((result) => {
      if (!cancelled && result.data) {
        setFriends(result.data.friends);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, friends.length]);

  async function handleSend() {
    if (!toUserId) {
      setError('Pick someone from your squad to send it to.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await assignWorkout({
      toUserId,
      durationMinutes,
      workout,
      templateId,
      intensityTier,
      note,
    });
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    const name = friends.find((friend) => friend.userId === toUserId);
    setSentTo(name?.nickname ?? name?.username ?? 'your squad friend');
    setToUserId('');
    setNote('');
    setOpen(false);
  }

  if (sentTo) {
    return (
      <p className="text-sm text-secondary">
        Sent to {sentTo}. It is on their My sessions page now.{' '}
        <button
          type="button"
          className="link-accent"
          onClick={() => {
            setSentTo(null);
            setOpen(true);
          }}
        >
          Send another
        </button>
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className="text-sm font-semibold text-accent disabled:text-muted"
        disabled={!ready}
        onClick={() => setOpen(true)}
      >
        Send this to a squad friend
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-card bg-surface-muted p-4">
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-ink">Send to</span>
        <select
          className="input-field"
          value={toUserId}
          onChange={(event) => setToUserId(event.target.value)}
        >
          <option value="">Pick a squad friend…</option>
          {friends.map((friend) => (
            <option key={friend.userId} value={friend.userId}>
              {friend.nickname ?? friend.username ?? 'Athlete'}
            </option>
          ))}
        </select>
      </label>

      {friends.length === 0 ? (
        <p className="text-xs text-muted">
          Your squad is empty. Add someone on the Squad page first.
        </p>
      ) : null}

      <label className="block space-y-1">
        <span className="text-sm font-semibold text-ink">
          A note <span className="font-normal text-muted">(optional)</span>
        </span>
        <input
          className="input-field"
          value={note}
          maxLength={200}
          placeholder="Why this one?"
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      {error ? <p className="alert-error">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={busy || friends.length === 0}
          onClick={() => void handleSend()}
        >
          {busy ? 'Sending…' : 'Send it'}
        </button>
        <button type="button" className="btn-outline text-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
