import {
  buildMovementProgression,
  formatProgressionDelta,
  formatProgressionScores,
  type ProgressionInput,
} from '@/lib/mission/movementProgression';
import { resolveWorkoutTitle } from '@/lib/workout/resolveWorkoutTitle';

interface ScalingProgressionPanelProps {
  entries: readonly ProgressionInput[];
}

/**
 * The payoff for naming a scaling: the same workout, the same clock, the same
 * version, in order.
 *
 * Versions sit side by side and are never merged into one trend — see
 * `movementProgression.ts` for why. Renders nothing until there is a comparison
 * to make, so it is invisible to anyone who has never scaled.
 */
export function ScalingProgressionPanel({ entries }: ScalingProgressionPanelProps) {
  const groups = buildMovementProgression(entries);

  if (groups.length === 0) {
    return null;
  }

  return (
    <section className="card space-y-3 p-4">
      <div className="space-y-1">
        <h2 className="text-display text-lg text-ink">Your scaling progress</h2>
        <p className="text-sm text-secondary">
          The same workout at the same clock, grouped by how you performed it. Versions are shown
          apart because their scores are not the same measurement.
        </p>
      </div>

      <ul className="space-y-3">
        {groups.map((group) => (
          <li key={`${group.templateId}@${group.durationMinutes}`} className="space-y-1.5">
            <p className="text-sm font-semibold text-ink">
              {resolveWorkoutTitle(group.templateId)} · {group.durationMinutes} min
            </p>
            <ul className="space-y-1">
              {group.series.map((series) => {
                const delta = formatProgressionDelta(series);
                return (
                  <li
                    key={series.versionKey}
                    className="flex flex-wrap items-baseline gap-x-2 text-sm"
                  >
                    <span className={series.modified ? 'text-secondary' : 'text-ink'}>
                      {series.label}
                    </span>
                    <span className="tabular-nums text-ink">{formatProgressionScores(series)}</span>
                    {delta ? <span className="text-xs text-muted">({delta})</span> : null}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
