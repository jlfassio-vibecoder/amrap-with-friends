import type { MissionChainItem } from '@/lib/api/missionChain';
import type { MyMissionEntry } from '@/lib/api/myMissions';

export type MyMissionChainChild =
  | { kind: 'started'; position: number; entry: MyMissionEntry }
  | { kind: 'queued'; position: number; chainItem: MissionChainItem };

export type MyMissionListItem =
  | { kind: 'single'; entry: MyMissionEntry }
  | {
      kind: 'group';
      rallyPointId: string;
      parent: MyMissionEntry;
      /** Total slots when this is a planned chain; sibling-only groups use children.length + 1. */
      chainLength: number;
      children: MyMissionChainChild[];
    };

function displayTimeMs(entry: MyMissionEntry): number {
  return new Date(entry.scheduledAt ?? entry.createdAt).getTime();
}

function listItemSortTime(item: MyMissionListItem): number {
  return displayTimeMs(item.kind === 'single' ? item.entry : item.parent);
}

function markGroupConsumed(
  group: Extract<MyMissionListItem, { kind: 'group' }>,
  into: Set<string>
) {
  into.add(group.parent.missionId);
  for (const child of group.children) {
    if (child.kind === 'started') {
      into.add(child.entry.missionId);
    }
  }
}

function buildChainGroup(
  rallyPointId: string,
  members: MyMissionEntry[],
  chain: MissionChainItem[]
): Extract<MyMissionListItem, { kind: 'group' }> | null {
  if (chain.length < 2) {
    return null;
  }

  const byMissionId = new Map(members.map((entry) => [entry.missionId, entry]));
  const sorted = [...chain].sort((a, b) => a.position - b.position);
  const first = sorted[0]!;
  // Planned-chain UI only when position 0 is stamped to a mission the athlete
  // can see. Falling back to an unstamped hub row made "1 of N in this chain"
  // appear while advance still treated pos0 as unstarted and recreated workout 1.
  if (first.position !== 0 || !first.startedMissionId) {
    return null;
  }
  const parent = byMissionId.get(first.startedMissionId);
  if (!parent) {
    return null;
  }

  const children: MyMissionChainChild[] = sorted.slice(1).map((item) => {
    if (item.startedMissionId) {
      const entry = byMissionId.get(item.startedMissionId);
      if (entry) {
        return { kind: 'started', position: item.position, entry };
      }
    }
    return { kind: 'queued', position: item.position, chainItem: item };
  });

  return {
    kind: 'group',
    rallyPointId,
    parent,
    chainLength: chain.length,
    children,
  };
}

function buildSiblingGroup(
  rallyPointId: string,
  members: MyMissionEntry[]
): Extract<MyMissionListItem, { kind: 'group' }> {
  const sortedNewestFirst = [...members].sort((a, b) => displayTimeMs(b) - displayTimeMs(a));
  const parent = sortedNewestFirst[0]!;
  const older = [...sortedNewestFirst.slice(1)].sort((a, b) => displayTimeMs(a) - displayTimeMs(b));

  return {
    kind: 'group',
    rallyPointId,
    parent,
    chainLength: members.length,
    children: older.map((entry, index) => ({
      kind: 'started' as const,
      position: index + 1,
      entry,
    })),
  };
}

/**
 * Collapse hub missions into expandable groups.
 *
 * Planned chains (from get_mission_chain): parent is the stamped position-0
 * mission only; children follow chain order and may be queued slots with no
 * mission row yet. Unstamped position 0 does not form a planned group.
 * Daisy-chain siblings without a usable chain stamp: newest parent, older
 * children ascending by time.
 */
export function groupMyMissionsByRallyPoint(
  entries: MyMissionEntry[],
  chainsByRallyPointId: Record<string, MissionChainItem[]> = {}
): MyMissionListItem[] {
  const buckets = new Map<string, MyMissionEntry[]>();
  const noHub: MyMissionEntry[] = [];

  for (const entry of entries) {
    const rallyPointId = entry.rallyPointId;
    if (!rallyPointId) {
      noHub.push(entry);
      continue;
    }
    const bucket = buckets.get(rallyPointId) ?? [];
    bucket.push(entry);
    buckets.set(rallyPointId, bucket);
  }

  const items: MyMissionListItem[] = [];

  for (const [rallyPointId, members] of buckets) {
    const chain = chainsByRallyPointId[rallyPointId] ?? [];
    const chainGroup = buildChainGroup(rallyPointId, members, chain);
    if (chainGroup) {
      items.push(chainGroup);
      const consumed = new Set<string>();
      markGroupConsumed(chainGroup, consumed);
      for (const entry of members) {
        if (!consumed.has(entry.missionId)) {
          items.push({ kind: 'single', entry });
        }
      }
      continue;
    }

    if (members.length < 2) {
      items.push({ kind: 'single', entry: members[0]! });
      continue;
    }

    items.push(buildSiblingGroup(rallyPointId, members));
  }

  for (const entry of noHub) {
    items.push({ kind: 'single', entry });
  }

  return items.sort((a, b) => listItemSortTime(b) - listItemSortTime(a));
}
