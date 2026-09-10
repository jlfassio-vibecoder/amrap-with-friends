import { versionKeyFor } from '@/lib/mission/movementVersion';
import type { MovementVariantSelection } from '@/lib/mission/exerciseScaling';

/**
 * What counts as an attempt at a benchmark.
 *
 * An attempt is a scored run of the same workout, at the same clock, performed
 * the same way. Not stored anywhere — `movement_version_key` already defines
 * "the same workout performed the same way", and it is already contract-tested
 * across TypeScript and SQL, so a benchmark's history is recovered rather than
 * maintained. No attempts table, nothing to keep in step.
 *
 * **A run you did not press "Retest" for still counts.** What you scored on
 * that workout at that clock is the measurement; the alternative is a benchmark
 * series that disagrees with My missions about the same score on the same day.
 *
 * **A run at a different modification does not count** — and is not thrown
 * away either. It comes back as an off-version run so the UI can say "you ran
 * this three weeks ago, but not the way you measure", which is the honest thing
 * to tell someone whose retest looks overdue when they have in fact done the
 * workout.
 */

export interface AttemptCandidate {
  missionId: string;
  templateId: string | null;
  durationMinutes: number;
  createdAt: string;
  scheduledAt: string | null;
  finalScore: number | null;
  modifiedMovements: readonly string[];
  movementVariants: MovementVariantSelection;
}

export interface BenchmarkAttempt {
  missionId: string;
  /** The instant the attempt is filed under. */
  at: string;
  score: number;
}

export interface BenchmarkHistory {
  /** Same version, oldest first — the comparable series. */
  attempts: BenchmarkAttempt[];
  /** Same workout and clock, performed differently. Never in the series. */
  offVersionRuns: BenchmarkAttempt[];
  first: number | null;
  latest: number | null;
  /** latest − first; null until there are two attempts. */
  delta: number | null;
  /** Percent change, one decimal place; null until there are two attempts. */
  percentChange: number | null;
}

export interface BenchmarkIdentity {
  templateId: string;
  durationMinutes: number;
  versionKey: string;
}

function attemptAt(candidate: AttemptCandidate): string {
  return candidate.scheduledAt ?? candidate.createdAt;
}

export function buildBenchmarkHistory(
  benchmark: BenchmarkIdentity,
  candidates: readonly AttemptCandidate[]
): BenchmarkHistory {
  const attempts: BenchmarkAttempt[] = [];
  const offVersionRuns: BenchmarkAttempt[] = [];

  for (const candidate of candidates) {
    if (
      candidate.templateId !== benchmark.templateId ||
      candidate.durationMinutes !== benchmark.durationMinutes ||
      candidate.finalScore === null
    ) {
      continue;
    }

    const entry: BenchmarkAttempt = {
      missionId: candidate.missionId,
      at: attemptAt(candidate),
      score: candidate.finalScore,
    };

    const versionKey = versionKeyFor({
      modifiedMovements: candidate.modifiedMovements,
      movementVariants: candidate.movementVariants,
    });

    if (versionKey === benchmark.versionKey) {
      attempts.push(entry);
    } else {
      offVersionRuns.push(entry);
    }
  }

  const byDate = (a: BenchmarkAttempt, b: BenchmarkAttempt) => Date.parse(a.at) - Date.parse(b.at);
  attempts.sort(byDate);
  offVersionRuns.sort(byDate);

  if (attempts.length === 0) {
    return { attempts, offVersionRuns, first: null, latest: null, delta: null, percentChange: null };
  }

  const first = attempts[0].score;
  const latest = attempts[attempts.length - 1].score;

  return {
    attempts,
    offVersionRuns,
    first,
    latest,
    delta: attempts.length < 2 ? null : latest - first,
    // Percent is the headline here in a way it is not elsewhere: +14 reps means
    // nothing without knowing whether the score was 40 or 400. Guarded against
    // a zero opener, which would otherwise report an infinite improvement.
    percentChange:
      attempts.length < 2 || first === 0
        ? null
        : Math.round(((latest - first) / first) * 1000) / 10,
  };
}
