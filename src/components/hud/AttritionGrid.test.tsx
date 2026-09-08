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

  it('draws the current week first when there is no week detail yet', () => {
    // Only the newest bucket is compliant — it must be the leftmost cell.
    const attrition = Array.from({ length: 12 }, (_, index) => index === 11);
    render(<AttritionGrid attrition={attrition} weekEndsAt="2026-08-25T07:00:00.000Z" />);

    const cells = screen.getAllByLabelText(/Week of .*: (compliant|deficient)/);
    expect(cells[0]!.getAttribute('aria-label')).toMatch(/: compliant$/);
    expect(cells[1]!.getAttribute('aria-label')).toMatch(/: deficient$/);
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

  it('becomes selectable once per-week detail arrives, newest first', () => {
    const onSelect = vi.fn();
    const counts = Array.from({ length: 12 }, (_, index) => (index === 11 ? 3 : 0));
    render(
      <AttritionGrid
        attrition={Array.from({ length: 12 }, () => true)}
        weekEndsAt="2026-08-25T07:00:00.000Z"
        weeks={historyWeeks(counts)}
        selectedIndex={null}
        onSelect={onSelect}
      />
    );

    const cells = screen.getAllByRole('button');
    expect(cells).toHaveLength(12);
    // Leftmost cell is the current week (data index 11).
    expect(cells[0]!.getAttribute('aria-label')).toMatch(/3 missions$/);

    fireEvent.click(cells[0]!);
    expect(onSelect).toHaveBeenCalledWith(11);
  });

  it('fills weeks that logged missions even when they missed the quota', () => {
    // One mission → deficient for the Civilian quota, but still "has data".
    const counts = [1, ...Array.from({ length: 11 }, () => 0)];
    render(
      <AttritionGrid
        attrition={Array.from({ length: 12 }, () => false)}
        weekEndsAt="2026-08-25T07:00:00.000Z"
        weeks={historyWeeks(counts)}
        selectedIndex={null}
        onSelect={vi.fn()}
      />
    );

    const withData = screen.getByLabelText(/deficient, 1 mission$/);
    expect(withData.className).toContain('bg-accent');
    expect(withData.className).not.toContain('bg-transparent');

    const empty = screen.getAllByLabelText(/deficient, 0 missions$/);
    expect(empty).toHaveLength(11);
    expect(empty[0]!.className).toContain('bg-transparent');
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

    const buttons = screen.getAllByRole('button');
    const pressed = buttons.filter((cell) => cell.getAttribute('aria-pressed') === 'true');
    expect(pressed).toHaveLength(1);
    // data index 7 → display position 11 - 7 = 4 from the left.
    expect(buttons[4]).toBe(pressed[0]);
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
