import { Link } from 'react-router-dom';
import type { BenchmarkHistory } from '@/lib/benchmark/benchmarkAttempts';
import { formatBenchmarkStatus, type BenchmarkStatus } from '@/lib/benchmark/benchmarkStatus';
import { resolveWorkoutTitle } from '@/lib/workout/resolveWorkoutTitle';

interface BenchmarkRowProps {
  templateId: string;
  durationMinutes: number;
  /** "Diamond Push-ups: from the knees", when the test is a modified one. */
  variantLine?: string | null;
  /** Null when nothing has been run yet. */
  history: BenchmarkHistory | null;
  /** Omitted for a campaign benchmark, which schedules its own retests. */
  status?: BenchmarkStatus;
  /** Where "Retest" points. Omitted when the athlete does not drive this one. */
  retestHref?: string;
  /** Replaces the status line, e.g. who is holding this slot. */
  note?: string;
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
 * One benchmark, whether the athlete designated it or a campaign did.
 *
 * The two are the same thing to the athlete — a workout they measure against
 * and will do again — and the only real differences are who chose it and who
 * schedules the retest. Those live in `status` / `retestHref` / `note`; the
 * scores, the change and the disclosures are identical, because the derivation
 * behind them is literally the same function.
 *
 * The row will not say more than it knows: one attempt is "first attempt", a
 * decline reads as a decline, and there is no projection or goal line.
 */
export function BenchmarkRow({
  templateId,
  durationMinutes,
  variantLine,
  history,
  status,
  retestHref,
  note,
}: BenchmarkRowProps) {
  const change = history ? formatChange(history) : null;

  return (
    <li className="space-y-1">
      <p className="text-sm font-semibold text-ink">
        {resolveWorkoutTitle(templateId)} · {durationMinutes} min
      </p>

      {variantLine ? <p className="text-xs text-secondary">{variantLine}</p> : null}

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {history && history.attempts.length > 0 ? (
          <span className="text-sm tabular-nums text-ink">{formatSeries(history)}</span>
        ) : (
          <span className="text-sm text-secondary">No attempt yet</span>
        )}
        {change ? <span className="text-xs text-muted">{change}</span> : null}
        {history?.attempts.length === 1 ? (
          // One point is a number. A trend needs a third.
          <span className="text-xs text-muted">first attempt</span>
        ) : null}
      </div>

      {status || retestHref || note ? (
        <p className="flex flex-wrap items-center gap-3 text-xs">
          {status ? (
            <span className={status.state === 'due' ? 'font-semibold text-accent' : 'text-muted'}>
              {formatBenchmarkStatus(status)}
            </span>
          ) : null}
          {note ? <span className="text-muted">{note}</span> : null}
          {retestHref ? (
            <Link className="link-accent" to={retestHref}>
              {status?.state === 'due' ? 'Retest' : 'Run it'}
            </Link>
          ) : null}
        </p>
      ) : null}

      {history && history.offVersionRuns.length > 0 ? (
        // Someone whose retest looks overdue when they have in fact run the
        // workout deserves to be told why it did not count.
        <p className="text-xs text-muted">
          {history.offVersionRuns.length === 1
            ? '1 other run of this workout was performed differently, so it is not in the series.'
            : `${history.offVersionRuns.length} other runs of this workout were performed differently, so they are not in the series.`}
        </p>
      ) : null}
    </li>
  );
}
