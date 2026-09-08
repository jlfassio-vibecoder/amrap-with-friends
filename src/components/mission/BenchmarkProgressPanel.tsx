import { Link } from 'react-router-dom';
import type { AthleteBenchmark } from '@/lib/api/benchmarks';
import {
  buildBenchmarkHistory,
  type AttemptCandidate,
  type BenchmarkHistory,
} from '@/lib/benchmark/benchmarkAttempts';
import {
  benchmarkStatus,
  formatBenchmarkStatus,
  missionsSince,
} from '@/lib/benchmark/benchmarkStatus';
import { formatVariantBadge } from '@/lib/mission/exerciseScaling';
import { resolveWorkoutTitle } from '@/lib/workout/resolveWorkoutTitle';
import { MAX_ACTIVE_BENCHMARKS, type BenchmarkSlot } from '@/lib/benchmark/benchmarkCap';
import { benchmarkReadinessNote } from '@/lib/benchmark/benchmarkReadiness';
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
   * Slots a live campaign is holding. Counted in the header, because an athlete
   * whose third slot went to a campaign should be told where it went rather
   * than left to wonder why they cannot designate another.
   */
  campaignSlots?: readonly BenchmarkSlot[];
  /**
   * The athlete's current load, for the readiness caveat. Omit it and no
   * caveat is shown — never a gate either way.
   */
  riskLevel?: OvertrainingRiskLevel;
}

/** "142 → 156 reps". Oldest to newest, the way it happened. */
function formatSeries(history: BenchmarkHistory): string {
  return `${history.attempts.map((attempt) => attempt.score).join(' → ')} reps`;
}

/** "+14 (+9.9%)". Absolute and percent — +14 means nothing without the base. */
function formatChange(history: BenchmarkHistory): string | null {
  if (history.delta === null) {
    return null;
  }
  const sign = history.delta > 0 ? '+' : history.delta < 0 ? '−' : '';
  const absolute = `${sign}${Math.abs(history.delta)}`;
  if (history.percentChange === null) {
    return absolute;
  }
  const percentSign = history.percentChange > 0 ? '+' : history.percentChange < 0 ? '−' : '';
  return `${absolute} (${percentSign}${Math.abs(history.percentChange)}%)`;
}

/**
 * What each benchmark has done, and when it is due again.
 *
 * Not a chart, on purpose. Three series of two to five points each is where a
 * line has no information in it and three sparklines cost more attention than
 * they return — the numbers are the clearest form. Same conclusion the
 * modification and RPE panels reached.
 *
 * It also refuses to say more than it knows: one attempt is a number, not a
 * trend, and there is no projection, no goal line and no "on track", because
 * there is no validated model for how fast a benchmark should move.
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

  const used = active.length + campaignSlots.length;
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
          const change = formatChange(history);
          const variantLine = formatVariantBadge(benchmark.movementVariants);

          return (
            <li key={benchmark.id} className="space-y-1">
              <p className="text-sm font-semibold text-ink">
                {resolveWorkoutTitle(benchmark.templateId)} · {benchmark.durationMinutes} min
              </p>

              {variantLine ? <p className="text-xs text-secondary">{variantLine}</p> : null}

              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {history.attempts.length > 0 ? (
                  <span className="text-sm tabular-nums text-ink">{formatSeries(history)}</span>
                ) : (
                  <span className="text-sm text-secondary">No attempt yet</span>
                )}
                {change ? <span className="text-xs text-muted">{change}</span> : null}
                {history.attempts.length === 1 ? (
                  // One point is a number. A trend needs a third.
                  <span className="text-xs text-muted">first attempt</span>
                ) : null}
              </div>

              <p className="flex flex-wrap items-center gap-3 text-xs">
                <span
                  className={status.state === 'due' ? 'font-semibold text-accent' : 'text-muted'}
                >
                  {formatBenchmarkStatus(status)}
                </span>
                {status.state !== 'waiting' ? (
                  <Link className="link-accent" to={`/create?benchmark=${benchmark.id}`}>
                    {status.state === 'due' ? 'Retest' : 'Run it'}
                  </Link>
                ) : null}
              </p>

              {history.offVersionRuns.length > 0 ? (
                // Someone whose retest looks overdue when they have in fact run
                // the workout deserves to be told why it did not count.
                <p className="text-xs text-muted">
                  {history.offVersionRuns.length === 1
                    ? '1 other run of this workout was performed differently, so it is not in the series.'
                    : `${history.offVersionRuns.length} other runs of this workout were performed differently, so they are not in the series.`}
                </p>
              ) : null}
            </li>
          );
        })}
        {campaignSlots.map((slot) => (
          <li key={`campaign:${slot.domain}`} className="space-y-1">
            <p className="text-sm font-semibold text-ink">
              {resolveWorkoutTitle(slot.templateId)} · {slot.domain} min
            </p>
            <p className="text-xs text-muted">
              Held by {slot.campaignName ?? 'a campaign'}, which schedules its own retests.
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
