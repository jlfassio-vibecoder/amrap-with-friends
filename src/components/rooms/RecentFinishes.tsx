import { useEffect, useState } from 'react';
import { listRoomFinishes, reactToFinish, type RoomFinish } from '@/lib/api/rooms';
import {
  finishLine,
  nextReaction,
  REACTION_LABELS,
  ROOM_REACTIONS,
  type RoomReaction,
} from '@/lib/rooms/reactions';

/**
 * Who finished, and the one tap that says the coach saw it.
 *
 * The plan gives v1 reactions and no chat, so there is nothing to reply to
 * here: one reaction per host per finish, tapping the same one again takes it
 * back. Hosts are excluded from the list — a coach reacting to their own
 * finish is not the loop this exists for.
 */
export function RecentFinishes({ roomId }: { roomId: string }) {
  const [finishes, setFinishes] = useState<RoomFinish[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const result = await listRoomFinishes(roomId);
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setFinishes(result.finishes);
        setStatus('ready');
      } else {
        setStatus('error');
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  async function react(finish: RoomFinish, tapped: RoomReaction) {
    const key = `${finish.participantId}:${finish.segmentIndex}`;
    const wanted = nextReaction(finish.myReaction, tapped);
    setBusy(key);
    const result = await reactToFinish(finish.participantId, finish.segmentIndex, wanted);
    setBusy(null);
    if (!result.ok) {
      return;
    }
    // Update in place rather than reloading: a reaction should feel like a tap,
    // not a page refresh.
    setFinishes((prev) =>
      (prev ?? []).map((row) =>
        row.participantId === finish.participantId && row.segmentIndex === finish.segmentIndex
          ? {
              ...row,
              myReaction: wanted,
              reactionCount:
                row.reactionCount + (wanted === null ? -1 : row.myReaction === null ? 1 : 0),
            }
          : row
      )
    );
  }

  if (status === 'loading') {
    return <p className="text-secondary">Loading…</p>;
  }

  if (status === 'error') {
    return (
      <p className="text-secondary">Couldn&rsquo;t load recent finishes. Refresh to try again.</p>
    );
  }

  if (!finishes || finishes.length === 0) {
    return <p className="text-secondary">Nobody has finished a mission in this room yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {finishes.map((finish) => {
        const key = `${finish.participantId}:${finish.segmentIndex}`;
        return (
          <li key={key} className="flex flex-col gap-1">
            <span>{finishLine(finish.nickname, finish.finalScore, finish.isGuest)}</span>
            <span className="flex flex-wrap items-center gap-1">
              {ROOM_REACTIONS.map((reaction) => (
                <button
                  key={reaction}
                  type="button"
                  aria-pressed={finish.myReaction === reaction}
                  disabled={busy === key}
                  className={
                    finish.myReaction === reaction
                      ? 'btn-primary px-2 py-1 text-xs'
                      : 'btn-outline px-2 py-1 text-xs'
                  }
                  onClick={() => void react(finish, reaction)}
                >
                  {REACTION_LABELS[reaction]}
                </button>
              ))}
              {finish.reactionCount > 0 ? (
                <span className="text-xs text-secondary">
                  {finish.reactionCount} {finish.reactionCount === 1 ? 'reaction' : 'reactions'}
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
