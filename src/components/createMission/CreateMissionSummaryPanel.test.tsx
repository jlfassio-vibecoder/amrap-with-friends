import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CreateMissionSummaryPanel } from './CreateMissionSummaryPanel';

afterEach(() => {
  cleanup();
});

const baseProps = {
  nickname: 'Host',
  durationMinutes: 10,
  workoutSource: 'custom' as const,
  selectedTemplate: null,
  selectedCoachWorkout: null,
  rallyDay: 'today' as const,
  rallyTime: '18:00',
  error: null,
  loading: false,
  onNicknameChange: () => undefined,
  onDurationChange: () => undefined,
  onScheduleModeChange: () => undefined,
  onRallyDayChange: () => undefined,
  onRallyTimeChange: () => undefined,
  onSubmit: (event: { preventDefault: () => void }) => {
    event.preventDefault();
  },
};

describe('CreateMissionSummaryPanel', () => {
  it('shows Open rally point by default and Schedule rally point time controls when selected', () => {
    const { rerender } = render(
      <CreateMissionSummaryPanel {...baseProps} scheduleMode="now" capReached={false} />
    );

    expect(screen.getByRole('button', { name: 'Open rally point' })).toBeTruthy();
    expect(screen.queryByLabelText('Scheduled time')).toBeNull();

    rerender(<CreateMissionSummaryPanel {...baseProps} scheduleMode="rally" capReached={false} />);

    expect(screen.getByRole('button', { name: 'Schedule rally point' })).toBeTruthy();
    expect(screen.getByLabelText('Scheduled time')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Today' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Tomorrow' })).toBeTruthy();
  });

  it('warns and disables submit at the host mission cap', () => {
    render(<CreateMissionSummaryPanel {...baseProps} scheduleMode="now" capReached />);

    expect(screen.getByText(/3 active missions/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open rally point' })).toHaveProperty(
      'disabled',
      true
    );
  });

  it('switches schedule mode via the tabs', () => {
    const onScheduleModeChange = vi.fn();
    render(
      <CreateMissionSummaryPanel
        {...baseProps}
        scheduleMode="now"
        capReached={false}
        onScheduleModeChange={onScheduleModeChange}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Schedule rally point' }));
    expect(onScheduleModeChange).toHaveBeenCalledWith('rally');
  });
});
