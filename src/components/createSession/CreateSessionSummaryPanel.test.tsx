import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CreateSessionSummaryPanel } from './CreateSessionSummaryPanel';

afterEach(() => {
  cleanup();
});

const baseProps = {
  nickname: 'Host',
  durationMinutes: 10,
  workoutSource: 'custom' as const,
  selectedTemplate: null,
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

describe('CreateSessionSummaryPanel', () => {
  it('shows Start now by default and Schedule rally time controls when selected', () => {
    const { rerender } = render(
      <CreateSessionSummaryPanel
        {...baseProps}
        scheduleMode="now"
        capReached={false}
      />
    );

    expect(screen.getByRole('button', { name: 'Start now' })).toBeTruthy();
    expect(screen.queryByLabelText('Time')).toBeNull();

    rerender(
      <CreateSessionSummaryPanel
        {...baseProps}
        scheduleMode="rally"
        capReached={false}
      />
    );

    expect(screen.getByRole('button', { name: 'Schedule rally' })).toBeTruthy();
    expect(screen.getByLabelText('Time')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Today' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Tomorrow' })).toBeTruthy();
  });

  it('warns and disables submit at the host session cap', () => {
    render(
      <CreateSessionSummaryPanel
        {...baseProps}
        scheduleMode="now"
        capReached
      />
    );

    expect(screen.getByText(/3 active sessions/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start now' })).toHaveProperty(
      'disabled',
      true
    );
  });

  it('switches schedule mode via the tabs', () => {
    const onScheduleModeChange = vi.fn();
    render(
      <CreateSessionSummaryPanel
        {...baseProps}
        scheduleMode="now"
        capReached={false}
        onScheduleModeChange={onScheduleModeChange}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Schedule rally' }));
    expect(onScheduleModeChange).toHaveBeenCalledWith('rally');
  });
});
