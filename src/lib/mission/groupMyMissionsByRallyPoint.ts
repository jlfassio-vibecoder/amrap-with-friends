import type { MyMissionEntry } from '@/lib/api/myMissions';

export type MyMissionListItem =
  | { kind: 'single'; entry: MyMissionEntry }
  | {
      kind: 'group';
      rallyPointId: string;
      parent: MyMissionEntry;
      children: MyMissionEntry[];
    };

function displayTimeMs(entry: MyMissionEntry): number {
  return new Date(entry.scheduledAt ?? entry.createdAt).getTime();
}

/**
 * Collapse missions that share a rally_point_id into expandable groups.
 *
 * Parent is the most recent sibling (matches my_missions sort). Children are
 * the rest, oldest → newest. Singles (null id or only one row) stay flat.
 * Overall list order follows each item's display time so a group sits where
 * its newest mission would have appeared.
 */
export function groupMyMissionsByRallyPoint(entries: MyMissionEntry[]): MyMissionListItem[] {
  const buckets = new Map<string, MyMissionEntry[]>();
  const singles: MyMissionEntry[] = [];

  for (const entry of entries) {
    const rallyPointId = entry.rallyPointId;
    if (!rallyPointId) {
      singles.push(entry);
      continue;
    }
    const bucket = buckets.get(rallyPointId) ?? [];
    bucket.push(entry);
    buckets.set(rallyPointId, bucket);
  }

  const items: MyMissionListItem[] = [];

  for (const entry of singles) {
    items.push({ kind: 'single', entry });
  }

  for (const [rallyPointId, members] of buckets) {
    if (members.length < 2) {
      items.push({ kind: 'single', entry: members[0]! });
      continue;
    }

    const sortedNewestFirst = [...members].sort((a, b) => displayTimeMs(b) - displayTimeMs(a));
    const parent = sortedNewestFirst[0]!;
    const children = [...sortedNewestFirst.slice(1)].sort(
      (a, b) => displayTimeMs(a) - displayTimeMs(b)
    );

    items.push({ kind: 'group', rallyPointId, parent, children });
  }

  return items.sort((a, b) => {
    const aTime = displayTimeMs(a.kind === 'single' ? a.entry : a.parent);
    const bTime = displayTimeMs(b.kind === 'single' ? b.entry : b.parent);
    return bTime - aTime;
  });
}
