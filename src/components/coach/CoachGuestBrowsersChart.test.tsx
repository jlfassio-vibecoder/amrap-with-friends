import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CoachGuestBrowsersChart } from '@/components/coach/CoachGuestBrowsersChart';

describe('CoachGuestBrowsersChart', () => {
  it('shows an empty state when every bucket is zero', () => {
    render(
      <CoachGuestBrowsersChart
        grain="day"
        points={[
          { bucketStart: '2026-09-01T00:00:00.000Z', count: 0 },
          { bucketStart: '2026-09-02T00:00:00.000Z', count: 0 },
        ]}
      />
    );

    expect(screen.getByTestId('guest-browsers-chart-empty')).toBeTruthy();
  });

  it('renders bars for short series and a polyline for long series', () => {
    const { rerender } = render(
      <CoachGuestBrowsersChart
        grain="day"
        points={[
          { bucketStart: '2026-09-01T00:00:00.000Z', count: 2 },
          { bucketStart: '2026-09-02T00:00:00.000Z', count: 5 },
        ]}
      />
    );

    expect(
      screen.getByTestId('guest-browsers-chart').querySelectorAll('rect').length
    ).toBeGreaterThan(0);

    rerender(
      <CoachGuestBrowsersChart
        grain="day"
        points={Array.from({ length: 120 }, (_, index) => ({
          bucketStart: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
          count: (index % 4) + 1,
        }))}
      />
    );

    expect(screen.getByTestId('guest-browsers-chart').querySelector('polyline')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the guest count on hover and marks bars with notes', () => {
    const onSelect = vi.fn();
    render(
      <CoachGuestBrowsersChart
        grain="day"
        notesByBucket={{ '2026-09-02T00:00:00.000Z': 'Launch spike' }}
        onSelectBucket={onSelect}
        points={[
          { bucketStart: '2026-09-01T00:00:00.000Z', count: 2 },
          { bucketStart: '2026-09-02T00:00:00.000Z', count: 26 },
        ]}
      />
    );

    expect(screen.getByTestId('guest-browsers-note-marker-2026-09-02T00:00:00.000Z')).toBeTruthy();

    fireEvent.mouseEnter(screen.getByTestId('guest-browsers-bar-2026-09-02T00:00:00.000Z'));
    expect(screen.getByTestId('guest-browsers-tooltip').textContent).toContain('26 guests');
    expect(screen.getByTestId('guest-browsers-tooltip').textContent).toContain('Launch spike');

    fireEvent.click(screen.getByTestId('guest-browsers-bar-2026-09-01T00:00:00.000Z'));
    expect(onSelect).toHaveBeenCalledWith('2026-09-01T00:00:00.000Z');
  });
});
