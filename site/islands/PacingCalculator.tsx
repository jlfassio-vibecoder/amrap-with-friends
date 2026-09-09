import { useEffect, useMemo, useRef, useState } from 'react';
import { computePvi } from '@/lib/scoring/computePvi';
import { shouldExcludeBuyInRound } from '@/lib/scoring/getPacingDurations';
import { getPviMultiplier } from '@/lib/scoring/getPviMultiplier';
import { formatSplit, parseRoundSplits } from '@/lib/scoring/parseRoundSplits';
import { allTimeCaps, defaultCapForDomain } from '@/lib/timeDomains';
import {
  DEFAULT_SPLITS,
  isOwnInput,
  reportPacingCtaClicked,
  reportPacingScored,
  shouldReportPacingScore,
} from '@/lib/analytics/pacingCalculatorEvents';
import { countOf } from '@/lib/units/plural';

/**
 * The one interactive thing on the science pages, and the only honest one: it
 * runs the app's own PVI functions on splits the reader supplies, so nothing is
 * asserted that their own numbers do not support.
 *
 * The classification bands come from `getPviMultiplier` rather than being
 * restated here, so the page can never drift from the product. That they are
 * unvalidated is said on the page, not buried in this component.
 */
/** Every legal cap, read from the range table so the page cannot offer a clock the app will not run. */
const CAPS = allTimeCaps();

export default function PacingCalculator() {
  const [raw, setRaw] = useState(DEFAULT_SPLITS);
  const [cap, setCap] = useState<number>(defaultCapForDomain(15));

  const parsed = useMemo(() => parseRoundSplits(raw), [raw]);
  const excludeFirstRound = shouldExcludeBuyInRound(cap);
  const scored = excludeFirstRound ? parsed.seconds.slice(1) : parsed.seconds;
  const pvi = computePvi(parsed.seconds, { excludeFirstRound });
  const result = getPviMultiplier(pvi);

  const reportedRef = useRef(false);
  const contextRef = useRef({
    capMinutes: cap,
    roundCount: scored.length,
    pvi,
    classification: result.classification,
  });

  // Declared before the effect that reads it, so the report always carries the
  // numbers on screen rather than the previous render's.
  useEffect(() => {
    contextRef.current = {
      capMinutes: cap,
      roundCount: scored.length,
      pvi,
      classification: result.classification,
    };
  }, [cap, scored.length, pvi, result.classification]);

  // Debounced, because the result recomputes on every keystroke and a report
  // per keypress would be noise rather than data. One event per visit: the
  // question is whether they checked their own pacing at all, not how many
  // times they retyped a digit.
  useEffect(() => {
    if (
      !shouldReportPacingScore({
        edited: isOwnInput(raw),
        hasResult: pvi !== null,
        alreadyReported: reportedRef.current,
      })
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      reportedRef.current = true;
      reportPacingScored(contextRef.current);
    }, 1500);
    return () => {
      window.clearTimeout(timer);
    };
  }, [raw, pvi]);

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
              : 'Every round counts on a clock this short.'}
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
              {countOf(scored.length, 'round')}, fastest {formatSplit(fastest)}, slowest{' '}
              {formatSplit(slowest)}. This mission's score would be multiplied by{' '}
              {result.multiplier.toFixed(2)}.
            </p>
          </div>
        )}
      </div>

      {/* The page had no way into the product. Someone who has just typed their
          own splits in is checking their real pacing against the app's scoring,
          so the copy offers the thing that removes the typing rather than
          asking them to sign up for its own sake. */}
      <div className="space-y-2 border-t border-divider pt-5 text-center">
        <p className="text-sm text-secondary">
          {pvi === null
            ? 'The app scores pacing like this on every mission, from rounds you log as you go.'
            : `Log rounds during a mission and the app scores this automatically — no splits to type in afterwards.`}
        </p>
        <a
          className="btn-primary inline-flex items-center justify-center text-sm"
          data-cta="pacing-calculator"
          href="/plan-mission"
          onClick={() => {
            reportPacingCtaClicked(pvi === null ? 'idle' : 'scored', contextRef.current);
          }}
        >
          Plan a mission
        </a>
      </div>
    </div>
  );
}
