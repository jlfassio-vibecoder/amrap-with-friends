import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
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

function renderBadge(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('ClassificationBadge', () => {
  it('shows UNCLASSIFIED when below 150 minutes', () => {
    renderBadge(<ClassificationBadge classification={belowBaseline} />);

    expect(screen.getByTestId('classification-current').textContent).toBe('UNCLASSIFIED');
    expect(screen.getByText(/Previous:/).textContent).toContain('CIVILIAN');
  });

  it('expands checklist with unmet Operator rows from Civilian path', () => {
    renderBadge(
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
    expect(panel.textContent).toContain('(Quotas scaled for Demographic Profile)');
  });

  it('shows claimed vs verified when behind the declaration', () => {
    renderBadge(
      <ClassificationBadge classification={belowBaseline} perceivedClassification="operator" />
    );

    expect(screen.getByTestId('classification-gap').textContent).toBe(
      'Claimed: OPERATOR | Verified: UNCLASSIFIED'
    );
    expect(screen.queryByTestId('classification-current')).toBeNull();
  });

  it('hides claimed copy when verified meets the declaration', () => {
    renderBadge(
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

    expect(screen.getByTestId('classification-current').textContent).toBe('OPERATOR');
    expect(screen.queryByTestId('classification-gap')).toBeNull();
  });

  it('shows absolute-standard copy when proving Special Ops', () => {
    renderBadge(
      <ClassificationBadge classification={belowBaseline} perceivedClassification="special_ops" />
    );

    fireEvent.click(screen.getByRole('button', { name: /checklist/i }));
    expect(screen.getByTestId('quota-note').textContent).toBe(
      '(Absolute Standard. No Demographic Scaling)'
    );
  });

  it('can start expanded for the HUD hero', () => {
    renderBadge(<ClassificationBadge classification={belowBaseline} defaultExpanded />);

    expect(screen.getByTestId('classification-checklist')).toBeTruthy();
    expect(screen.getByRole('button', { name: /hide/i })).toBeTruthy();
  });

  it('lists Launch mission CTAs only under incomplete checklist rows', () => {
    const onLaunchTemplate = vi.fn();
    renderBadge(
      <ClassificationBadge
        classification={{
          current: 'civilian',
          previous: 'unclassified',
          progress: {
            weekMinutes: 240,
            intensity3PlusCount: 1,
            intensity4PlusCount: 0,
            marathon20Count: 0,
          },
        }}
        defaultExpanded
        recommendationsByRow={{
          'i3-plus': [
            {
              templateId: 'blood-shunt',
              name: 'Blood Shunt',
              durationMinutes: 10,
              intensityTier: 3,
              locked: false,
            },
          ],
          'volume-operator': [
            {
              templateId: 'should-not-show',
              name: 'Hidden',
              durationMinutes: 20,
              intensityTier: 2,
              locked: false,
            },
          ],
        }}
        onLaunchTemplate={onLaunchTemplate}
      />
    );

    // Volume is met at 240 / 240 — no recs list for volume-operator.
    expect(screen.queryByTestId('checklist-recs-volume-operator')).toBeNull();
    expect(screen.getByTestId('checklist-recs-i3-plus')).toBeTruthy();
    expect(screen.getByText('Blood Shunt')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Launch mission' }));
    expect(onLaunchTemplate).toHaveBeenCalledWith('blood-shunt');
  });
});
