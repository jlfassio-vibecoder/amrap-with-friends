import { useCallback, useEffect, useState } from 'react';
import { fetchMyBenchmarks, type AthleteBenchmark } from '@/lib/api/benchmarks';
import { fetchMyMissions, type MyMissionEntry } from '@/lib/api/myMissions';
import { fetchMyCampaigns } from '@/lib/api/campaigns';
import { campaignBenchmarkSlots } from '@/lib/benchmark/campaignBenchmarkSlots';
import type { BenchmarkSlot } from '@/lib/benchmark/benchmarkCap';

export interface BenchmarkProgressData {
  benchmarks: AthleteBenchmark[];
  missions: MyMissionEntry[];
  campaignSlots: BenchmarkSlot[];
  loading: boolean;
}

/**
 * Everything the Benchmarks card needs, in one place.
 *
 * Attempts are derived from the athlete's own missions rather than stored, so
 * the card needs the mission list as well as the benchmarks — that is the cost
 * of not keeping an attempts table in step, and it is the cheaper side of the
 * trade.
 *
 * A failure in any one of the three leaves that part empty rather than failing
 * the card: a benchmark with no mission list shows "no attempt yet", which is
 * wrong but harmless, while an error card in the middle of the HUD is neither.
 */
export function useBenchmarkProgress(enabled: boolean): BenchmarkProgressData {
  const [benchmarks, setBenchmarks] = useState<AthleteBenchmark[]>([]);
  const [missions, setMissions] = useState<MyMissionEntry[]>([]);
  const [campaignSlots, setCampaignSlots] = useState<BenchmarkSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (isStale: () => boolean) => {
    const [benchmarkResult, missionResult, campaignResult] = await Promise.all([
      fetchMyBenchmarks(),
      fetchMyMissions(),
      fetchMyCampaigns(),
    ]);

    if (isStale()) {
      return;
    }

    if (!benchmarkResult.error) {
      setBenchmarks(benchmarkResult.data ?? []);
    }
    if (!missionResult.error) {
      setMissions(missionResult.data ?? []);
    }
    if (!campaignResult.error) {
      setCampaignSlots(
        campaignBenchmarkSlots(
          campaignResult.data.map((campaign) => ({
            name: campaign.name,
            status: campaign.status,
            schedule: campaign.schedule,
          }))
        )
      );
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
