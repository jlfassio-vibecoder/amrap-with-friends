/** Finished AMQAP with no locked score — invisible to hud_telemetry until repaired. */
export function isUnlockedFinishedAmqap(entry: {
  state: string;
  templateId: string | null;
  /** Present on MyMissionEntry; absent on list_unlocked_amqap rows (already filtered). */
  scoreBreakdown?: unknown;
  hasScoreBreakdown?: boolean;
}): boolean {
  if (entry.state !== 'finished') {
    return false;
  }
  if (typeof entry.templateId !== 'string' || !entry.templateId.startsWith('amqap-')) {
    return false;
  }
  if (entry.hasScoreBreakdown === true) {
    return false;
  }
  if (entry.scoreBreakdown !== undefined && entry.scoreBreakdown !== null) {
    return false;
  }
  return true;
}

export function filterUnlockedFinishedAmqap<
  T extends Parameters<typeof isUnlockedFinishedAmqap>[0],
>(entries: T[]): T[] {
  return entries.filter(isUnlockedFinishedAmqap);
}
