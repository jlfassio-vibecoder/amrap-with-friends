import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { WeeklyVolumeTargetCard } from './WeeklyVolumeTargetCard';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('WeeklyVolumeTargetCard · OP TEMPO', () => {
  it('renders claimed target minutes, share of target, and subtitle', () => {
    render(
      <WeeklyVolumeTargetCard
        title="OP TEMPO"
        ariaLabel="Operational tempo"
        subtitle="Claimed SPECIAL OPS · 300 min · +150 over Civilian"
        weekMinutes={48}
        weekEndsAt="2099-01-01T00:00:00.000Z"
        targetMinutes={300}
        shareNoun="target"
        paceHeading="Pace to target"
        targetNoun="target"
        testIdPrefix="op-tempo"
      />
    );

    expect(screen.getByLabelText('Operational tempo')).toBeDefined();
    expect(screen.getByText('OP TEMPO')).toBeDefined();
    expect(screen.getByText('Claimed SPECIAL OPS · 300 min · +150 over Civilian')).toBeDefined();
    expect(screen.getByText('48 / 300 Min')).toBeDefined();
    expect(screen.getByTestId('op-tempo-wtd').textContent).toBe('48 min');
    expect(screen.getByText('16% of target')).toBeDefined();
    expect(screen.getByText('Pace to target')).toBeDefined();
  });

  it('shows Target met when volume clears the claimed quota', () => {
    vi.useFakeTimers();
    const weekEndsAt = '2026-09-14T07:00:00.000Z';
    vi.setSystemTime(new Date(Date.parse(weekEndsAt) - 3.5 * 24 * 60 * 60 * 1000));

    render(
      <WeeklyVolumeTargetCard
        title="OP TEMPO"
        ariaLabel="Operational tempo"
        weekMinutes={300}
        weekEndsAt={weekEndsAt}
        targetMinutes={300}
        shareNoun="target"
        paceHeading="Pace to target"
        targetNoun="target"
        testIdPrefix="op-tempo"
      />
    );

    expect(screen.getByTestId('op-tempo-pace').textContent).toBe('Target met');
  });
});
