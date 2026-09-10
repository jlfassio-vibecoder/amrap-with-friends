import { personalBenchmarkSlots, type AthleteBenchmark } from '@/lib/api/benchmarks';
import { buildBenchmarkHistory, type AttemptCandidate } from '@/lib/benchmark/benchmarkAttempts';
import { campaignBenchmarkHistory } from '@/lib/benchmark/campaignBenchmarkHistory';
import { benchmarkStatus, missionsSince } from '@/lib/benchmark/benchmarkStatus';
import {
  MAX_ACTIVE_BENCHMARKS,
  activeBenchmarkCount,
  type BenchmarkSlot,
} from '@/lib/benchmark/benchmarkCap';
import { benchmarkReadinessNote } from '@/lib/benchmark/benchmarkReadiness';
import { BenchmarkRow } from '@/components/mission/BenchmarkRow';
import { formatVariantBadge } from '@/lib/mission/exerciseScaling';
import type { OvertrainingRiskLevel } from '@/lib/hud/evaluateOvertrainingRisk';

interface BenchmarkProgressPanelProps {
  benchmarks: readonly AthleteBenchmark[];
  /** Every scored mission of the athlete's, for attempts and the mission gate. */
  missions: readonly AttemptCandidate[];
  /**
   * Passed in rather than read here: `Date.now()` during render is impure, and
   * a due date that changes on an unrelated re-render is the kind of thing that
   * makes a status flicker.
   */
  now: number;
  /**
   * Slots a live campaign is holding. Counted in the header and given a row of
   * their own, because an athlete whose third slot went to a campaign should be
   * told where it went rather than left to wonder why they cannot designate
   * another.
   */
  campaignSlots?: readonly BenchmarkSlot[];
  /**
   * The athlete's current load, for the readiness caveat. Omit it and no
   * caveat is shown — never a gate either way.
   */
  riskLevel?: OvertrainingRiskLevel;
}

/**
 * What each benchmark has done, and when it is due again.
 *
 * Personal and campaign benchmarks render through the same `BenchmarkRow`,
 * because to the athlete they are the same thing: a workout they measure
 * against and will do again. Only who schedules the retest differs, and that is
 * one prop.
 *
 * Not a chart, on purpose. Three series of two to five points each is where a
 * line has no information in it and three sparklines cost more attention than
 * they return — the numbers are the clearest form. Same conclusion the
 * modification and RPE panels reached.
 */
export function BenchmarkProgressPanel({
  benchmarks,
  missions,
  now,
  campaignSlots = [],
  riskLevel,
}: BenchmarkProgressPanelProps) {
  const active = benchmarks.filter((benchmark) => benchmark.retiredAt === null);
  if (active.length === 0 && campaignSlots.length === 0) {
    // No empty state selling the feature. Designating happens on the mission.
    return null;
  }

  // Domains, not rows. The cap is one benchmark per domain, so counting slots
  // over-reports the moment two occupants share one — two live campaigns can
  // both test at ten minutes, and nothing stops a personal benchmark sitting in
  // a domain a campaign later claims. Saying "3 of 3" to someone who can still
  // designate at two other clocks is worse than saying nothing.
  const used = activeBenchmarkCount([...campaignSlots, ...personalBenchmarkSlots(active)]);
  const readiness = riskLevel ? benchmarkReadinessNote(riskLevel) : null;

  const missionDates = missions.map((mission) => ({
    at: mission.scheduledAt ?? mission.createdAt,
    scored: mission.finalScore !== null,
  }));

  return (
    <section className="card space-y-3 p-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-display text-lg text-ink">Benchmarks</h2>
          <span className="text-xs text-muted">
            {used} of {MAX_ACTIVE_BENCHMARKS} active
          </span>
        </div>
        <p className="text-sm text-secondary">
          Workouts you measure against. Same workout, same clock, performed the same way.
        </p>
        {readiness ? <p className="text-xs text-muted">{readiness}</p> : null}
      </div>

      <ul className="space-y-4">
        {active.map((benchmark) => {
          const history = buildBenchmarkHistory(
            {
              templateId: benchmark.templateId,
              durationMinutes: benchmark.durationMinutes,
              versionKey: benchmark.versionKey,
            },
            missions
          );
          const lastAttemptAt =
            history.attempts.length > 0 ? history.attempts[history.attempts.length - 1].at : null;
          const status = benchmarkStatus({
            lastAttemptAt,
            missionsSince: missionsSince(lastAttemptAt, missionDates),
            now,
          });

          return (
            <BenchmarkRow
              key={benchmark.id}
              templateId={benchmark.templateId}
              durationMinutes={benchmark.durationMinutes}
              variantLine={formatVariantBadge(benchmark.movementVariants)}
              history={history}
              status={status}
              // No link while they are still waiting: the row would be offering
              // a test it has just said is not due.
              retestHref={
                status.state === 'waiting' ? undefined : `/create?benchmark=${benchmark.id}`
              }
            />
          );
        })}

        {campaignSlots.map((slot) => {
          const history = campaignBenchmarkHistory(slot, missions);
          return (
            <BenchmarkRow
              // Keyed by the campaign, not the domain: two campaigns testing at
              // the same clock are two rows, and a shared key makes React
              // reconcile them as one.
              key={`campaign:${slot.campaignName ?? ''}:${slot.templateId}:${slot.durationMinutes}`}
              templateId={slot.templateId}
              durationMinutes={slot.durationMinutes}
              history={history}
              // No status and no retest link: the campaign decides when this one
              // runs again, and offering a Retest here would open a mission
              // outside the campaign that its calendar knows nothing about.
              note={`Held by ${slot.campaignName ?? 'a campaign'}, which schedules its own retests.`}
            />
          );
        })}
      </ul>
    </section>
  );
}
