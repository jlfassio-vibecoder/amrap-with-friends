import { describe, expect, it } from 'vitest';
import { LIVE_STATE_MESSAGE_CAP } from './liveStateLimits';
import { nextLiveStateSince } from './liveStateWatermark';

describe('nextLiveStateSince', () => {
  it('keeps the live-state chat cap in sync with get_mission_live_state', () => {
    expect(LIVE_STATE_MESSAGE_CAP).toBe(50);
  });
  it('advances to the latest round, message, or result stamp', () => {
    expect(
      nextLiveStateSince({
        previous: '2026-09-03T18:00:00.000Z',
        rounds: [{ created_at: '2026-09-03T18:01:00.000Z' }],
        messages: [{ created_at: '2026-09-03T18:00:30.000Z' }],
        segmentResults: [{ updated_at: '2026-09-03T18:02:00.000Z' }],
      })
    ).toBe('2026-09-03T18:02:00.000Z');
  });

  it('keeps the previous watermark when the increment is empty', () => {
    expect(
      nextLiveStateSince({
        previous: '2026-09-03T18:00:00.000Z',
        rounds: [],
        messages: [],
        segmentResults: [],
      })
    ).toBe('2026-09-03T18:00:00.000Z');
  });

  it('advances from a quiet bootstrap using snapshotAt', () => {
    expect(
      nextLiveStateSince({
        previous: null,
        rounds: [],
        messages: [],
        segmentResults: [],
        snapshotAt: '2026-09-03T18:05:00.000Z',
      })
    ).toBe('2026-09-03T18:05:00.000Z');
  });
});
