import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { WeeklyBaselineBar } from './WeeklyBaselineBar';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('WeeklyBaselineBar', () => {
  it('shows empty fill and locked-session copy when weekMinutes is 0', () => {
    render(
      <WeeklyBaselineBar
        weekMinutes={0}
        weekPviAverage={null}
        weekEndsAt="2099-01-01T00:00:00.000Z"
      />
    );

    expect(screen.getByText('0 / 150 Min')).toBeDefined();
    expect(screen.getByTestId('weekly-baseline-fill').getAttribute('style')).toContain(
      'width: 0%'
    );
    expect(screen.getByText(/only locked scores count/i)).toBeDefined();
    expect(screen.getByText('N/A')).toBeDefined();
  });

  it('caps fill at 100% while showing uncapped minutes', () => {
    render(
      <WeeklyBaselineBar
        weekMinutes={187}
        weekPviAverage={12.8}
        weekEndsAt="2099-01-01T00:00:00.000Z"
      />
    );

    expect(screen.getByText('187 / 150 Min')).toBeDefined();
    expect(screen.getByTestId('weekly-baseline-fill').getAttribute('style')).toContain(
      'width: 100%'
    );
    expect(screen.getByText('12.8%')).toBeDefined();
  });

  it('uses a scaled civilian baseline when provided', () => {
    render(
      <WeeklyBaselineBar
        weekMinutes={120}
        weekPviAverage={null}
        weekEndsAt="2099-01-01T00:00:00.000Z"
        baselineMinutes={120}
      />
    );

    expect(screen.getByText('120 / 120 Min')).toBeDefined();
    expect(screen.getByTestId('weekly-baseline-fill').getAttribute('style')).toContain(
      'width: 100%'
    );
  });
});
