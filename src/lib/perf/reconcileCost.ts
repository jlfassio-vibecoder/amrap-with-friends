/**
 * What the live-state reconcile actually costs at a given roster size.
 *
 * The reconcile pulls a *full* snapshot, so its payload grows with the whole
 * mission -- every participant and every round anyone has logged -- while the
 * number of clients pulling it grows with the roster too. That product is the
 * thing worth measuring: doubling the roster roughly quadruples the bytes,
 * because both factors moved.
 *
 * These are pure so the load-test harness reports arithmetic that is under
 * test, rather than numbers assembled inline in a script nobody runs twice.
 */

export interface ReconcileCostInput {
  /** Measured bytes of one full `get_mission_live_state` response. */
  snapshotBytes: number;
  /** Clients holding the mission open -- one snapshot each, per interval. */
  participants: number;
  missionMinutes: number;
  /** `LIVE_RECONCILE_MS`, in milliseconds. */
  reconcileMs: number;
}

export interface ReconcileCost {
  snapshotsPerClient: number;
  totalSnapshots: number;
  totalBytes: number;
}

export function projectReconcileCost(input: ReconcileCostInput): ReconcileCost {
  const { snapshotBytes, participants, missionMinutes, reconcileMs } = input;
  if (reconcileMs <= 0) {
    throw new Error('reconcileMs must be positive');
  }

  // A mission shorter than one interval still gets the pull at the finish.
  const snapshotsPerClient = Math.max(1, Math.floor((missionMinutes * 60_000) / reconcileMs));
  const totalSnapshots = snapshotsPerClient * Math.max(0, participants);

  return {
    snapshotsPerClient,
    totalSnapshots,
    totalBytes: totalSnapshots * Math.max(0, snapshotBytes),
  };
}

/**
 * Realtime deliveries for the rounds logged in one mission.
 *
 * Every INSERT is fanned out to every subscriber, so this is the roster
 * squared times the rounds each athlete logs -- the number that decides
 * whether one workout fits inside a plan's monthly message budget.
 */
export function projectRoundFanOut(participants: number, roundsEach: number): number {
  const n = Math.max(0, participants);
  return n * Math.max(0, roundsEach) * n;
}

/** Linear interpolation percentile over unsorted samples. */
export function percentile(samples: number[], p: number): number {
  if (samples.length === 0) {
    return 0;
  }
  const sorted = [...samples].sort((a, b) => a - b);
  if (sorted.length === 1) {
    return sorted[0]!;
  }
  const rank = (Math.min(100, Math.max(0, p)) / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) {
    return sorted[low]!;
  }
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (rank - low);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}
