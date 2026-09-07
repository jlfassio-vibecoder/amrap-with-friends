import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PartialRepsModal } from './PartialRepsModal';

afterEach(cleanup);

const workout = [
  { name: 'Reverse Lunges (Total)', target: 12 },
  { name: 'Diamond Push-ups', target: 10 },
  { name: 'Sprawls', target: 10 },
];

function lockIn() {
  fireEvent.click(screen.getByRole('checkbox', { name: /full range of motion/i }));
  fireEvent.click(screen.getByRole('button', { name: /I EARNED THIS/i }));
}

describe('PartialRepsModal', () => {
  it('offers every programmed movement to mark', () => {
    render(
      <PartialRepsModal
        repsPerRound={32}
        isSubmitting={false}
        workout={workout}
        onSubmit={vi.fn()}
      />
    );

    for (const exercise of workout) {
      expect(screen.getByRole('checkbox', { name: exercise.name })).toBeTruthy();
    }
  });

  it('says the mark is free, where the athlete decides', () => {
    // If they believe the box costs points they will not tick it, and the
    // feature collects nothing.
    render(
      <PartialRepsModal
        repsPerRound={32}
        isSubmitting={false}
        workout={workout}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText(/do not lower it/i)).toBeTruthy();
  });

  it('submits the marked movements alongside the reps', () => {
    const onSubmit = vi.fn();
    render(
      <PartialRepsModal
        repsPerRound={32}
        isSubmitting={false}
        workout={workout}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Diamond Push-ups' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase partial reps' }));
    lockIn();

    expect(onSubmit).toHaveBeenCalledWith(1, ['Diamond Push-ups']);
  });

  it('submits nothing when no movement is marked', () => {
    const onSubmit = vi.fn();
    render(
      <PartialRepsModal
        repsPerRound={32}
        isSubmitting={false}
        workout={workout}
        onSubmit={onSubmit}
      />
    );

    lockIn();

    expect(onSubmit).toHaveBeenCalledWith(0, []);
  });

  it('lets a mark be taken back before locking', () => {
    const onSubmit = vi.fn();
    render(
      <PartialRepsModal
        repsPerRound={32}
        isSubmitting={false}
        workout={workout}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Sprawls' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sprawls' }));
    lockIn();

    expect(onSubmit).toHaveBeenCalledWith(0, []);
  });

  it('does not gate the submit on the modification question', () => {
    // The honesty lock is required; marking a modification is optional.
    const onSubmit = vi.fn();
    render(
      <PartialRepsModal
        repsPerRound={32}
        isSubmitting={false}
        workout={workout}
        onSubmit={onSubmit}
      />
    );

    lockIn();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('renders without a workout, for callers that have none', () => {
    const onSubmit = vi.fn();
    render(<PartialRepsModal repsPerRound={32} isSubmitting={false} onSubmit={onSubmit} />);

    expect(screen.queryByText(/did you modify/i)).toBeNull();
    lockIn();
    expect(onSubmit).toHaveBeenCalledWith(0, []);
  });
});
