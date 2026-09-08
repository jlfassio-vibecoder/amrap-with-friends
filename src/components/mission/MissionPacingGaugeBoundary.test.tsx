import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

// The gauge is replaced with one that always throws, so this asserts the mount
// wraps it — not merely that the boundary component works in isolation.
vi.mock('@/components/mission/PacingGauge', () => ({
  PacingGauge: () => {
    throw new Error('gauge blew up');
  },
}));

const { MissionPacingGauge } = await import('@/components/mission/MissionPacingGauge');

afterEach(cleanup);
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

/** Stands in for the clock, Start and Log round sitting beside the gauge. */
function MissionLike() {
  return (
    <div>
      <p>4:37</p>
      <MissionPacingGauge
        phase="work"
        roundSplitsSec={[45]}
        elapsedSec={90}
        isPaused={false}
        isPractice={false}
      />
      <button type="button">Log round</button>
    </div>
  );
}

describe('a throwing gauge at its real mount point', () => {
  it('does not take the clock or Log round with it', () => {
    // Without the boundary at this mount, React unmounts the whole root and
    // both of these disappear — which is what a dead mid-workout screen is.
    render(<MissionLike />);
    expect(screen.getByText('4:37')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log round' })).toBeTruthy();
  });
});
