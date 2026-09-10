import type { LiveMissionPhase } from '@/lib/missionSync/types';

/**
 * How often a live client pulls a full snapshot on top of its live feed.
 *
 * A `postgres_changes` INSERT that never arrives leaves a hole nothing else
 * closes. An athlete heals their own hole -- `log_round` reports the index it
 * actually wrote and the client resyncs -- but nobody is holding the button for
 * the athlete beside them, so their missing round sits on the leaderboard for
 * the rest of the mission and their splits are wrong in the share card
 * afterwards. The incremental poll cannot recover it either: the watermark has
 * already moved past the row, so "everything since" will never name it.
 *
 * Thirty seconds is chosen against the cost, not the symptom: one extra
 * `get_mission_live_state` per client per half minute, only while the clock is
 * running, against a wrong score that otherwise lasts the whole mission.
 */
export const LIVE_RECONCILE_MS = 30_000;

/** Reconciling is only worth its request while rounds can still be landing. */
export function shouldReconcileLiveState(phase: LiveMissionPhase | null | undefined): boolean {
  return phase === 'setup' || phase === 'work';
}
