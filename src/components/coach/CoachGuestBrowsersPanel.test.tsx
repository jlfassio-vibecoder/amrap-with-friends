import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CoachGuestBrowsersPanel } from '@/components/coach/CoachGuestBrowsersPanel';

const fetchSeriesMock = vi.fn();
const fetchNotesMock = vi.fn();
const upsertNoteMock = vi.fn();

vi.mock('@/lib/api/coach', () => ({
  fetchCoachGuestBrowsersSeries: (...args: unknown[]) => fetchSeriesMock(...args),
  fetchCoachChartNotesForRange: (...args: unknown[]) => fetchNotesMock(...args),
  upsertCoachChartNote: (...args: unknown[]) => upsertNoteMock(...args),
}));

describe('CoachGuestBrowsersPanel', () => {
  beforeEach(() => {
    fetchSeriesMock.mockReset();
    fetchNotesMock.mockReset();
    upsertNoteMock.mockReset();
    fetchSeriesMock.mockResolvedValue({
      data: {
        window: '7d',
        grain: 'day',
        total: 53,
        points: [
          { bucketStart: '2026-09-01T00:00:00.000Z', count: 4 },
          { bucketStart: '2026-09-02T00:00:00.000Z', count: 7 },
        ],
      },
      error: null,
    });
    fetchNotesMock.mockResolvedValue({
      data: [
        {
          bucketStart: '2026-09-02T00:00:00.000Z',
          body: 'Existing note',
          updatedAt: '2026-09-05T12:00:00.000Z',
          updatedBy: '11111111-1111-4111-8111-111111111111',
        },
      ],
      error: null,
    });
    upsertNoteMock.mockResolvedValue({
      data: {
        deleted: false,
        note: {
          bucketStart: '2026-09-01T00:00:00.000Z',
          body: 'Saved note',
          updatedAt: '2026-09-05T13:00:00.000Z',
          updatedBy: '11111111-1111-4111-8111-111111111111',
        },
      },
      error: null,
    });
  });

  it('loads the default 7d window, notes, and saves a bar note', async () => {
    const onDismiss = vi.fn();
    render(<CoachGuestBrowsersPanel onDismiss={onDismiss} />);

    await waitFor(() => {
      expect(fetchSeriesMock).toHaveBeenCalledWith('7d');
    });
    await waitFor(() => {
      expect(fetchNotesMock).toHaveBeenCalled();
    });
    expect(screen.getByText('53')).toBeTruthy();
    expect(screen.getByTestId('guest-browsers-note-marker-2026-09-02T00:00:00.000Z')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Past 24 Hours' }));
    await waitFor(() => {
      expect(fetchSeriesMock).toHaveBeenCalledWith('24h');
    });
    await waitFor(() => {
      expect(screen.getByTestId('guest-browsers-bar-2026-09-01T00:00:00.000Z')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('guest-browsers-bar-2026-09-01T00:00:00.000Z'));
    expect(screen.getByTestId('guest-browsers-note-editor')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Add a shared note for this bar…'), {
      target: { value: 'Saved note' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(upsertNoteMock).toHaveBeenCalledWith({
        metric: 'guest_browsers',
        grain: 'day',
        bucketStart: '2026-09-01T00:00:00.000Z',
        body: 'Saved note',
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
