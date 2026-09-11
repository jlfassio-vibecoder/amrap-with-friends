import { useEffect, useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { listRoomWorkouts } from '@/lib/api/rooms';
import {
  launchHref,
  shouldShowCollection,
  workoutFinishersLine,
  workoutLine,
  type RoomWorkout,
} from '@/lib/rooms/roomWorkouts';

/**
 * The coach's workouts, each one launchable on the athlete's own clock.
 *
 * Derived from what the room has actually run, not from a curated list — a
 * room cannot advertise a workout it has never used, and nothing here can go
 * stale against a schedule nobody updated. The curated version, with a weekly
 * window and standings, is Phase 3 and this does not pre-empt it.
 *
 * Launching goes through the existing `/create` flow rather than creating a
 * mission here. That flow already handles the name, the countdown and the
 * guest case, and it is the one an athlete without an account can use — which
 * is the point.
 */
export function RoomWorkoutCollection({
  roomId,
  workoutName,
}: {
  roomId: string;
  workoutName: (templateId: string | null) => string | undefined;
}) {
  const [workouts, setWorkouts] = useState<RoomWorkout[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listRoomWorkouts(roomId).then((result) => {
      if (!cancelled) {
        // A failed read renders nothing, the same as an empty room. It never
        // claims the coach has no workouts.
        setWorkouts(result.ok ? result.workouts : []);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  if (!shouldShowCollection(workouts)) {
    return null;
  }

  return (
    <section className="card mt-4 space-y-2 p-4 text-sm">
      <h2 className="eyebrow text-secondary">Workouts from this room</h2>
      <p className="text-secondary">Train one on your own clock, whenever you like.</p>
      <ul className="flex flex-col gap-2">
        {workouts.map((entry) => {
          const href = launchHref(entry);
          const finishers = workoutFinishersLine(entry);
          return (
            <li key={entry.workoutKey} className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate">
                  {workoutLine(entry, workoutName(entry.templateId))}
                </span>
                <span className="block text-xs text-secondary">
                  {entry.durationMinutes} min
                  {finishers ? ` · ${finishers}` : null}
                </span>
              </span>
              {href ? (
                <AppLink className="btn-outline shrink-0 text-xs" to={href}>
                  Do this
                </AppLink>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
