import { deriveCampaignRoles } from '@/lib/campaign/campaignRoles';
import { isCampaignClosed } from '@/lib/campaign/campaignLifecycle';
import { domainForCap } from '@/lib/timeDomains';
import { isBenchmarkableTemplate, type BenchmarkSlot } from '@/lib/benchmark/benchmarkCap';

/**
 * The slots an athlete's live campaigns are already holding.
 *
 * A campaign benchmark counts against the three. It is a real test on a real
 * cadence, and the mission it costs is the same mission — so an athlete in an
 * 8-week campaign has two personal slots, not three, and the UI says which
 * campaign took the third rather than leaving them to wonder.
 *
 * **This is derived here, in TypeScript, and deliberately not in SQL.**
 * `deriveCampaignRoles` is not "the first occurrence": it also requires the
 * schedule to end by repeating the opening workout, and bails when there are
 * more repeats than any campaign length schedules. Re-implementing those
 * conditions in a plpgsql cap check would be a second copy of a tested rule,
 * and the two would drift the first time either changed — quietly, because a
 * disagreement would only show up as a cap that admits one benchmark too many.
 *
 * So the split is: the database enforces what must hold whatever the client
 * does — one personal benchmark per domain, three personal at most, library
 * templates only — and the campaign contribution is applied here, over data the
 * client already has. Over-designating costs the athlete training, not
 * integrity, which is the right thing to enforce in the cheaper place.
 */

export interface CampaignBenchmarkInput {
  name: string;
  status: string;
  /** In schedule order; `sequence` is what orders them server-side. */
  schedule: ReadonlyArray<{
    weekNumber: number;
    templateId: string | null;
    durationMinutes: number;
  }>;
}

export function campaignBenchmarkSlots(
  campaigns: readonly CampaignBenchmarkInput[]
): BenchmarkSlot[] {
  const slots: BenchmarkSlot[] = [];

  for (const campaign of campaigns) {
    // A finished campaign is not testing anyone any more, so it holds nothing.
    if (isCampaignClosed(campaign.status)) {
      continue;
    }

    const roles = deriveCampaignRoles(
      campaign.schedule.map((occurrence) => ({
        weekNumber: occurrence.weekNumber,
        templateId: occurrence.templateId,
      }))
    );

    const benchmarkIndex = roles.indexOf('benchmark');
    if (benchmarkIndex === -1) {
      // A schedule with no recoverable benchmark is a plain rotation. It is not
      // measuring anything, so it does not get to hold a slot.
      continue;
    }

    const benchmark = campaign.schedule[benchmarkIndex];
    if (!isBenchmarkableTemplate(benchmark.templateId)) {
      continue;
    }

    // The benchmark occurrence's own clock, not the campaign's — duration is
    // stored per occurrence, and it is the test's clock that claims the slot.
    const domain = domainForCap(benchmark.durationMinutes);
    if (domain === null) {
      continue;
    }

    slots.push({
      domain,
      source: 'campaign',
      templateId: benchmark.templateId as string,
      durationMinutes: benchmark.durationMinutes,
      campaignName: campaign.name,
    });
  }

  return slots;
}
