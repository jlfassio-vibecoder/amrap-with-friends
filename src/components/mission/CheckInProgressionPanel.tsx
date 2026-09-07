import {
  buildCheckInProgression,
  checkInVersionNote,
  formatCheckInRpeDelta,
  formatCheckInRpeSeries,
  type CheckInProgressionInput,
} from '@/lib/mission/checkInProgression';
import { resolveWorkoutTitle } from '@/lib/workout/resolveWorkoutTitle';

interface CheckInProgressionPanelProps {
  entries: readonly CheckInProgressionInput[];
}

/**
 * The payoff for logging RPE: the same workout at the same clock, in order.
 * Invisible until there is a comparison to make.
 */
export function CheckInProgressionPanel({ entries }: CheckInProgressionPanelProps) {
  const groups = buildCheckInProgression(entries);

  if (groups.length === 0) {
    return null;
  }

  return (
    <section className="card space-y-3 p-4">
      <div className="space-y-1">
        <h2 className="text-display text-lg text-ink">Your RPE progress</h2>
        <p className="text-sm text-secondary">
          The same workout at the same clock. How hard it felt, mission to mission.
        </p>
      </div>

      <ul className="space-y-3">
        {groups.map((group) => {
          const delta = formatCheckInRpeDelta(group);
          const versionNote = checkInVersionNote(group);
          return (
            <li key={`${group.templateId}@${group.durationMinutes}`} className="space-y-1">
              <p className="text-sm font-semibold text-ink">
                {resolveWorkoutTitle(group.templateId)} · {group.durationMinutes} min
              </p>
              <p className="text-sm tabular-nums text-ink">
                {formatCheckInRpeSeries(group)}
                {delta ? <span className="ml-2 text-xs text-muted">({delta})</span> : null}
              </p>
              {versionNote ? <p className="text-xs text-muted">{versionNote}</p> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
