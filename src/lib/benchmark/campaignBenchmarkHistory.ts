import { versionKeyFor } from '@/lib/mission/movementVersion';
import {
  buildBenchmarkHistory,
  type AttemptCandidate,
  type BenchmarkHistory,
} from '@/lib/benchmark/benchmarkAttempts';
import type { BenchmarkSlot } from '@/lib/benchmark/benchmarkCap';

/**
 * A campaign benchmark's scores, read the same way a personal one's are.
 *
 * The derivation is identical — same workout, same clock, same version, over
 * the athlete's own missions — so this reuses `buildBenchmarkHistory` whole.
 * The one thing a campaign benchmark does not have is a stored version: nobody
 * designated it, so nobody said how it would be performed.
 *
 * **The version is the athlete's first attempt at it.** That run is what the
 * retests are measured against, so whatever they did there defines the test for
 * them — exactly the role the stored `version_key` plays for a personal
 * benchmark. Choosing the first rather than the most recent matters: if an
 * athlete modified the week-one benchmark and later retested standard, the
 * standard run is the *change*, not the new baseline, and taking the latest
 * version would silently redefine the test to make that change disappear.
 *
 * Returns null when they have not run it yet — there is no version to pick and
 * nothing to compare, so the row shows the campaign is holding the slot and
 * says no more than that.
 */
export function campaignBenchmarkHistory(
  slot: BenchmarkSlot,
  missions: readonly AttemptCandidate[]
): BenchmarkHistory | null {
  const runs = missions
    .filter(
      (mission) =>
        mission.templateId === slot.templateId &&
        mission.durationMinutes === slot.durationMinutes &&
        mission.finalScore !== null
    )
    .sort(
      (a, b) =>
        Date.parse(a.scheduledAt ?? a.createdAt) - Date.parse(b.scheduledAt ?? b.createdAt)
    );

  if (runs.length === 0) {
    return null;
  }

  const versionKey = versionKeyFor({
    modifiedMovements: runs[0].modifiedMovements,
    movementVariants: runs[0].movementVariants,
  });

  return buildBenchmarkHistory(
    {
      templateId: slot.templateId,
      durationMinutes: slot.durationMinutes,
      versionKey,
    },
    missions
  );
}
