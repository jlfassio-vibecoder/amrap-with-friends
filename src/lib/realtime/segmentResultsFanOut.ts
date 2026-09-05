export interface SegmentResultsFanOut {
  /** Events delivered if every client listens to the whole table. */
  unfiltered: number;
  /** Events delivered when each client filters by its own mission_id. */
  filtered: number;
}

/**
 * Models segment-result Realtime fan-out for concurrent missions.
 * Unfiltered listeners receive every mission's events; mission_id filters
 * receive only that mission's events.
 */
export function estimateSegmentResultsFanOut(
  concurrentMissions: number,
  eventsPerMission: number
): SegmentResultsFanOut {
  if (
    !Number.isFinite(concurrentMissions) ||
    !Number.isFinite(eventsPerMission) ||
    concurrentMissions < 0 ||
    eventsPerMission < 0
  ) {
    throw new RangeError(
      'concurrentMissions and eventsPerMission must be non-negative finite numbers'
    );
  }

  return {
    unfiltered: concurrentMissions * eventsPerMission,
    filtered: eventsPerMission,
  };
}
