import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CoachWalkthrough } from './CoachWalkthrough';
import { STAGING_WALKTHROUGH_STEPS } from './stagingWalkthrough';

afterEach(() => {
  cleanup();
});

const statusStep = STAGING_WALKTHROUGH_STEPS[0];

function renderWalkthrough(
  onNext: () => void = () => undefined,
  onSkip: () => void = () => undefined
) {
  return render(
    <>
      <div data-walkthrough-id="status">Waiting status</div>
      <CoachWalkthrough
        step={statusStep}
        onNext={onNext}
        onSkip={onSkip}
      />
    </>
  );
}

describe('CoachWalkthrough', () => {
  it('renders Coach copy and advances on Next', () => {
    const onNext = vi.fn();
    renderWalkthrough(onNext);

    expect(screen.getByText('Coach')).toBeTruthy();
    expect(screen.getByRole('heading', { name: statusStep.title })).toBeTruthy();
    expect(screen.getByText(statusStep.body)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('calls onSkip when Skip is clicked', () => {
    const onSkip = vi.fn();
    renderWalkthrough(() => undefined, onSkip);

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss when the backdrop is clicked', () => {
    const onNext = vi.fn();
    const onSkip = vi.fn();
    renderWalkthrough(onNext, onSkip);

    fireEvent.click(screen.getByTestId('coach-walkthrough'));

    expect(onNext).not.toHaveBeenCalled();
    expect(onSkip).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: statusStep.title })).toBeTruthy();
  });
});
