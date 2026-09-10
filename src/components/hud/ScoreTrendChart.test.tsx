import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ScoreTrendChart } from '@/components/hud/ScoreTrendChart';
import type { ScoreTrendWeek } from '@/lib/hud/scoreTrend';

afterEach(() => {
  cleanup();
});

// weekStart carries a local time-of-day (T12:00:00, no 'Z'), not a bare
// date, matching what buildScoreTrend actually emits (a full ISO string from
// Date#toISOString()). A bare "YYYY-MM-DD" parses as UTC midnight, which
// `formatWeekLabel`'s toLocaleDateString can shift onto the wrong local day
// depending on the machine's timezone — fixture noise, not a real scenario.
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
    const weeks = [
      week('2026-08-24T12:00:00'),
      week('2026-08-31T12:00:00'),
      week('2026-09-07T12:00:00'),
    ];
    render(<ScoreTrendChart weeks={weeks} />);

    expect(screen.getByText(/No locked missions yet/)).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('headlines the current (last) week’s score', () => {
    const weeks = [
      week('2026-08-31T12:00:00', {
        totalScore: 200,
        totalMinutes: 20,
        missionCount: 1,
        scorePerMinute: 10,
      }),
      week('2026-09-07T12:00:00', {
        totalScore: 260,
        totalMinutes: 20,
        missionCount: 1,
        scorePerMinute: 13,
      }),
    ];
    render(<ScoreTrendChart weeks={weeks} />);

    // Hero figure and SVG label both show 260.
    expect(screen.getAllByText('260').length).toBeGreaterThan(0);
    expect(screen.getByText('+30% vs last week')).toBeTruthy();
  });

  it('omits the delta with only one week of history', () => {
    const weeks = [
      week('2026-09-07T12:00:00', {
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
      week('2026-08-31T12:00:00', {
        totalScore: 200,
        totalMinutes: 40,
        missionCount: 2,
        scorePerMinute: 5,
      }),
      week('2026-09-07T12:00:00', {
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
      week('2026-08-31T12:00:00', {
        totalScore: 200,
        totalMinutes: 40,
        missionCount: 2,
        scorePerMinute: 5,
      }),
      week('2026-09-07T12:00:00', {
        totalScore: 260,
        totalMinutes: 60,
        missionCount: 3,
        scorePerMinute: 4.3,
      }),
    ];
    render(<ScoreTrendChart weeks={weeks} />);

    expect(screen.queryByText(/Same time, different intensity/)).toBeNull();
  });

  it('does not render a week-by-week score table', () => {
    const weeks = [
      week('2026-08-31T12:00:00', {
        totalScore: 200,
        totalMinutes: 20,
        missionCount: 1,
        scorePerMinute: 10,
      }),
      week('2026-09-07T12:00:00', {
        totalScore: 260,
        totalMinutes: 20,
        missionCount: 1,
        scorePerMinute: 13,
      }),
    ];
    render(<ScoreTrendChart weeks={weeks} />);

    expect(screen.queryByRole('table')).toBeNull();
  });

  it('caps the chart SVG height for a compact hero', () => {
    const weeks = [
      week('2026-09-07T12:00:00', {
        totalScore: 200,
        totalMinutes: 20,
        missionCount: 1,
        scorePerMinute: 10,
      }),
    ];
    const { container } = render(<ScoreTrendChart weeks={weeks} />);
    const svg = container.querySelector('svg');
    expect(svg?.className.baseVal || svg?.getAttribute('class')).toContain('max-h-[200px]');
  });

  it('highlights the selected week band on the chart', () => {
    const weeks = [
      week('2026-08-31T12:00:00', {
        totalScore: 200,
        totalMinutes: 20,
        missionCount: 1,
        scorePerMinute: 10,
      }),
      week('2026-09-07T12:00:00', {
        totalScore: 260,
        totalMinutes: 20,
        missionCount: 1,
        scorePerMinute: 13,
      }),
    ];
    render(<ScoreTrendChart weeks={weeks} selectedIndex={0} />);

    expect(screen.getByTestId('score-trend-selected-band')).toBeTruthy();
    expect(screen.getByTestId('score-trend-selected-bar')).toBeTruthy();
  });

  it('draws one bar per week with a score, and no bar for a zero week', () => {
    const weeks = [
      week('2026-08-31T12:00:00', { totalScore: 0, totalMinutes: 0, missionCount: 0 }),
      week('2026-09-07T12:00:00', {
        totalScore: 200,
        totalMinutes: 20,
        missionCount: 1,
        scorePerMinute: 10,
      }),
    ];
    const { container } = render(<ScoreTrendChart weeks={weeks} />);

    expect(container.querySelectorAll('svg path')).toHaveLength(1);
  });

  it('gives every gridline tick a distinct label even at a ceiling of 1', () => {
    // A single week with a score of 1 forces niceCeiling to its floor: 1.
    // Gridlines land at 0, 0.5, and 1 — Math.round(0.5) would collapse the
    // midline into the same "1" as the top tick.
    const weeks = [week('2026-09-07T12:00:00', { totalScore: 1, missionCount: 1 })];
    const { container } = render(<ScoreTrendChart weeks={weeks} />);

    // Gridlines render first, before any per-week label, so the first three
    // <text> nodes in document order are the 0 / mid / ceiling ticks.
    const tickLabels = [...container.querySelectorAll('svg text')]
      .slice(0, 3)
      .map((el) => el.textContent);
    expect(tickLabels).toEqual(['0', '0.5', '1']);
  });

  it('thins the date labels at twelve weeks so they cannot collide', () => {
    // Twelve bands are ~27px wide; a short-date label is wider than that, so
    // only every other one is drawn — counted back from the current week, so
    // that one is always labelled.
    const weeks = Array.from({ length: 12 }, (_, index) =>
      week(new Date(2026, 5, 1 + index * 7).toISOString(), {
        totalScore: 100 + index,
        totalMinutes: 20,
        missionCount: 1,
        scorePerMinute: 5,
      })
    );
    const { container } = render(<ScoreTrendChart weeks={weeks} />);

    // Derive expected labels the same way the chart does — do not hard-code an
    // English month name that fails under a non-en locale.
    const formatLabel = (iso: string) =>
      new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const expectedDates = new Set(weeks.map((row) => formatLabel(row.weekStart)));

    // 3 gridline ticks + 1 direct label on the current bar + the date labels.
    const dateLabels = [...container.querySelectorAll('svg text')].filter((el) =>
      expectedDates.has(el.textContent ?? '')
    );
    expect(dateLabels).toHaveLength(6);
    expect(dateLabels[dateLabels.length - 1].textContent).toBe(
      formatLabel(weeks[weeks.length - 1]!.weekStart)
    );
  });
});
