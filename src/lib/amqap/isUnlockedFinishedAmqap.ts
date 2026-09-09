import type { MyMissionEntry } from '@/lib/api/myMissions';

/** Finished AMQAP with no locked score — invisible to hud_telemetry until repaired. */
export function isUnlockedFinishedAmqap(entry: {
  state: string;
  templateId: string | null;
  scoreBreakdown: unknown;
}): boolean {
  return (
    entry.state === 'finished' &&
    typeof entry.templateId === 'string' &&
    entry.templateId.startsWith('amqap-') &&
    entry.scoreBreakdown === null
  );
}

export function filterUnlockedFinishedAmqap(entries: MyMissionEntry[]): MyMissionEntry[] {
  return entries.filter(isUnlockedFinishedAmqap);
}
