import { useEffect, useState } from 'react';
import { getMissionRoom, joinRoom, type MissionRoom } from '@/lib/api/rooms';
import { postFinishSheet } from '@/lib/rooms/postFinish';

interface RoomFinishSheetProps {
  missionId: string;
  /** Whether the result can still be claimed. */
  canSave: boolean;
  isSaving: boolean;
  /** Resolves true only once the mission is actually on the account. */
  onSave: () => Promise<boolean>;
  /**
   * Where the join result goes. Not local state: a successful save flips the
   * claim status, the parent stops rendering this sheet, and any notice held
   * here would unmount before anyone read it.
   */
  onJoinResult: (message: string) => void;
}

/**
 * One sheet at the finish, one decision.
 *
 * Saving the result and joining the room are two records, and the athlete sees
 * one screen with one button and one checkbox. Three sequential prompts at the
 * finish would tank the claim rate, and the claim is what the primary metric
 * counts.
 *
 * Unticking the box never blocks saving: the checkbox is read at save time,
 * and the join is attempted after the save, so a failure to join cannot lose
 * the result.
 */
export function RoomFinishSheet({
  missionId,
  canSave,
  isSaving,
  onSave,
  onJoinResult,
}: RoomFinishSheetProps) {
  const [room, setRoom] = useState<MissionRoom | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [joinTicked, setJoinTicked] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const result = await getMissionRoom(missionId);
      if (cancelled) {
        return;
      }
      setRoom(result);
      setLoaded(true);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [missionId]);

  const sheet = postFinishSheet({
    room: room
      ? {
          handle: room.handle,
          displayName: room.displayName,
          isMember: room.isMember,
          hasHomeCoach: room.hasHomeCoach,
        }
      : null,
    canSave,
  });

  // Until the room is known, fall back to the plain save prompt rather than
  // flashing a checkbox in and out.
  if (!loaded || !sheet.show) {
    return canSave ? <SavePrompt isSaving={isSaving} onSave={onSave} note={null} /> : null;
  }

  async function saveThenJoin() {
    // Wait for the save to actually land. Starting the join alongside it could
    // create membership and attribution for a mission that was never saved --
    // and then say it had been.
    if (canSave) {
      const saved = await onSave();
      if (!saved) {
        return;
      }
    }

    if (!joinTicked || !room || room.isMember) {
      return;
    }

    const result = await joinRoom(room.id, true);
    if (!result.ok) {
      // The result is already saved; a failed join is worth saying, not worth
      // making it look like the save failed.
      onJoinResult(
        `Saved. We could not add you to ${room.displayName} — you can join from their room page.`
      );
      return;
    }
    onJoinResult(
      result.homeCoachAlreadySet
        ? `You joined ${room.displayName}. Your home coach is unchanged.`
        : `You joined ${room.displayName}.`
    );
  }

  return (
    <section className="card space-y-3 bg-accent-tint p-4 text-sm">
      <p className="font-semibold">Save your results</p>
      <p className="text-secondary">
        Sign up is optional, but saving links this mission to your account for My Missions.
      </p>

      {sheet.showJoin && room ? (
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-1"
            checked={joinTicked}
            onChange={(event) => setJoinTicked(event.target.checked)}
          />
          <span>
            <span className="font-semibold">Join {room.displayName}</span>
            <span className="block text-xs text-secondary">{sheet.joinNote}</span>
          </span>
        </label>
      ) : null}

      {sheet.showSave ? (
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={isSaving}
          onClick={() => void saveThenJoin()}
        >
          {isSaving ? 'Saving…' : 'Save this mission to my account'}
        </button>
      ) : sheet.showJoin && room ? (
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={!joinTicked}
          onClick={() => void saveThenJoin()}
        >
          Join {room.displayName}
        </button>
      ) : null}
    </section>
  );
}

function SavePrompt({
  isSaving,
  onSave,
  note,
}: {
  isSaving: boolean;
  onSave: () => void;
  note: string | null;
}) {
  return (
    <section className="card space-y-2 bg-accent-tint p-4 text-sm">
      <p className="font-semibold">Save your results</p>
      <p className="text-secondary">
        Sign up is optional, but saving links this mission to your account for My Missions.
      </p>
      {note ? <p className="text-secondary">{note}</p> : null}
      <button type="button" className="btn-primary text-sm" disabled={isSaving} onClick={onSave}>
        {isSaving ? 'Saving…' : 'Save this mission to my account'}
      </button>
    </section>
  );
}
