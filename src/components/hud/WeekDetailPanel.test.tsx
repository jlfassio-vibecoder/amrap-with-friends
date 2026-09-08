import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WeekDetailPanel } from '@/components/hud/WeekDetailPanel';
import type { HudHistoryWeek, HudWeekMission } from '@/lib/hud/types';

afterEach(() => {
  cleanup();
});

function mission(overrides: Partial<HudWeekMission> = {}): HudWeekMission {
  return {
    missionId: '11111111-1111-4111-8111-111111111111',
    // Deliberately not the week's 6.4% average, so a test asserting one of
    // them cannot accidentally match the other.
    pvi: 5.1,
    durationMinutes: 20,
    templateId: null,
    lockedAt: '2026-09-08T17:00:00.000Z',
    finalScore: 236,
    ...overrides,
  };
}

function week(overrides: Partial<HudHistoryWeek> = {}): HudHistoryWeek {
  return {
    weekStart: new Date(2026, 8, 7).toISOString(),
    minutes: 60,
    compliant: false,
    missionCount: 3,
    score: 700,
    pviAverage: 6.4,
    missions: [mission()],
    ...overrides,
  };
}

function props(overrides: Partial<Parameters<typeof WeekDetailPanel>[0]> = {}) {
  return {
    week: week(),
    isCurrent: false,
    baselineMinutes: 150,
    canStepOlder: true,
    canStepNewer: true,
    onStepOlder: vi.fn(),
    onStepNewer: vi.fn(),
    onJumpToCurrent: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe('WeekDetailPanel', () => {
  it('heads the panel with the week span and its headline figures', () => {
    render(<WeekDetailPanel {...props()} />);

    const monday = new Date(2026, 8, 7);
    const sunday = new Date(2026, 8, 13);
    const format = (date: Date) =>
      date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    expect(screen.getByText(`${format(monday)} – ${format(sunday)}`)).toBeTruthy();
    expect(screen.getByText('60')).toBeTruthy();
    expect(screen.getByText('700')).toBeTruthy();
    expect(screen.getByText('6.4%')).toBeTruthy();
  });

  it('says "This week" and hides the jump control on the current week', () => {
    render(<WeekDetailPanel {...props({ isCurrent: true })} />);

    expect(screen.getByText('This week')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'This week' })).toBeNull();
  });

  it('offers a jump back to the current week from any older one', () => {
    const onJumpToCurrent = vi.fn();
    render(<WeekDetailPanel {...props({ isCurrent: false, onJumpToCurrent })} />);

    fireEvent.click(screen.getByRole('button', { name: 'This week' }));
    expect(onJumpToCurrent).toHaveBeenCalledTimes(1);
  });

  it('steps in both directions and closes', () => {
    const onStepOlder = vi.fn();
    const onStepNewer = vi.fn();
    const onClose = vi.fn();
    render(<WeekDetailPanel {...props({ onStepOlder, onStepNewer, onClose })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close week detail' }));

    expect(onStepOlder).toHaveBeenCalledTimes(1);
    expect(onStepNewer).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables stepping at the ends of the window', () => {
    render(<WeekDetailPanel {...props({ canStepOlder: false, canStepNewer: false })} />);

    expect(screen.getByRole('button', { name: 'Previous week' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Next week' })).toHaveProperty('disabled', true);
  });

  it('distinguishes an empty past week from the week still in progress', () => {
    const empty = week({ missionCount: 0, minutes: 0, score: 0, pviAverage: null, missions: [] });

    const { unmount } = render(<WeekDetailPanel {...props({ week: empty, isCurrent: false })} />);
    expect(screen.getByText(/No locked missions this week/)).toBeTruthy();
    unmount();

    render(<WeekDetailPanel {...props({ week: empty, isCurrent: true })} />);
    expect(screen.getByText(/Nothing locked yet this week/)).toBeTruthy();
  });

  it('lists each mission with its duration, pacing, and score', () => {
    const withTwo = week({
      missions: [
        mission({ missionId: 'a', durationMinutes: 20, pvi: 4.2, finalScore: 236 }),
        mission({ missionId: 'b', durationMinutes: 10, pvi: 9.1, finalScore: 118 }),
      ],
    });
    render(<WeekDetailPanel {...props({ week: withTwo })} />);

    expect(screen.getByText('20 min')).toBeTruthy();
    expect(screen.getByText('4.2%')).toBeTruthy();
    expect(screen.getByText('236')).toBeTruthy();
    expect(screen.getByText('10 min')).toBeTruthy();
    expect(screen.getByText('9.1%')).toBeTruthy();
    expect(screen.getByText('118')).toBeTruthy();
  });

  it('fills the baseline bar to the share of quota the week reached', () => {
    const { container } = render(
      <WeekDetailPanel {...props({ week: week({ minutes: 75 }), baselineMinutes: 150 })} />
    );

    const fill = container.querySelector('[data-testid="week-detail-baseline-fill"]');
    expect((fill as HTMLElement).style.width).toBe('50%');
  });
});
