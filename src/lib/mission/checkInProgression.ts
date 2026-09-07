import type { MissionCheckIns } from '@/lib/mission/missionCheckIn';

/**
 * RPE trends for the same workout at the same clock.
 *
 * Unlike modification progression, this ignores how movements were performed —
 * RPE is about how the effort felt. A group only renders when there are at least
 * two missions with an RPE on that template and duration.
 */

export interface CheckInProgressionInput {
  missionId: string;
  templateId: string | null;
  durationMinutes: number;
  createdAt: string;
  scheduledAt: string | null;
  rpe: number | null;
  checkIns?: MissionCheckIns;
}

export interface CheckInProgressionPoint {
  missionId: string;
  at: string;
  rpe: number;
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
    });
  }

  groups.sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt));
  return groups;
}

/** "RPE 6 → 7 → 8" */
export function formatCheckInRpeSeries(group: CheckInProgressionGroup): string {
  return `RPE ${group.points.map((point) => point.rpe).join(' → ')}`;
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
