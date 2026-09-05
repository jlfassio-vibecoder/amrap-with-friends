import { describe, expect, it } from 'vitest';
import { estimateSegmentResultsFanOut } from './segmentResultsFanOut';

describe('estimateSegmentResultsFanOut', () => {
  it('keeps filtered delivery O(events in one mission) for 10+ concurrent missions', () => {
    const eventsPerMission = 7;
    const concurrentMissions = 12;
    const result = estimateSegmentResultsFanOut(concurrentMissions, eventsPerMission);

    expect(result.filtered).toBe(eventsPerMission);
    expect(result.unfiltered).toBe(concurrentMissions * eventsPerMission);
  });

  it('rejects negative inputs', () => {
    expect(() => estimateSegmentResultsFanOut(-1, 1)).toThrow(RangeError);
    expect(() => estimateSegmentResultsFanOut(1, -1)).toThrow(RangeError);
  });
});
