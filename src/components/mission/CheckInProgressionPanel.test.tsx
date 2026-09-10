import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CheckInProgressionPanel } from '@/components/mission/CheckInProgressionPanel';
import type { CheckInProgressionInput } from '@/lib/mission/checkInProgression';

afterEach(cleanup);

function entry(
  overrides: Partial<CheckInProgressionInput> & { missionId: string; rpe: number | null }
): CheckInProgressionInput {
  return {
    templateId: 'hull-breach',
    durationMinutes: 10,
    createdAt: '2026-01-01T10:00:00.000Z',
    scheduledAt: null,
    ...overrides,
  };
}

describe('CheckInProgressionPanel', () => {
  it('renders nothing without a comparison', () => {
    const { container } = render(
      <CheckInProgressionPanel entries={[entry({ missionId: 'm1', rpe: 7 })]} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows the RPE series', () => {
    render(
      <CheckInProgressionPanel
        entries={[
          entry({ missionId: 'm1', createdAt: '2026-01-01T10:00:00Z', rpe: 6 }),
          entry({ missionId: 'm2', createdAt: '2026-01-08T10:00:00Z', rpe: 8 }),
        ]}
      />
    );

    expect(screen.getByText('Your RPE progress')).toBeTruthy();
    expect(screen.getByText('RPE 6 → 8')).toBeTruthy();
    expect(screen.getByText('(+2)')).toBeTruthy();
  });
});
