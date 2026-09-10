import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WeekPacingSpreadCard } from './WeekPacingSpreadCard';

afterEach(() => {
  cleanup();
});

describe('WeekPacingSpreadCard', () => {
  it('shows N/A when the week has no pacing average', () => {
    render(
      <MemoryRouter>
        <WeekPacingSpreadCard weekPviAverage={null} />
      </MemoryRouter>
    );

    expect(screen.getByLabelText('Week pacing spread')).toBeTruthy();
    expect(screen.getByText('N/A')).toBeTruthy();
    expect(screen.getByText(/average of this week's missions/i)).toBeTruthy();
  });

  it('shows the weekly average and guidance copy', () => {
    render(
      <MemoryRouter>
        <WeekPacingSpreadCard
          weekPviAverage={12.8}
          weekPviMissions={[
            {
              missionId: 'm1',
              pvi: 12.8,
              durationMinutes: 20,
              templateId: null,
              lockedAt: '2026-09-08T17:00:00.000Z',
            },
          ]}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('12.8%')).toBeTruthy();
    expect(screen.getByText(/Do this:/i)).toBeTruthy();
  });
});
