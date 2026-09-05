import { describe, expect, it } from 'vitest';
import { shouldShowMissionReset } from './shouldShowMissionReset';

describe('shouldShowMissionReset', () => {
  it('shows for practice in any phase', () => {
    expect(
      shouldShowMissionReset({
        isPractice: true,
        isHost: false,
        isFeatured: true,
        phase: 'finished',
      })
    ).toBe(true);
  });

  it('shows for live host on waiting/setup/work when not featured', () => {
    expect(
      shouldShowMissionReset({
        isPractice: false,
        isHost: true,
        isFeatured: false,
        phase: 'work',
      })
    ).toBe(true);
    expect(
      shouldShowMissionReset({
        isPractice: false,
        isHost: true,
        isFeatured: false,
        phase: 'finished',
      })
    ).toBe(false);
  });

  it('hides for joiners and featured', () => {
    expect(
      shouldShowMissionReset({
        isPractice: false,
        isHost: false,
        isFeatured: false,
        phase: 'work',
      })
    ).toBe(false);
    expect(
      shouldShowMissionReset({
        isPractice: false,
        isHost: true,
        isFeatured: true,
        phase: 'work',
      })
    ).toBe(false);
  });
});
