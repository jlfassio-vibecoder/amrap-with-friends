import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { WeeklyBaselineBar } from './WeeklyBaselineBar';
import type { HudHistoryWeek } from '@/lib/hud/types';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function previousWeek(overrides: Partial<HudHistoryWeek> = {}): HudHistoryWeek {
  return {
    weekStart: '2026-09-01T07:00:00.000Z',
    minutes: 40,
    compliant: false,
    missionCount: 2,
    score: 200,
    pviAverage: 6,
    missions: [
      {
        missionId: 'a',
        pvi: 6,
        durationMinutes: 10,
        templateId: null,
        lockedAt: '2026-09-02T17:00:00.000Z',
        finalScore: 100,
      },
      {
        missionId: 'b',
        pvi: 6,
        durationMinutes: 30,
        templateId: null,
        lockedAt: '2026-09-05T17:00:00.000Z',
        finalScore: 100,
      },
    ],
    ...overrides,
  };
}

describe('WeeklyBaselineBar', () => {
  it('shows empty fill and locked-mission copy when weekMinutes is 0', () => {
    render(<WeeklyBaselineBar weekMinutes={0} weekEndsAt="2099-01-01T00:00:00.000Z" />);

    expect(screen.getByText('0 / 150 Min')).toBeDefined();
    expect(screen.getByTestId('weekly-baseline-fill').getAttribute('style')).toContain('width: 0%');
    expect(screen.getByText(/only locked scores count/i)).toBeDefined();
    expect(screen.getAllByText('N/A')).toHaveLength(2);
    expect(screen.getByText(/no prior week yet/i)).toBeDefined();
    expect(screen.getByText(/no prior week-to-date yet/i)).toBeDefined();
  });

  it('caps fill at 100% while showing uncapped minutes', () => {
    render(<WeeklyBaselineBar weekMinutes={187} weekEndsAt="2099-01-01T00:00:00.000Z" />);

    expect(screen.getByText('187 / 150 Min')).toBeDefined();
    expect(screen.getByTestId('weekly-baseline-fill').getAttribute('style')).toContain(
      'width: 100%'
    );
  });

  it('uses a scaled civilian baseline when provided', () => {
    render(
      <WeeklyBaselineBar
        weekMinutes={120}
        weekEndsAt="2099-01-01T00:00:00.000Z"
        baselineMinutes={120}
      />
    );

    expect(screen.getByText('120 / 120 Min')).toBeDefined();
    expect(screen.getByTestId('weekly-baseline-fill').getAttribute('style')).toContain(
      'width: 100%'
    );
  });

  it('compares this week to last week when prior minutes exist', () => {
    render(
      <WeeklyBaselineBar
        weekMinutes={180}
        weekEndsAt="2099-01-01T00:00:00.000Z"
        previousWeekMinutes={150}
      />
    );

    expect(screen.getByTestId('weekly-baseline-vs-last-week').textContent).toBe('+20%');
    expect(screen.getByText('150 min last week')).toBeDefined();
  });

  it('shows week-to-date minutes and share of baseline', () => {
    render(
      <WeeklyBaselineBar
        weekMinutes={75}
        weekEndsAt="2099-01-01T00:00:00.000Z"
        baselineMinutes={150}
      />
    );

    expect(screen.getByTestId('weekly-baseline-wtd').textContent).toBe('75 min');
    expect(screen.getByText('50% of baseline')).toBeDefined();
  });

  it('compares week-to-date against the same clock time last week', () => {
    vi.useFakeTimers();
    // One week after the early lock, before the later Thursday lock.
    vi.setSystemTime(new Date('2026-09-09T17:00:00.000Z'));

    render(
      <WeeklyBaselineBar
        weekMinutes={20}
        weekEndsAt="2099-01-01T00:00:00.000Z"
        previousWeek={previousWeek()}
      />
    );

    // Prior week had 10 min by this time; 20 now is +100%.
    expect(screen.getByTestId('weekly-baseline-wtd-vs-last-week').textContent).toBe('+100%');
    expect(screen.getByText('10 min by this time last week')).toBeDefined();
  });

  it('shows pace to baseline from how much of the week remains', () => {
    vi.useFakeTimers();
    const weekEndsAt = '2026-09-14T07:00:00.000Z';
    // Halfway through the week with only 40 of ~75 expected.
    vi.setSystemTime(new Date(Date.parse(weekEndsAt) - 3.5 * 24 * 60 * 60 * 1000));

    render(<WeeklyBaselineBar weekMinutes={40} weekEndsAt={weekEndsAt} baselineMinutes={150} />);

    expect(screen.getByTestId('weekly-baseline-pace').textContent).toBe('Behind pace');
    expect(screen.getByText(/Need 110 min over/)).toBeDefined();
  });
});
