import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PartialRepsModal } from './PartialRepsModal';

afterEach(() => {
  cleanup();
});

describe('PartialRepsModal', () => {
  it('disables submit on mount and shows Submit label', () => {
    render(<PartialRepsModal repsPerRound={40} isSubmitting={false} onSubmit={vi.fn()} />);

    const submit = screen.getByRole('button', { name: 'Submit' });
    expect(submit).toBeTruthy();
    expect((submit as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows required header and instruction copy', () => {
    render(<PartialRepsModal repsPerRound={40} isSubmitting={false} onSubmit={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'TIME CALLED. BREATHE.' })).toBeTruthy();
    expect(
      screen.getByText(
        'Where did you break? Log the exact reps completed in your final, unfinished round.'
      )
    ).toBeTruthy();
  });

  it('enables submit and shows I EARNED THIS when honesty checkbox is checked', () => {
    render(<PartialRepsModal repsPerRound={40} isSubmitting={false} onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByRole('checkbox'));

    const submit = screen.getByRole('button', { name: 'I EARNED THIS' });
    expect((submit as HTMLButtonElement).disabled).toBe(false);
  });

  it('re-disables submit and reverts label when honesty checkbox is unchecked', () => {
    render(<PartialRepsModal repsPerRound={40} isSubmitting={false} onSubmit={vi.fn()} />);

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(screen.getByRole('button', { name: 'I EARNED THIS' })).toBeTruthy();

    fireEvent.click(checkbox);
    const submit = screen.getByRole('button', { name: 'Submit' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls onSubmit with the current stepper value when earned submit is clicked', () => {
    const onSubmit = vi.fn();
    render(<PartialRepsModal repsPerRound={40} isSubmitting={false} onSubmit={onSubmit} />);

    for (let i = 0; i < 7; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Increase partial reps' }));
    }
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'I EARNED THIS' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(7);
  });

  it('keeps submit disabled while isSubmitting even if checkbox is checked', () => {
    render(<PartialRepsModal repsPerRound={40} isSubmitting={true} onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByRole('checkbox'));

    const submit = screen.getByRole('button', { name: 'Submitting…' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a submit error on the overlay', () => {
    render(
      <PartialRepsModal
        repsPerRound={40}
        isSubmitting={false}
        error="Could not load your rounds. Please try again."
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText('Could not load your rounds. Please try again.')).toBeTruthy();
  });
});
