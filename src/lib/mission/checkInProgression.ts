import type { MissionCheckIns } from '@/lib/mission/missionCheckIn';
import type { MovementVariantSelection } from '@/lib/mission/exerciseScaling';
import { versionKeyFor } from '@/lib/mission/movementVersion';

/**
 * RPE trends for the same workout at the same clock.
 *
 * The series is deliberately NOT split by how the movements were performed, the
 * way score progression is. RPE is normalised to the athlete already — "very
 * hard" means very hard whether the push-ups were on the knees or not — and
 * splitting would break the trend for exactly the people who progress out of a
 * modification, which is the outcome this whole feature exists to produce.
 *
 * The number is comparable across versions. The *inference* is not: an athlete
 * who moved from knee push-ups to full ones and went 6 → 8 did not get less
 * fit, they made the workout harder. So a series spanning more than one version
 * says so and leaves the athlete to draw the conclusion, which is the same call
 * decision 3 of the plan doc made about benchmark ↔ retest, for the same reason
 * — any correction factor would be invented.
 */

export interface CheckInProgressionInput {
  missionId: string;
  templateId: string | null;
  durationMinutes: number;
  createdAt: string;
  scheduledAt: string | null;
  rpe: number | null;
  checkIns?: MissionCheckIns;
  /** Modification state, used only to notice when it changed mid-series. */
  modifiedMovements?: readonly string[];
  movementVariants?: MovementVariantSelection;
}

export interface CheckInProgressionPoint {
  missionId: string;
  at: string;
  rpe: number;
  /** '' when performed as programmed. */
  versionKey: string;
}

export interface CheckInProgressionGroup {
  templateId: string;
  durationMinutes: number;
  /** Oldest first. */
  points: CheckInProgressionPoint[];
  first: number;
  latest: number;
  delta: number;
  lastAt: string;
  /**
   * True when the points were not all performed the same way, so the trend
   * cannot be read as a fitness change on its own.
   */
  spansVersions: boolean;
}

function entryAt(entry: CheckInProgressionInput): string {
  return entry.scheduledAt ?? entry.createdAt;
}

export function buildCheckInProgression(
  entries: readonly CheckInProgressionInput[]
): CheckInProgressionGroup[] {
  const byGroup = new Map<string, CheckInProgressionInput[]>();

  for (const entry of entries) {
    if (entry.templateId === null || entry.rpe === null) {
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

  const groups: CheckInProgressionGroup[] = [];

  for (const bucket of byGroup.values()) {
    if (bucket.length < 2) {
      continue;
    }

    const points = bucket
      .map((entry) => ({
        missionId: entry.missionId,
        at: entryAt(entry),
        rpe: entry.rpe as number,
        versionKey: versionKeyFor({
          modifiedMovements: entry.modifiedMovements ?? [],
          movementVariants: entry.movementVariants ?? {},
        }),
      }))
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

    const first = points[0].rpe;
    const latest = points[points.length - 1].rpe;
    groups.push({
      templateId: bucket[0].templateId as string,
      durationMinutes: bucket[0].durationMinutes,
      points,
      first,
      latest,
      delta: latest - first,
      lastAt: points[points.length - 1].at,
      spansVersions: new Set(points.map((point) => point.versionKey)).size > 1,
    });
  }

  groups.sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt));
  return groups;
}

/** "RPE 6 → 7 → 8" */
export function formatCheckInRpeSeries(group: CheckInProgressionGroup): string {
  return `RPE ${group.points.map((point) => point.rpe).join(' → ')}`;
}

/**
 * The sentence that keeps a cross-version trend from reading as a verdict, or
 * null when every point was performed the same way.
 */
export function checkInVersionNote(group: CheckInProgressionGroup): string | null {
  if (!group.spansVersions) {
    return null;
  }
  return 'You did not perform these the same way each time, so this is not a like-for-like comparison.';
}

/** "+2" / "−1" / null for a single step. */
export function formatCheckInRpeDelta(group: CheckInProgressionGroup): string | null {
  if (group.points.length < 2) {
    return null;
  }
  if (group.delta === 0) {
    return '0';
  }
  return group.delta > 0 ? `+${group.delta}` : `${group.delta}`;
}
