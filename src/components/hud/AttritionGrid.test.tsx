import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AttritionGrid } from './AttritionGrid';
import type { HudHistoryWeek } from '@/lib/hud/types';

afterEach(() => {
  cleanup();
});

function historyWeeks(missionCounts: number[]): HudHistoryWeek[] {
  return missionCounts.map((missionCount, index) => {
    const start = new Date(2026, 5, 1);
    start.setDate(start.getDate() + index * 7);
    return {
      weekStart: start.toISOString(),
      minutes: missionCount * 20,
      compliant: missionCount > 2,
      missionCount,
      score: missionCount * 200,
      pviAverage: missionCount > 0 ? 6.4 : null,
      missions: [],
    };
  });
}

describe('AttritionGrid', () => {
  it('renders 12 cells with compliant and deficient labels', () => {
    const attrition = Array.from({ length: 12 }, (_, index) => index === 11);

    render(<AttritionGrid attrition={attrition} weekEndsAt="2026-08-25T07:00:00.000Z" />);

    const cells = screen.getAllByLabelText(/Week of .*: (compliant|deficient)/);
    expect(cells).toHaveLength(12);
    expect(screen.getByLabelText(/: compliant$/)).toBeDefined();
    expect(screen.getAllByLabelText(/: deficient$/).length).toBe(11);
  });

  it('stays inert against a server that sends no week detail', () => {
    // The migration may not have run yet; the strip must still render, just
    // without becoming a navigator.
    render(
      <AttritionGrid
        attrition={Array.from({ length: 12 }, () => false)}
        weekEndsAt="2026-08-25T07:00:00.000Z"
        onSelect={vi.fn()}
      />
    );

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByText(/Select a week/)).toBeNull();
  });

  it('becomes selectable once per-week detail arrives', () => {
    const onSelect = vi.fn();
    render(
      <AttritionGrid
        attrition={Array.from({ length: 12 }, () => true)}
        weekEndsAt="2026-08-25T07:00:00.000Z"
        weeks={historyWeeks(Array.from({ length: 12 }, () => 3))}
        selectedIndex={null}
        onSelect={onSelect}
      />
    );

    const cells = screen.getAllByRole('button');
    expect(cells).toHaveLength(12);

    fireEvent.click(cells[4]);
    expect(onSelect).toHaveBeenCalledWith(4);
  });

  it('marks only the selected week as pressed', () => {
    render(
      <AttritionGrid
        attrition={Array.from({ length: 12 }, () => true)}
        weekEndsAt="2026-08-25T07:00:00.000Z"
        weeks={historyWeeks(Array.from({ length: 12 }, () => 1))}
        selectedIndex={7}
        onSelect={vi.fn()}
      />
    );

    const pressed = screen
      .getAllByRole('button')
      .filter((cell) => cell.getAttribute('aria-pressed') === 'true');
    expect(pressed).toHaveLength(1);
    expect(screen.getAllByRole('button')[7]).toBe(pressed[0]);
  });

  it('names the week span and its mission count for a screen reader', () => {
    render(
      <AttritionGrid
        attrition={Array.from({ length: 12 }, () => true)}
        weekEndsAt="2026-08-25T07:00:00.000Z"
        weeks={historyWeeks([1, ...Array.from({ length: 11 }, () => 3)])}
        selectedIndex={null}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/compliant, 1 mission$/)).toBeDefined();
    expect(screen.getAllByLabelText(/compliant, 3 missions$/).length).toBe(11);
  });
});
