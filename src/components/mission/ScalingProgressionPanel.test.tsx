import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ScalingProgressionPanel } from '@/components/mission/ScalingProgressionPanel';
import type { ProgressionInput } from '@/lib/mission/movementProgression';

afterEach(cleanup);

function entry(overrides: Partial<ProgressionInput> & { missionId: string }): ProgressionInput {
  return {
    templateId: 'hull-breach',
    durationMinutes: 10,
    createdAt: '2026-01-01T10:00:00.000Z',
    scheduledAt: null,
    finalScore: 100,
    modifiedMovements: [],
    movementVariants: {},
    ...overrides,
  };
}

const KNEES = {
  modifiedMovements: ['Diamond Push-ups'],
  movementVariants: { 'Diamond Push-ups': 'push-up--knees' },
};

describe('ScalingProgressionPanel', () => {
  it('renders nothing for an athlete who has never scaled', () => {
    const { container } = render(
      <ScalingProgressionPanel
        entries={[
          entry({ missionId: 'm1', createdAt: '2026-01-01T10:00:00Z', finalScore: 40 }),
          entry({ missionId: 'm2', createdAt: '2026-01-08T10:00:00Z', finalScore: 44 }),
        ]}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows the scores in order with the change', () => {
    render(
      <ScalingProgressionPanel
        entries={[
          entry({ missionId: 'm1', createdAt: '2026-01-01T10:00:00Z', finalScore: 40, ...KNEES }),
          entry({ missionId: 'm2', createdAt: '2026-01-08T10:00:00Z', finalScore: 45, ...KNEES }),
          entry({ missionId: 'm3', createdAt: '2026-01-15T10:00:00Z', finalScore: 48, ...KNEES }),
        ]}
      />
    );

    expect(screen.getByText('40 → 45 → 48 reps')).toBeTruthy();
    expect(screen.getByText('(+8 reps)')).toBeTruthy();
    expect(screen.getByText('Diamond Push-ups: from the knees')).toBeTruthy();
  });

  it('lists a standard run beside the scaled one without merging them', () => {
    render(
      <ScalingProgressionPanel
        entries={[
          entry({ missionId: 'm1', createdAt: '2026-01-01T10:00:00Z', finalScore: 48, ...KNEES }),
          entry({ missionId: 'm2', createdAt: '2026-02-01T10:00:00Z', finalScore: 36 }),
        ]}
      />
    );

    expect(screen.getByText('As programmed')).toBeTruthy();
    expect(screen.getByText('36 reps')).toBeTruthy();
    expect(screen.getByText('48 reps')).toBeTruthy();
    // No blended trend line across the two versions.
    expect(screen.queryByText('48 → 36 reps')).toBeNull();
  });
});
