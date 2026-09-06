import { useMemo, useState } from 'react';
import { computePvi } from '@/lib/scoring/computePvi';
import { shouldExcludeBuyInRound } from '@/lib/scoring/getPacingDurations';
import { getPviMultiplier } from '@/lib/scoring/getPviMultiplier';
import { formatSplit, parseRoundSplits } from '@/lib/scoring/parseRoundSplits';

/**
 * The one interactive thing on the science pages, and the only honest one: it
 * runs the app's own PVI functions on splits the reader supplies, so nothing is
 * asserted that their own numbers do not support.
 *
 * The classification bands come from `getPviMultiplier` rather than being
 * restated here, so the page can never drift from the product. That they are
 * unvalidated is said on the page, not buried in this component.
 */
const CAPS = [5, 10, 15, 20] as const;

export default function PacingCalculator() {
  const [raw, setRaw] = useState('1:08 1:12 1:19 1:14 1:31');
  const [cap, setCap] = useState<number>(15);

  const parsed = useMemo(() => parseRoundSplits(raw), [raw]);
  const excludeFirstRound = shouldExcludeBuyInRound(cap);
  const scored = excludeFirstRound ? parsed.seconds.slice(1) : parsed.seconds;
  const pvi = computePvi(parsed.seconds, { excludeFirstRound });
  const result = getPviMultiplier(pvi);

  const fastest = scored.length ? Math.min(...scored) : 0;
  const slowest = scored.length ? Math.max(...scored) : 0;
  const longest = parsed.seconds.length ? Math.max(...parsed.seconds) : 1;

  return (
    <div className="card space-y-6 p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-ink">Your round times</span>
          <input
            type="text"
            inputMode="numeric"
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            placeholder="1:08 1:12 1:19"
            className="w-full rounded-card border border-border bg-surface px-3 py-2 text-ink"
          />
          <span className="block text-xs text-muted">
            Minutes and seconds, or plain seconds. Separate them with spaces or commas.
          </span>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-ink">Time cap</span>
          <select
            value={cap}
            onChange={(event) => setCap(Number(event.target.value))}
            className="w-full rounded-card border border-border bg-surface px-3 py-2 text-ink sm:w-40"
          >
            {CAPS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutes
              </option>
            ))}
          </select>
          <span className="block text-xs text-muted">
            {excludeFirstRound
              ? 'First round excluded — it carries the fast start.'
              : 'Every round counts at this cap.'}
          </span>
        </label>
      </div>

      {parsed.invalid.length > 0 && (
        <p className="text-sm text-secondary">
          Could not read:{' '}
          <span className="font-semibold text-ink">{parsed.invalid.join(', ')}</span>
        </p>
      )}

      {parsed.seconds.length > 0 && (
        <ul className="space-y-1.5">
          {parsed.seconds.map((seconds, index) => {
            const counted = !excludeFirstRound || index > 0;
            return (
              <li key={index} className="flex items-center gap-3 text-sm">
                <span className="w-16 shrink-0 text-secondary">Round {index + 1}</span>
                <span className="flex h-3.5 flex-1 items-center">
                  <span
                    className="h-3.5 rounded-[4px]"
                    style={{
                      width: `${Math.max((seconds / longest) * 100, 2)}%`,
                      backgroundColor: counted ? 'var(--color-chart-2)' : 'var(--color-border)',
                    }}
                  />
                </span>
                <span className="w-32 shrink-0 text-right font-semibold text-ink">
                  {formatSplit(seconds)}
                  {counted && seconds === slowest && scored.length > 1 && (
                    <span className="ml-1 font-normal text-muted">slowest</span>
                  )}
                  {counted && seconds === fastest && seconds !== slowest && (
                    <span className="ml-1 font-normal text-muted">fastest</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-divider pt-5">
        {pvi === null ? (
          <p className="text-sm text-secondary">
            Enter at least {excludeFirstRound ? 'three' : 'two'} round times to get a score.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-display text-3xl text-ink">{pvi.toFixed(1)}% variability</p>
            <p className="text-sm text-secondary">
              <span className="font-semibold text-ink">{result.classification}</span> — scored on{' '}
              {scored.length} rounds, fastest {formatSplit(fastest)}, slowest {formatSplit(slowest)}
              . This mission's score would be multiplied by {result.multiplier.toFixed(2)}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
