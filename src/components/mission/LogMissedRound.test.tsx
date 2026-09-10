import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LogMissedRound } from './LogMissedRound';
import { computeMissedRoundElapsedSec } from '@/lib/amrapTimer/computeMissedRoundElapsedSec';

function renderControl(onConfirm = vi.fn(), repsPerRound = 20) {
  render(
    <LogMissedRound
      roundNumber={3}
      repsPerRound={repsPerRound}
      preview={(reps) =>
        computeMissedRoundElapsedSec({
          previousElapsedSec: 238,
          nowElapsedSec: 394,
          repsPerRound,
          repsIntoNextRound: reps,
        })
      }
      onConfirm={onConfirm}
    />
  );
  return onConfirm;
}

afterEach(() => {
  cleanup();
});

describe('LogMissedRound', () => {
  it('stays out of the way until asked for', () => {
    renderControl();
    expect(screen.getByRole('button', { name: 'Forgot to log a round?' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Log round 3' })).toBeNull();
  });

  it('asks about the round after the one being logged', () => {
    renderControl();
    fireEvent.click(screen.getByRole('button', { name: 'Forgot to log a round?' }));
    expect(screen.getByText(/Total reps of round 4 you had finished/)).toBeTruthy();
  });

  it('shows the split the correction produces, and updates it as reps change', () => {
    renderControl();
    fireEvent.click(screen.getByRole('button', { name: 'Forgot to log a round?' }));

    // At zero reps there is nothing to correct.
    expect(screen.getByText(/at the clock as it stands now/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /More reps/ }));
    // 20 reps a round, 1 rep in, a 156s window -> boundary at 238 + 149 = 6:27.
    expect(screen.getByText('6:27')).toBeTruthy();

    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: /More reps/ }));
    }
    // 6 reps in -> 238 + 120 = 5:58, a 2:00 split.
    expect(screen.getByText('5:58')).toBeTruthy();
    expect(screen.getByText('2:00')).toBeTruthy();
  });

  it('cannot go below zero or past a full round', () => {
    renderControl(vi.fn(), 3);
    fireEvent.click(screen.getByRole('button', { name: 'Forgot to log a round?' }));

    expect(screen.getByRole('button', { name: /Fewer reps/ }).hasAttribute('disabled')).toBe(true);

    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: /More reps/ }));
    }

    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByRole('button', { name: /More reps/ }).hasAttribute('disabled')).toBe(true);
  });

  it('reports the rep count it was given, not the corrected time', () => {
    const onConfirm = renderControl();
    fireEvent.click(screen.getByRole('button', { name: 'Forgot to log a round?' }));
    fireEvent.click(screen.getByRole('button', { name: /More reps/ }));
    fireEvent.click(screen.getByRole('button', { name: /More reps/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Log round 3' }));

    expect(onConfirm).toHaveBeenCalledWith(2);
  });

  it('does not allow confirming when the estimate is uncorrected', () => {
    const onConfirm = renderControl();
    fireEvent.click(screen.getByRole('button', { name: 'Forgot to log a round?' }));

    expect(screen.getByRole('button', { name: 'Log round 3' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Log round 3' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('keeps confirm disabled when there is no time window to split', () => {
    const onConfirm = vi.fn();
    render(
      <LogMissedRound
        roundNumber={3}
        repsPerRound={20}
        preview={(reps) =>
          computeMissedRoundElapsedSec({
            previousElapsedSec: 100,
            nowElapsedSec: 100,
            repsPerRound: 20,
            repsIntoNextRound: reps,
          })
        }
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Forgot to log a round?' }));
    fireEvent.click(screen.getByRole('button', { name: /More reps/ }));

    expect(screen.getByText(/at the clock as it stands now/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log round 3' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Log round 3' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('closes without logging when cancelled', () => {
    const onConfirm = renderControl();
    fireEvent.click(screen.getByRole('button', { name: 'Forgot to log a round?' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Forgot to log a round?' })).toBeTruthy();
  });

  it('reopens at zero so a previous attempt cannot leak into the next', () => {
    const onConfirm = renderControl();
    fireEvent.click(screen.getByRole('button', { name: 'Forgot to log a round?' }));
    fireEvent.click(screen.getByRole('button', { name: /More reps/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forgot to log a round?' }));

    expect(screen.getByText(/at the clock as it stands now/)).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
