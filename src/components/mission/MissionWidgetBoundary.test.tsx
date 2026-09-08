import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MissionWidgetBoundary } from '@/components/mission/MissionWidgetBoundary';
import { PacingGauge } from '@/components/mission/PacingGauge';

afterEach(cleanup);

beforeEach(() => {
  // React logs the caught error; the point of these tests is that it is caught.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

function Exploding(): never {
  throw new Error('gauge blew up');
}

/** The shape of the live view: a widget beside the controls that matter. */
function LiveViewLike({ children, onLogRound }: { children: React.ReactNode; onLogRound: () => void }) {
  return (
    <section>
      <p>12:34</p>
      <MissionWidgetBoundary name="PacingGauge">{children}</MissionWidgetBoundary>
      <button type="button" onClick={onLogRound}>
        Log round
      </button>
    </section>
  );
}

describe('a failing mission widget', () => {
  it('does not take the clock and Log round down with it', () => {
    // React unmounts the whole root on an uncaught render error, so without the
    // boundary a throw here removes the button, the clock and the audio effect
    // — the mission dies silently mid-workout.
    const onLogRound = vi.fn();
    render(
      <LiveViewLike onLogRound={onLogRound}>
        <Exploding />
      </LiveViewLike>
    );

    expect(screen.getByText('12:34')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Log round' });
    fireEvent.click(button);
    expect(onLogRound).toHaveBeenCalledTimes(1);
  });

  it('hides the widget rather than showing an error to a mid-mission athlete', () => {
    render(
      <MissionWidgetBoundary name="PacingGauge">
        <Exploding />
      </MissionWidgetBoundary>
    );
    expect(document.body.textContent).toBe('');
  });

  it('names the failing widget in the console for whoever debugs it', () => {
    render(
      <MissionWidgetBoundary name="PacingGauge">
        <Exploding />
      </MissionWidgetBoundary>
    );
    const logged = vi.mocked(console.error).mock.calls.some((call) =>
      String(call[0]).includes('[mission] PacingGauge failed')
    );
    expect(logged).toBe(true);
  });

  it('renders its children normally when nothing is wrong', () => {
    render(
      <MissionWidgetBoundary name="PacingGauge">
        <p>fine</p>
      </MissionWidgetBoundary>
    );
    expect(screen.getByText('fine')).toBeTruthy();
  });
});

describe('the gauge survives a malformed feed', () => {
  it('renders rather than throwing when the splits are missing entirely', () => {
    // The crash path that was live: computePacingGaugeState read .length off
    // whatever it was handed. An edit to the hook's return was one typo away
    // from unmounting the mission on every tick of the work phase.
    const onLogRound = vi.fn();
    render(
      <LiveViewLike onLogRound={onLogRound}>
        <PacingGauge
          roundSplitsSec={undefined as unknown as number[]}
          elapsedSec={90}
        />
      </LiveViewLike>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Log round' }));
    expect(onLogRound).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Round 1 sets the benchmark/)).toBeTruthy();
  });

  it('survives a non-finite clock', () => {
    render(<PacingGauge roundSplitsSec={[45]} elapsedSec={Number.NaN} />);
    expect(screen.getByRole('figure')).toBeTruthy();
  });
});
