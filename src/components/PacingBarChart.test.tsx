import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PacingBarChart } from './PacingBarChart';

afterEach(() => {
  cleanup();
});

describe('PacingBarChart', () => {
  it('renders one bar per round', () => {
    const { container } = render(
      <PacingBarChart roundSplits={[62, 65, 71, 88]} durationMinutes={15} pvi={12.8} />
    );

    expect(container.querySelectorAll('rect')).toHaveLength(4);
    expect(screen.getByText('12.8%')).toBeDefined();
    expect(screen.getByText('Avg round time')).toBeDefined();
  });

  it('shows buy-in label for round 1 outside the Ultra-Short domain', () => {
    render(<PacingBarChart roundSplits={[120, 60, 60, 70]} durationMinutes={10} pvi={8} />);

    expect(screen.getByText('Buy-in')).toBeDefined();
  });

  it('treats a 7-minute mission like the rest of its domain', () => {
    // Under the old `>= 10` rule this round 1 counted, and a 7-minute mission
    // was scored differently from the 10-minute one beside it in the library.
    render(<PacingBarChart roundSplits={[120, 60, 60, 70]} durationMinutes={7} pvi={8} />);

    expect(screen.getByText('Buy-in')).toBeDefined();
  });

  it('counts every round on an Ultra-Short mission', () => {
    const { container } = render(
      <PacingBarChart roundSplits={[62, 65, 71]} durationMinutes={5} pvi={6.2} />
    );

    // 62, 65 and 71 all count: there are too few rounds on the clock to discard one.
    expect(container.textContent).toContain('Avg 1:06');
    expect(screen.queryByText('Buy-in')).toBeNull();
  });
});
