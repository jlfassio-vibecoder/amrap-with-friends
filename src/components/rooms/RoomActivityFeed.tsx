import { useEffect, useState } from 'react';
import { listRoomActivity, setRoomActivityVisible } from '@/lib/api/rooms';
import { getStoredParticipantId } from '@/lib/missionIdentity';
import {
  NAMING_PROMPT,
  feedLines,
  shouldOfferNaming,
  type RoomFeedRow,
} from '@/lib/rooms/roomFeed';

/**
 * "Why come back" — the third question the room page answers, at athlete level.
 *
 * Every finish appears. A member who has not opted out is named; a guest and a
 * member who opted out are the same unnamed row, because anything that told
 * those apart would leak the choice the opt-out exists to honour. See
 * docs/plans/coach-rooms-decisions.md §4.
 *
 * The one thing resolved in the browser is which row belongs to the person
 * looking: their own device remembers the participant id for missions it ran,
 * so a guest can be shown "You" without the server learning who is reading.
 */
export function RoomActivityFeed({
  roomId,
  signedIn,
  isMember,
  activityVisible,
  workoutName,
  onSignUp,
}: {
  roomId: string;
  signedIn: boolean;
  isMember: boolean;
  /** The viewer's own setting, when they are a member. */
  activityVisible: boolean | null;
  workoutName: (templateId: string | null) => string | undefined;
  onSignUp: () => void;
}) {
  const [rows, setRows] = useState<RoomFeedRow[] | null>(null);
  const [visible, setVisible] = useState(activityVisible !== false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listRoomActivity(roomId).then((result) => {
      if (!cancelled) {
        // A failed read is not an empty room. Rendering nothing is the same
        // outcome here, and it never claims the room has done nothing.
        setRows(result.ok ? result.rows : null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  if (rows === null || rows.length === 0) {
    // An empty list is worse than no section: it tells a visitor the room has
    // never run anything, which is true of every room on its first day.
    return null;
  }

  const lines = feedLines(rows, getStoredParticipantId);

  async function toggle(next: boolean) {
    setSaving(true);
    // Optimistic: the switch is the athlete's own and should move under their
    // finger. Put back if the write refuses.
    setVisible(next);
    const result = await setRoomActivityVisible(roomId, next);
    setSaving(false);
    if (!result.ok) {
      setVisible(!next);
    }
  }

  return (
    <section className="card mt-4 space-y-2 p-4 text-sm">
      <h2 className="eyebrow text-secondary">Recently in this room</h2>
      <ul className="flex flex-col gap-1">
        {lines.map((line) => (
          <li
            key={`${line.row.participantId}:${line.row.missionId}`}
            className={line.isMine ? 'font-semibold text-ink' : 'text-secondary'}
          >
            {line.who} — {line.what}
            {workoutName(line.row.templateId) ? ` · ${workoutName(line.row.templateId)}` : null}
            {/* The coach saying "I saw that", finally shown to the person they
                said it about. Until now the reaction was visible only on the
                dashboard, which is to say only to the coach. */}
            {line.row.reactionCount > 0 ? (
              <span className="ml-2 text-xs text-accent">★ {line.row.reactionCount}</span>
            ) : null}
          </li>
        ))}
      </ul>

      {shouldOfferNaming(lines, signedIn) ? (
        <p className="text-xs text-secondary">
          {NAMING_PROMPT}{' '}
          <button type="button" className="link-accent" onClick={onSignUp}>
            Create an account
          </button>
        </p>
      ) : null}

      {isMember ? (
        <label className="flex items-center gap-2 pt-1 text-xs text-secondary">
          <input
            type="checkbox"
            checked={visible}
            disabled={saving}
            onChange={(event) => void toggle(event.target.checked)}
          />
          Show my name here
        </label>
      ) : null}
    </section>
  );
}
