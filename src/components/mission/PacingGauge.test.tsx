import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PacingGauge } from '@/components/mission/PacingGauge';

afterEach(cleanup);

const needle = () => screen.queryByTestId('pacing-needle');

describe('PacingGauge', () => {
  it('shows no needle until round 1 sets the benchmark', () => {
    render(<PacingGauge roundSplitsSec={[]} elapsedSec={30} />);
    expect(needle()).toBeNull();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText(/Round 1 sets the benchmark/)).toBeTruthy();
  });

  it('counts down the time left against round 1', () => {
    render(<PacingGauge roundSplitsSec={[90]} elapsedSec={155} />);
    expect(screen.getByText('0:25')).toBeTruthy();
    expect(screen.getByText('On pace')).toBeTruthy();
  });

  it('names the limit before it is crossed', () => {
    render(<PacingGauge roundSplitsSec={[100]} elapsedSec={195} />);
    expect(screen.getByText('At the limit')).toBeTruthy();
  });

  it('shows a signed overtime counter past the benchmark', () => {
    render(<PacingGauge roundSplitsSec={[45]} elapsedSec={95} />);
    expect(screen.getByText('+0:05')).toBeTruthy();
    expect(screen.getByText('Overtime')).toBeTruthy();
  });

  it('reads without colour: the zone is named and the seconds are exact', () => {
    // The green/amber/red convention serves some readers poorly, and the
    // palette's own contrast result requires relief. Both are text.
    render(<PacingGauge roundSplitsSec={[45]} elapsedSec={95} />);
    const figure = screen.getByRole('figure');
    expect(figure.textContent).toContain('+0:05');
    expect(figure.textContent).toContain('Overtime');
  });

  it('describes itself to a screen reader', () => {
    render(<PacingGauge roundSplitsSec={[45]} elapsedSec={95} />);
    expect(screen.getByLabelText(/Pacing: Overtime, \+0:05 past round 1/)).toBeTruthy();
  });

  it('sweeps with a one-second linear transition, matching the clock tick', () => {
    render(<PacingGauge roundSplitsSec={[90]} elapsedSec={120} />);
    expect(needle()?.style.transition).toBe('transform 1s linear');
  });

  it('snaps rather than sweeps when a round resets it', () => {
    // Easing here would walk the needle backwards through the zones it just
    // left, which reads as the athlete losing a round they in fact banked.
    render(<PacingGauge roundSplitsSec={[90, 180]} elapsedSec={180} />);
    expect(needle()?.style.transition).toBe('none');
  });

  it('stops moving while the mission is paused', () => {
    render(<PacingGauge roundSplitsSec={[90]} elapsedSec={120} isPaused />);
    expect(needle()?.style.transition).toBe('none');
  });

  it('turns the needle further for a slower round', () => {
    const { unmount } = render(<PacingGauge roundSplitsSec={[100]} elapsedSec={125} />);
    const early = needle()?.style.transform ?? '';
    unmount();
    render(<PacingGauge roundSplitsSec={[100]} elapsedSec={175} />);
    const late = needle()?.style.transform ?? '';

    const degrees = (value: string) => Number(/rotate\(([-\d.]+)deg\)/.exec(value)?.[1] ?? '0');
    expect(degrees(late)).toBeGreaterThan(degrees(early));
  });

  it('stops the needle at the end of the dial on a long stall', () => {
    render(<PacingGauge roundSplitsSec={[45]} elapsedSec={400} />);
    const degrees = Number(
      /rotate\(([-\d.]+)deg\)/.exec(needle()?.style.transform ?? '')?.[1] ?? '0'
    );
    expect(degrees).toBeCloseTo(90);
    // The counter keeps the truth the dial cannot show.
    expect(screen.getByText('+5:10')).toBeTruthy();
  });

  it('uses only design tokens for the zone colours', () => {
    // No hard-coded hex in a component, per the repo's token rule.
    const { container } = render(<PacingGauge roundSplitsSec={[45]} elapsedSec={95} />);
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{6}/i);
    expect(container.innerHTML).toContain('--color-pace-overtime');
  });
});
