import { useCallback, useEffect, useId, useState } from 'react';
import {
  designateBenchmark,
  fetchBenchmarkOverview,
  personalBenchmarkSlots,
  retireBenchmark,
  type AthleteBenchmark,
} from '@/lib/api/benchmarks';
import { campaignBenchmarkSlots } from '@/lib/benchmark/campaignBenchmarkSlots';
import { canDesignateBenchmark, type BenchmarkSlot } from '@/lib/benchmark/benchmarkCap';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import type { MovementVariantSelection } from '@/lib/mission/exerciseScaling';

interface BenchmarkDesignateControlProps {
  templateId: string | null;
  durationMinutes: number;
  /** From `versionKeyFor` — the version the athlete plans to perform. */
  versionKey?: string;
  /** The same plan as a selection, so a retest can pre-select it. */
  movementVariants?: MovementVariantSelection;
}

/**
 * Designating a benchmark, on the mission, before it is run.
 *
 * This is where the decision is actually made: the workout and the clock are
 * settled, and the athlete's modification plan is on the same screen, so the
 * version the benchmark records is the version they are about to do. Asking on
 * the Create form would be asking before any of that is known.
 *
 * Personal to the athlete, not to the mission — a joiner designates for
 * themselves, and the host does not designate for the squad.
 */
export function BenchmarkDesignateControl({
  templateId,
  durationMinutes,
  versionKey = '',
  movementVariants = {},
}: BenchmarkDesignateControlProps) {
  const { isAuthenticated, isAuthLoading } = useAmrapAuth();
  const designateTipId = useId();
  const [mine, setMine] = useState<AthleteBenchmark[]>([]);
  const [campaignSlots, setCampaignSlots] = useState<BenchmarkSlot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canLoad = !isAuthLoading && isAuthenticated && templateId !== null;

  const load = useCallback(async (isStale: () => boolean = () => false) => {
    // Attempts are left off: this surface only asks whether the workout is
    // already a benchmark and which slots are free, and attempts are the only
    // part of the payload that grows with the athlete's history.
    const { data, error: loadError } = await fetchBenchmarkOverview(false);
    if (isStale()) {
      return;
    }
    if (loadError || !data) {
      // One call means one outcome: benchmarks and campaign slots now succeed
      // or fail together, so the control can never think a domain is free
      // because half the answer arrived.
      setError(loadError?.message ?? 'Something went wrong. Please try again.');
      setLoaded(true);
      return;
    }
    setMine(data.benchmarks);
    setCampaignSlots(campaignBenchmarkSlots(data.campaigns));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!canLoad) {
      return;
    }
    let cancelled = false;
    // Deferred out of the effect body: `load` sets state, and doing that
    // synchronously here cascades a render before the first paint.
    queueMicrotask(() => {
      if (!cancelled) {
        void load(() => cancelled);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [canLoad, load]);

  if (!canLoad || !loaded) {
    return null;
  }

  const active = mine.filter((benchmark) => benchmark.retiredAt === null);
  const existing = active.find(
    (benchmark) =>
      benchmark.templateId === templateId && benchmark.durationMinutes === durationMinutes
  );

  // Campaign slots first, so a campaign's claim is never papered over by a
  // personal row and the athlete is told which campaign holds the domain.
  const slots: BenchmarkSlot[] = [...campaignSlots, ...personalBenchmarkSlots(active)];
  const verdict = canDesignateBenchmark({ templateId, cap: durationMinutes, slots });

  async function handleDesignate() {
    if (!verdict.ok || templateId === null) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await designateBenchmark({
      templateId,
      durationMinutes,
      timeDomain: verdict.domain,
      versionKey,
      movementVariants,
    });
    if (result.error) {
      setError(result.error.message);
    } else {
      await load();
    }
    setBusy(false);
  }

  async function handleRetire(benchmarkId: string) {
    setBusy(true);
    setError(null);
    const result = await retireBenchmark(benchmarkId);
    if (result.error) {
      setError(result.error.message);
    } else {
      await load();
    }
    setBusy(false);
  }

  if (existing) {
    return (
      <div className="rounded-card border border-accent bg-accent-tint p-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-on-accent">
            Benchmark
          </span>
          You are measuring yourself against this one.
        </p>
        <button
          type="button"
          className="link-accent mt-2 text-xs"
          disabled={busy}
          onClick={() => void handleRetire(existing.id)}
        >
          {busy ? 'Retiring…' : 'Retire this benchmark'}
        </button>
        {/* Retiring frees the slot and keeps every score. There is no delete. */}
        <p className="mt-1 text-xs text-muted">
          Retiring frees the slot. Your scores on it are kept either way.
        </p>
        {error ? <p className="text-error mt-2 text-xs">{error}</p> : null}
      </div>
    );
  }

  if (!verdict.ok) {
    // A coach workout or an off-domain clock is not a refusal worth explaining
    // unprompted — the athlete never asked. Say nothing.
    if (verdict.reason === 'not-a-library-template' || verdict.reason === 'cap-has-no-domain') {
      return null;
    }

    const blocking = verdict.blocking;
    let why = 'You already have three benchmarks running.';
    if (verdict.reason === 'domain-taken-campaign') {
      why = `Your ${blocking?.campaignName ?? 'campaign'} is already testing at this length.`;
    } else if (verdict.reason === 'domain-taken-personal') {
      why = 'You already have a benchmark at this length.';
    }

    return (
      <p className="text-xs text-muted">
        {why} Retire one from My missions to measure this workout instead.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <span className="group relative block w-full">
        <button
          type="button"
          className="btn-outline w-full text-sm"
          disabled={busy}
          aria-describedby={designateTipId}
          onClick={() => void handleDesignate()}
        >
          {busy ? 'Saving…' : 'Make this a benchmark mission'}
        </button>
        <span
          id={designateTipId}
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 w-max max-w-[18rem] -translate-x-1/2 rounded-card border border-border bg-surface px-2.5 py-1.5 text-left text-xs leading-snug text-secondary opacity-0 shadow-card transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
        >
          A workout you come back to and run again, to see what changed. Does not affect your score.
        </span>
      </span>
      {error ? <p className="text-error text-xs">{error}</p> : null}
    </div>
  );
}
