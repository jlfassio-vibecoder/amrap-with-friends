import type { TimeDomain, WorkoutCategory } from '@/data/workoutTemplates';
import type { CampaignTrack } from './types';

/**
 * The benchmark workout for each (duration, category) track.
 *
 * Fixed per category on purpose: a campaign's result is the difference between
 * the same workout done in week one and again at the end, and that comparison
 * only spans crews and campaigns if everyone training a 10-minute Blood Shunt
 * is measured against the same test.
 *
 * **These ids must never change.** Editing one silently invalidates every
 * result already recorded against it — an athlete's "eight more rounds than in
 * week one" would be comparing two different workouts. Adding a track means
 * adding a benchmark here; retiring one means leaving the entry in place.
 *
 * Each was chosen as the median-volume workout of its pool, so the test is
 * representative of the track rather than its easiest or hardest mission.
 */
const BENCHMARK_TEMPLATE_IDS: Record<string, string> = {
  '5:blood-shunt': 'flash-flood',
  '5:engine-room': 'the-gas-pedal',
  '5:localized-trap': 'quadra-kill',
  '5:midline-tension': 'the-hull-breach',
  '10:blood-shunt': 'the-hemodynamic',
  '10:engine-room': 'constant-current',
  '10:localized-trap': 'equilibrium',
  '10:midline-tension': 'the-iron-cross',
  '15:blood-shunt': 'the-piston-grind',
  '15:engine-room': 'the-cruiser-endurance',
  '15:localized-trap': 'the-equalizer',
  '15:midline-tension': 'the-suspended-bridge',
  '20:aerobic-matrix': 'the-pacer',
  '20:armor-protocol': 'the-stronghold',
  '20:four-point-cascade': 'the-baseline',
};

export function campaignTrackKey(durationMinutes: TimeDomain, category: WorkoutCategory): string {
  return `${durationMinutes}:${category}`;
}

/** The benchmark template id for a track, or null if the track has none. */
export function benchmarkTemplateIdFor(track: CampaignTrack): string | null {
  return BENCHMARK_TEMPLATE_IDS[campaignTrackKey(track.durationMinutes, track.category)] ?? null;
}

/** Every benchmark id, for tests that assert the table stays in step with the library. */
export function allBenchmarkTemplateIds(): string[] {
  return Object.values(BENCHMARK_TEMPLATE_IDS);
}

export function allBenchmarkTrackKeys(): string[] {
  return Object.keys(BENCHMARK_TEMPLATE_IDS);
}
