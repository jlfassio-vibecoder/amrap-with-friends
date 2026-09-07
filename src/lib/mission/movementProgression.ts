import { formatModifiedBadge } from '@/lib/mission/modifiedMovements';
import { formatVariantBadge, type MovementVariantSelection } from '@/lib/mission/exerciseScaling';
import { versionKeyFor } from '@/lib/mission/movementVersion';

export { versionKeyFor } from '@/lib/mission/movementVersion';

/**
 * Reading stored modifications back as a story: "from the knees — 40, 45, 48
 * reps", and then the same workout done as programmed.
 *
 * The comparison is only honest inside one exact version of one workout, so a
 * series is keyed by the workout, the clock, *and* the full modification state.
 * Modifying the push-ups changes the score; so does modifying the squats
 * instead; so does the same workout at a different time cap. Pooling any of
 * those would produce a trend line the athlete cannot act on, which is worse
 * than showing nothing.
 *
 * Nothing here computes a correction between versions. A knee push-up score and
 * a standard one sit side by side and the athlete draws their own conclusion —
 * the same call the campaign benchmark/retest note makes, for the same reason:
 * any adjustment factor would be invented.
 */

/** The fields a progression needs; `MyMissionEntry` satisfies it. */
export interface ProgressionInput {
  missionId: string;
  templateId: string | null;
  durationMinutes: number;
  createdAt: string;
  scheduledAt: string | null;
  finalScore: number | null;
  modifiedMovements: string[];
  movementVariants: MovementVariantSelection;
}

export interface ProgressionPoint {
  missionId: string;
  /** ISO instant the mission is filed under, for ordering and display. */
  at: string;
  score: number;
}

export interface ProgressionSeries {
  /** Stable identity for the exact version performed; empty string means as programmed. */
  versionKey: string;
  /** "Diamond Push-ups: from the knees", or "As programmed". */
  label: string;
  modified: boolean;
  /** Oldest first, so the row reads left to right as it happened. */
  points: ProgressionPoint[];
  first: number;
  latest: number;
  /** latest − first; 0 for a single point. */
  delta: number;
}

export interface ProgressionGroup {
  /** Non-null: a workout with no template id has no stable identity to compare across. */
  templateId: string;
  durationMinutes: number;
  /** Most recent first. */
  series: ProgressionSeries[];
  /** The most recent point anywhere in the group, for ordering groups. */
  lastAt: string;
}

export const AS_PROGRAMMED_LABEL = 'As programmed';

function entryAt(entry: ProgressionInput): string {
  return entry.scheduledAt ?? entry.createdAt;
}

function labelFor(entry: ProgressionInput): string {
  if (versionKeyFor(entry) === '') {
    return AS_PROGRAMMED_LABEL;
  }
  return (
    formatVariantBadge(entry.movementVariants) ??
    formatModifiedBadge(entry.modifiedMovements) ??
    AS_PROGRAMMED_LABEL
  );
}

/**
 * Groups scored missions into per-version series.
 *
 * A group is only worth showing when there is something to compare: at least
 * two scored missions on that workout and clock, and at least one of them
 * modified. Repeat history with no modification in it is the ghost's job, not
 * this.
 */
export function buildMovementProgression(entries: readonly ProgressionInput[]): ProgressionGroup[] {
  const byGroup = new Map<string, ProgressionInput[]>();

  for (const entry of entries) {
    if (entry.templateId === null || entry.finalScore === null) {
      continue;
    }
    const key = `${entry.templateId}@${entry.durationMinutes}`;
    const bucket = byGroup.get(key);
    if (bucket) {
      bucket.push(entry);
    } else {
      byGroup.set(key, [entry]);
    }
  }

  const groups: ProgressionGroup[] = [];

  for (const bucket of byGroup.values()) {
    const anyModified = bucket.some((entry) => versionKeyFor(entry) !== '');
    if (bucket.length < 2 || !anyModified) {
      continue;
    }

    const bySeries = new Map<string, ProgressionInput[]>();
    for (const entry of bucket) {
      const key = versionKeyFor(entry);
      const existing = bySeries.get(key);
      if (existing) {
        existing.push(entry);
      } else {
        bySeries.set(key, [entry]);
      }
    }

    const series: ProgressionSeries[] = [];
    for (const [versionKey, members] of bySeries) {
      const points = members
        .map((entry) => ({
          missionId: entry.missionId,
          at: entryAt(entry),
          score: entry.finalScore as number,
        }))
        .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

      const first = points[0].score;
      const latest = points[points.length - 1].score;
      series.push({
        versionKey,
        label: labelFor(members[0]),
        modified: versionKey !== '',
        points,
        first,
        latest,
        delta: latest - first,
      });
    }

    series.sort((a, b) => {
      const aLast = Date.parse(a.points[a.points.length - 1].at);
      const bLast = Date.parse(b.points[b.points.length - 1].at);
      return bLast - aLast;
    });

    const first = bucket[0];
    groups.push({
      templateId: first.templateId as string,
      durationMinutes: first.durationMinutes,
      series,
      lastAt: series[0].points[series[0].points.length - 1].at,
    });
  }

  groups.sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt));
  return groups;
}

/** "40 → 45 → 48 reps", the line the whole feature exists to produce. */
export function formatProgressionScores(series: ProgressionSeries): string {
  return `${series.points.map((point) => point.score).join(' → ')} reps`;
}

/** "+8 reps" / "−3 reps" / null when there is only one attempt to report. */
export function formatProgressionDelta(series: ProgressionSeries): string | null {
  if (series.points.length < 2) {
    return null;
  }
  if (series.delta === 0) {
    return 'no change';
  }
  const sign = series.delta > 0 ? '+' : '−';
  return `${sign}${Math.abs(series.delta)} reps`;
}
