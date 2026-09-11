import type { MyMissionEntry } from '@/lib/api/myMissions';
import type {
  MyMissionChainChild,
  MyMissionListItem,
} from '@/lib/mission/groupMyMissionsByRallyPoint';

export type MyMissionRepeatItem = {
  kind: 'repeat';
  /** Stable React key / expand-state id (`solo|…` or `chain|…`). */
  key: string;
  /** Newest run; drives the face card. */
  parent: MyMissionEntry;
  /** Newest → oldest, including parent. */
  runs: MyMissionEntry[];
  /**
   * When the newest face is a chained hub card, keep that chain so the card
   * can still expand queued/sibling slots.
   */
  chain?: {
    rallyPointId: string;
    chainLength: number;
    children: MyMissionChainChild[];
  };
};

export type MyMissionDisplayItem = MyMissionListItem | MyMissionRepeatItem;

type SoloSource = { entry: MyMissionEntry };

type ChainSource = {
  entry: MyMissionEntry;
  rallyPointId: string;
  chainLength: number;
  children: MyMissionChainChild[];
};

function displayTimeMs(entry: MyMissionEntry): number {
  return new Date(entry.scheduledAt ?? entry.createdAt).getTime();
}

function listItemSortTime(item: MyMissionDisplayItem): number {
  if (item.kind === 'single') {
    return displayTimeMs(item.entry);
  }
  return displayTimeMs(item.parent);
}

/** Template + duration fragment; null means do not collapse. */
export function myMissionRepeatKey(entry: MyMissionEntry): string | null {
  if (!entry.templateId) {
    return null;
  }
  return `${entry.templateId}|${entry.durationMinutes}`;
}

function soloBucketKey(entry: MyMissionEntry): string | null {
  const base = myMissionRepeatKey(entry);
  return base ? `solo|${base}` : null;
}

function chainBucketKey(entry: MyMissionEntry): string | null {
  const base = myMissionRepeatKey(entry);
  return base ? `chain|${base}` : null;
}

function collapseSoloSources(key: string, sources: SoloSource[]): MyMissionDisplayItem {
  if (sources.length === 1) {
    return { kind: 'single', entry: sources[0]!.entry };
  }
  const runs = [...sources]
    .map((source) => source.entry)
    .sort((a, b) => displayTimeMs(b) - displayTimeMs(a));
  return {
    kind: 'repeat',
    key,
    parent: runs[0]!,
    runs,
  };
}

function collapseChainSources(
  key: string,
  sources: ChainSource[]
): { item: MyMissionDisplayItem; spilled: MyMissionEntry[] } {
  if (sources.length === 1) {
    const only = sources[0]!;
    return {
      item: {
        kind: 'group',
        rallyPointId: only.rallyPointId,
        parent: only.entry,
        chainLength: only.chainLength,
        children: only.children,
      },
      spilled: [],
    };
  }

  const sorted = [...sources].sort((a, b) => displayTimeMs(b.entry) - displayTimeMs(a.entry));
  const newest = sorted[0]!;
  const spilled: MyMissionEntry[] = [];
  for (const older of sorted.slice(1)) {
    for (const child of older.children) {
      if (child.kind === 'started') {
        spilled.push(child.entry);
      }
    }
  }

  return {
    item: {
      kind: 'repeat',
      key,
      parent: newest.entry,
      runs: sorted.map((source) => source.entry),
      chain: {
        rallyPointId: newest.rallyPointId,
        chainLength: newest.chainLength,
        children: newest.children,
      },
    },
    spilled,
  };
}

/**
 * Collapse repeats within solo and within chain — never across.
 *
 * Solo missions and hub-chain parents are different identities even with the
 * same templateId + duration. When two chain hubs collapse, started children
 * from older hubs spill into the solo pass so they stay on the list.
 */
export function groupMyMissionRepeats(items: MyMissionListItem[]): MyMissionDisplayItem[] {
  const passthrough: MyMissionDisplayItem[] = [];
  const soloBuckets = new Map<string, SoloSource[]>();
  const chainBuckets = new Map<string, ChainSource[]>();

  for (const item of items) {
    if (item.kind === 'group') {
      const key = chainBucketKey(item.parent);
      if (!key) {
        passthrough.push(item);
        continue;
      }
      const bucket = chainBuckets.get(key) ?? [];
      bucket.push({
        entry: item.parent,
        rallyPointId: item.rallyPointId,
        chainLength: item.chainLength,
        children: item.children,
      });
      chainBuckets.set(key, bucket);
      continue;
    }

    const key = soloBucketKey(item.entry);
    if (!key) {
      passthrough.push(item);
      continue;
    }
    const bucket = soloBuckets.get(key) ?? [];
    bucket.push({ entry: item.entry });
    soloBuckets.set(key, bucket);
  }

  const spilledEntries: MyMissionEntry[] = [];
  for (const [key, sources] of chainBuckets) {
    const { item, spilled } = collapseChainSources(key, sources);
    passthrough.push(item);
    spilledEntries.push(...spilled);
  }

  for (const spilled of spilledEntries) {
    const key = soloBucketKey(spilled);
    if (!key) {
      passthrough.push({ kind: 'single', entry: spilled });
      continue;
    }
    const bucket = soloBuckets.get(key) ?? [];
    bucket.push({ entry: spilled });
    soloBuckets.set(key, bucket);
  }

  for (const [key, sources] of soloBuckets) {
    passthrough.push(collapseSoloSources(key, sources));
  }

  return passthrough.sort((a, b) => listItemSortTime(b) - listItemSortTime(a));
}
