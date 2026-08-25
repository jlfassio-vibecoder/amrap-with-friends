import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ClassificationBadge } from './ClassificationBadge';
import type { HudClassification } from '@/lib/hud/types';

afterEach(() => {
  cleanup();
});

const belowBaseline: HudClassification = {
  current: 'unclassified',
  previous: 'civilian',
  progress: {
    weekMinutes: 40,
    intensity3PlusCount: 0,
    intensity4PlusCount: 0,
    marathon20Count: 0,
  },
};

describe('ClassificationBadge', () => {
  it('shows UNCLASSIFIED when below 150 minutes', () => {
    render(<ClassificationBadge classification={belowBaseline} />);

    expect(screen.getByTestId('classification-current').textContent).toBe(
      'UNCLASSIFIED'
    );
    expect(screen.getByText(/Previous:/).textContent).toContain('CIVILIAN');
  });

  it('expands checklist with unmet Operator rows from Civilian path', () => {
    render(
      <ClassificationBadge
        classification={{
          current: 'civilian',
          previous: 'unclassified',
          progress: {
            weekMinutes: 180,
            intensity3PlusCount: 1,
            intensity4PlusCount: 0,
            marathon20Count: 0,
          },
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /checklist/i }));

    const panel = screen.getByTestId('classification-checklist');
    expect(panel.textContent).toContain('Next: OPERATOR');
    expect(panel.textContent).toContain('1 / 2 Intensity 3+');
    expect(panel.textContent).toContain('180 / 240 min');
  });

  it('shows claimed vs verified when behind the declaration', () => {
    render(
      <ClassificationBadge
        classification={belowBaseline}
        perceivedClassification="operator"
      />
    );

    expect(screen.getByTestId('classification-gap').textContent).toBe(
      'Claimed: OPERATOR | Verified: UNCLASSIFIED'
    );
    expect(screen.queryByTestId('classification-current')).toBeNull();
  });

  it('hides claimed copy when verified meets the declaration', () => {
    render(
      <ClassificationBadge
        classification={{
          current: 'operator',
          previous: 'civilian',
          progress: {
            weekMinutes: 250,
            intensity3PlusCount: 2,
            intensity4PlusCount: 0,
            marathon20Count: 0,
          },
        }}
        perceivedClassification="operator"
      />
    );

    expect(screen.getByTestId('classification-current').textContent).toBe(
      'OPERATOR'
    );
    expect(screen.queryByTestId('classification-gap')).toBeNull();
  });
});
