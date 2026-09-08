import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ScoreTrendChart } from '@/components/hud/ScoreTrendChart';
import type { ScoreTrendWeek } from '@/lib/hud/scoreTrend';

afterEach(() => {
  cleanup();
});

function week(weekStart: string, overrides: Partial<ScoreTrendWeek> = {}): ScoreTrendWeek {
  return {
    weekStart,
    totalScore: 0,
    totalMinutes: 0,
    missionCount: 0,
    scorePerMinute: null,
    ...overrides,
  };
}

describe('ScoreTrendChart', () => {
  it('shows an empty-history message and no chart when nothing is logged', () => {
    const weeks = [week('2026-08-24'), week('2026-08-31'), week('2026-09-07')];
    render(<ScoreTrendChart weeks={weeks} />);

    expect(screen.getByText(/No locked missions yet/)).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('headlines the current (last) week’s score', () => {
    const weeks = [
      week('2026-08-31', {
        totalScore: 200,
        totalMinutes: 20,
        missionCount: 1,
        scorePerMinute: 10,
      }),
      week('2026-09-07', {
        totalScore: 260,
        totalMinutes: 20,
        missionCount: 1,
        scorePerMinute: 13,
      }),
    ];
    render(<ScoreTrendChart weeks={weeks} />);

    // "260" appears in the hero figure, the SVG direct label, and the table
    // row — all three are correct, so assert presence rather than one spot.
    expect(screen.getAllByText('260').length).toBeGreaterThan(0);
    expect(screen.getByText('+30% vs last week')).toBeTruthy();
  });

  it('omits the delta with only one week of history', () => {
    const weeks = [
      week('2026-09-07', {
        totalScore: 260,
        totalMinutes: 20,
        missionCount: 1,
        scorePerMinute: 13,
      }),
    ];
    render(<ScoreTrendChart weeks={weeks} />);

    expect(screen.queryByText(/vs last week/)).toBeNull();
  });

  it('calls out an intensity shift when minutes held flat but score moved', () => {
    const weeks = [
      week('2026-08-31', { totalScore: 200, totalMinutes: 40, missionCount: 2, scorePerMinute: 5 }),
      week('2026-09-07', {
        totalScore: 260,
        totalMinutes: 41,
        missionCount: 2,
        scorePerMinute: 6.3,
      }),
    ];
    render(<ScoreTrendChart weeks={weeks} />);

    expect(screen.getByText(/Same time, different intensity/)).toBeTruthy();
  });

  it('does not call out an intensity shift when minutes moved too', () => {
    const weeks = [
      week('2026-08-31', { totalScore: 200, totalMinutes: 40, missionCount: 2, scorePerMinute: 5 }),
      week('2026-09-07', {
        totalScore: 260,
        totalMinutes: 60,
        missionCount: 3,
        scorePerMinute: 4.3,
      }),
    ];
    render(<ScoreTrendChart weeks={weeks} />);

    expect(screen.queryByText(/Same time, different intensity/)).toBeNull();
  });

  it('lists every week in the table, oldest first, with score, minutes, and score/min', () => {
    const weeks = [
      week('2026-08-31', {
        totalScore: 200,
        totalMinutes: 20,
        missionCount: 1,
        scorePerMinute: 10,
      }),
      week('2026-09-07', {
        totalScore: 260,
        totalMinutes: 20,
        missionCount: 1,
        scorePerMinute: 13,
      }),
    ];
    render(<ScoreTrendChart weeks={weeks} />);

    const table = screen.getByRole('table');
    const rows = table.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('200');
    expect(rows[1].textContent).toContain('260');
  });

  it('shows an em dash rather than a number for a week with no minutes logged', () => {
    const weeks = [
      week('2026-09-07', { totalScore: 0, totalMinutes: 0, missionCount: 0 }),
      week('2026-09-14', {
        totalScore: 100,
        totalMinutes: 10,
        missionCount: 1,
        scorePerMinute: 10,
      }),
    ];
    render(<ScoreTrendChart weeks={weeks} />);

    const table = screen.getByRole('table');
    const rows = table.querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('—');
  });

  it('draws one bar per week with a score, and no bar for a zero week', () => {
    const weeks = [
      week('2026-08-31', { totalScore: 0, totalMinutes: 0, missionCount: 0 }),
      week('2026-09-07', {
        totalScore: 200,
        totalMinutes: 20,
        missionCount: 1,
        scorePerMinute: 10,
      }),
    ];
    const { container } = render(<ScoreTrendChart weeks={weeks} />);

    expect(container.querySelectorAll('svg path')).toHaveLength(1);
  });
});
