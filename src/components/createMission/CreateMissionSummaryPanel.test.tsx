import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CreateMissionSummaryPanel } from './CreateMissionSummaryPanel';
import { WORKOUT_TEMPLATES } from '@/data/workoutTemplates';

afterEach(() => {
  cleanup();
});

const baseProps = {
  nickname: 'Host',
  durationMinutes: 10,
  selectedDomain: 10 as const,
  workoutSource: 'custom' as const,
  selectedTemplate: null,
  selectedCoachWorkout: null,
  rallyDay: 'today' as const,
  rallyTime: '18:00',
  error: null,
  loading: false,
  onNicknameChange: () => undefined,
  onDurationChange: () => undefined,
  onCapChange: () => undefined,
  onScheduleModeChange: () => undefined,
  onRallyDayChange: () => undefined,
  onRallyTimeChange: () => undefined,
  onSubmit: (event: { preventDefault: () => void }) => {
    event.preventDefault();
  },
};

describe('CreateMissionSummaryPanel', () => {
  it('shows Launch by default and Schedule rally point time controls when selected', () => {
    const { rerender } = render(
      <CreateMissionSummaryPanel {...baseProps} scheduleMode="now" capReached={false} />
    );

    expect(screen.getByRole('button', { name: 'Launch' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Open rally point' })).toBeTruthy();
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
    expect(screen.getByRole('button', { name: 'Launch' })).toHaveProperty('disabled', true);
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

  it('labels the preview as the first of a chain', () => {
    render(
      <CreateMissionSummaryPanel
        {...baseProps}
        workoutSource="library"
        selectedTemplate={WORKOUT_TEMPLATES[0]!}
        chainedWorkoutCount={3}
        scheduleMode="now"
        capReached={false}
        hidePageTimeCap
      />
    );

    expect(screen.getByText('First workout of 3 workouts')).toBeTruthy();
    expect(screen.queryByText('Selected workout')).toBeNull();
  });
});
