import { useCallback, useEffect, useState } from 'react';
import {
  fetchBenchmarkOverview,
  type AthleteBenchmark,
  type BenchmarkAttemptRow,
} from '@/lib/api/benchmarks';
import { campaignBenchmarkSlots } from '@/lib/benchmark/campaignBenchmarkSlots';
import type { BenchmarkSlot } from '@/lib/benchmark/benchmarkCap';

export interface BenchmarkProgressData {
  benchmarks: AthleteBenchmark[];
  missions: BenchmarkAttemptRow[];
  campaignSlots: BenchmarkSlot[];
  loading: boolean;
}

/**
 * Everything the Benchmarks card needs, in one round trip.
 *
 * Attempts are derived from the athlete's own missions rather than stored, so
 * the card needs their mission history as well as their benchmarks — that is
 * the cost of not keeping an attempts table in step. `benchmark_overview`
 * makes it the cheap side of the trade: eight columns per scored mission
 * rather than my_missions' workouts, breakdowns and chain counts, all in the
 * same call as the benchmarks and the campaign schedules.
 *
 * A failure leaves the card empty rather than erroring in the middle of the
 * HUD, which is the right way round for a progress surface.
 */
export function useBenchmarkProgress(enabled: boolean): BenchmarkProgressData {
  const [benchmarks, setBenchmarks] = useState<AthleteBenchmark[]>([]);
  const [missions, setMissions] = useState<BenchmarkAttemptRow[]>([]);
  const [campaignSlots, setCampaignSlots] = useState<BenchmarkSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (isStale: () => boolean) => {
    const { data, error } = await fetchBenchmarkOverview(true);

    if (isStale()) {
      return;
    }

    if (!error && data) {
      setBenchmarks(data.benchmarks);
      setMissions(data.attempts);
      setCampaignSlots(campaignBenchmarkSlots(data.campaigns));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    // Deferred: setState synchronously in an effect body cascades a render.
    queueMicrotask(() => {
      if (!cancelled) {
        void load(() => cancelled);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, load]);

  return { benchmarks, missions, campaignSlots, loading };
}
