import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ActivityAttributionCard } from './ActivityAttributionCard';
import { ActivityWindowSummaryCard } from './ActivityWindowSummaryCard';
import { InAppActivitySummaryCard } from './InAppActivitySummaryCard';
import { OutsideActivitySummaryCard } from './OutsideActivitySummaryCard';
import type { PhysicalActivityEntry } from '@/lib/api/physicalActivity';

afterEach(() => {
  cleanup();
});

describe('ActivityWindowSummaryCard', () => {
  it('renders stats and empty intensity dash', () => {
    render(
      <ActivityWindowSummaryCard
        title="Test Activity — Last 7 Days"
        ariaLabel="Test activity summary"
        missionCount={0}
        totalMinutes={0}
        averageIntensity={null}
        footer="Counts toward activity."
      />
    );

    expect(screen.getByRole('region', { name: 'Test activity summary' })).toBeDefined();
    expect(screen.getByText('Test Activity — Last 7 Days')).toBeDefined();
    expect(screen.getByText('—')).toBeDefined();
    expect(screen.getByText('Counts toward activity.')).toBeDefined();
  });
});

describe('InAppActivitySummaryCard', () => {
  it('shows in-app title and counts footer', () => {
    render(
      <InAppActivitySummaryCard activity7d={{ missionCount: 2, minutes: 40, avgIntensity: 2.5 }} />
    );

    expect(screen.getByText('In-App Activity — Last 7 Days')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('40')).toBeDefined();
    expect(screen.getByText('2.5')).toBeDefined();
    expect(screen.getByText('Counts toward activity.')).toBeDefined();
  });
});

describe('OutsideActivitySummaryCard', () => {
  it('keeps outside disclaimer and rolls last 7 days', () => {
    const now = Date.now();
    const entries: PhysicalActivityEntry[] = [
      {
        id: '1',
        activityType: 'run',
        activityCategory: 'cardio',
        activityLabel: 'Run',
        durationMinutes: 30,
        intensityTier: 3,
        occurredAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
        notes: null,
        createdAt: new Date().toISOString(),
      },
    ];

    render(<OutsideActivitySummaryCard entries={entries} />);

    expect(screen.getByText('Outside Activity — Last 7 Days')).toBeDefined();
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('30')).toBeDefined();
    expect(screen.getByText('3.0')).toBeDefined();
    expect(screen.getByText('Does not count toward weekly classification minutes.')).toBeDefined();
  });
});

describe('ActivityAttributionCard', () => {
  it('renders empty copy when no minutes', () => {
    render(
      <ActivityAttributionCard
        inAppMissions={0}
        outsideMissions={0}
        inAppMinutes={0}
        outsideMinutes={0}
      />
    );

    expect(screen.getByText('Total activity — Last 7 days')).toBeDefined();
    expect(screen.getByText(/No activity logged/i)).toBeDefined();
  });

  it('sizes in-app and outside segments by minutes', () => {
    render(
      <ActivityAttributionCard
        inAppMissions={2}
        outsideMissions={1}
        inAppMinutes={40}
        outsideMinutes={60}
      />
    );

    expect(screen.getByText('3 missions · 100 min')).toBeDefined();
    expect(screen.getByTestId('activity-attribution-in-app').getAttribute('style')).toContain(
      'width: 40%'
    );
    expect(screen.getByTestId('activity-attribution-outside').getAttribute('style')).toContain(
      'width: 60%'
    );
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('40');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuemax')).toBe('100');
  });
});
