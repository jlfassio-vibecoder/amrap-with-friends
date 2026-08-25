import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditRallyScheduleForm } from './EditRallyScheduleForm';

const updateSessionScheduledAtMock = vi.fn();
const TEST_TIME_ZONE = 'America/Los_Angeles';

vi.mock('@/lib/api/sessions', () => ({
  updateSessionScheduledAt: (...args: unknown[]) =>
    updateSessionScheduledAtMock(...args),
}));

const SESSION_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
    locale: 'en-US',
    calendar: 'gregory',
    numberingSystem: 'latn',
    timeZone: TEST_TIME_ZONE,
  });
});

afterEach(() => {
  cleanup();
  updateSessionScheduledAtMock.mockReset();
  vi.restoreAllMocks();
});

describe('EditRallyScheduleForm', () => {
  it('prefills day and time from scheduledAt', () => {
    vi.setSystemTime(new Date('2026-08-25T04:00:00.000Z'));

    render(
      <EditRallyScheduleForm
        sessionId={SESSION_ID}
        scheduledAt="2026-08-25T05:00:00.000Z"
      />
    );

    expect(screen.getByRole('tab', { name: 'Today', selected: true })).toBeTruthy();
    expect(screen.getByDisplayValue('22:00')).toBeTruthy();

    vi.useRealTimers();
  });

  it('shows validation error for invalid rally time', async () => {
    vi.setSystemTime(new Date('2026-08-25T04:00:00.000Z'));

    render(
      <EditRallyScheduleForm
        sessionId={SESSION_ID}
        scheduledAt="2026-08-25T05:00:00.000Z"
      />
    );

    fireEvent.change(screen.getByDisplayValue('22:00'), {
      target: { value: '01:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('Rally time must be today or tomorrow, and in the future.')
    ).toBeTruthy();
    expect(updateSessionScheduledAtMock).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('calls updateSessionScheduledAt and onSaved on success', async () => {
    vi.setSystemTime(new Date('2026-08-25T04:00:00.000Z'));
    const onSaved = vi.fn();
    updateSessionScheduledAtMock.mockResolvedValue({
      data: { scheduledAt: '2026-08-25T16:30:00.000Z' },
      error: null,
    });

    render(
      <EditRallyScheduleForm
        sessionId={SESSION_ID}
        scheduledAt="2026-08-25T05:00:00.000Z"
        onSaved={onSaved}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Tomorrow' }));
    fireEvent.change(screen.getByDisplayValue('22:00'), {
      target: { value: '09:30' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(updateSessionScheduledAtMock).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        scheduledAt: '2026-08-25T16:30:00.000Z',
      });
    });
    expect(onSaved).toHaveBeenCalledWith('2026-08-25T16:30:00.000Z');

    vi.useRealTimers();
  });

  it('shows cancel button when onCancel is provided', () => {
    vi.setSystemTime(new Date('2026-08-25T04:00:00.000Z'));
    const onCancel = vi.fn();
    render(
      <EditRallyScheduleForm
        sessionId={SESSION_ID}
        scheduledAt="2026-08-25T05:00:00.000Z"
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();

    vi.useRealTimers();
  });
});
