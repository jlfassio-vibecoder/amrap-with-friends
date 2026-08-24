import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PacingBarChart } from './PacingBarChart';

afterEach(() => {
  cleanup();
});

describe('PacingBarChart', () => {
  it('renders one bar per round', () => {
    const { container } = render(
      <PacingBarChart
        roundSplits={[62, 65, 71, 88]}
        durationMinutes={15}
        pvi={12.8}
      />
    );

    expect(container.querySelectorAll('rect')).toHaveLength(4);
    expect(screen.getByText('12.8%')).toBeDefined();
    expect(screen.getByText('Avg round time')).toBeDefined();
  });

  it('shows buy-in label for round 1 on 10+ minute sessions', () => {
    render(
      <PacingBarChart
        roundSplits={[120, 60, 60, 70]}
        durationMinutes={10}
        pvi={8}
      />
    );

    expect(screen.getByText('Buy-in')).toBeDefined();
  });

  it('renders average pace redline when at least two PVI-eligible rounds exist', () => {
    const { container } = render(
      <PacingBarChart
        roundSplits={[62, 65, 71]}
        durationMinutes={9}
        pvi={6.2}
      />
    );

    expect(container.textContent).toContain('Avg 1:06');
  });
});
