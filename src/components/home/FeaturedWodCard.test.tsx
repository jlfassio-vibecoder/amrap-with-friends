import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FeaturedWodCard } from './FeaturedWodCard';
import type { FeaturedWod } from '@/lib/api/featuredWod';

const fetchCurrentFeaturedWodMock = vi.fn();
const trackMock = vi.fn();

vi.mock('@/lib/api/featuredWod', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/featuredWod')>(
    '@/lib/api/featuredWod'
  );
  return {
    ...actual,
    fetchCurrentFeaturedWod: (...args: unknown[]) => fetchCurrentFeaturedWodMock(...args),
  };
});

vi.mock('@/lib/analytics/track', () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

afterEach(() => {
  cleanup();
  fetchCurrentFeaturedWodMock.mockReset();
  trackMock.mockReset();
  vi.useRealTimers();
});

function featured(overrides: Partial<FeaturedWod> = {}): FeaturedWod {
  return {
    workoutName: 'Sunrise AMRAP',
    focus: 'Full body grind',
    durationMinutes: 20,
    intensityTier: 4,
    tags: ['functional fitness'],
    scheduledAt: '2026-09-01T13:00:00.000Z',
    sessionId: '22222222-2222-4222-8222-222222222222',
    state: 'waiting',
    startedAt: null,
    attendeeCount: 3,
    ...overrides,
  };
}

function renderCard() {
  return render(
    <MemoryRouter>
      <FeaturedWodCard />
    </MemoryRouter>
  );
}

describe('FeaturedWodCard', () => {
  it('renders nothing when there is no featured wod', async () => {
    fetchCurrentFeaturedWodMock.mockResolvedValue({ data: null, error: null });

    const { container } = renderCard();

    await waitFor(() => {
      expect(fetchCurrentFeaturedWodMock).toHaveBeenCalled();
    });
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when the fetch errors', async () => {
    fetchCurrentFeaturedWodMock.mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    });

    const { container } = renderCard();

    await waitFor(() => {
      expect(fetchCurrentFeaturedWodMock).toHaveBeenCalled();
    });
    expect(container.innerHTML).toBe('');
  });

  it('shows the joinable state with attendee count and a working join link', async () => {
    fetchCurrentFeaturedWodMock.mockResolvedValue({ data: featured(), error: null });

    renderCard();

    await waitFor(() => {
      expect(screen.getByText('Sunrise AMRAP')).toBeTruthy();
    });
    expect(screen.getByText(/3 joining/)).toBeTruthy();

    const joinLink = screen.getByRole('link', { name: 'Join lobby' });
    expect(joinLink.getAttribute('href')).toBe(
      '/join?s=22222222-2222-4222-8222-222222222222'
    );

    expect(trackMock).toHaveBeenCalledWith(
      'featured_wod_viewed',
      { joinable: true, state: 'waiting' }
    );
  });

  it('shows locked in-progress copy and hides join once work starts', async () => {
    const scheduledAt = new Date(Date.now() - 30_000).toISOString();
    fetchCurrentFeaturedWodMock.mockResolvedValue({
      data: featured({
        state: 'work',
        scheduledAt,
        startedAt: new Date(Date.now() - 20_000).toISOString(),
        durationMinutes: 15,
      }),
      error: null,
    });

    renderCard();

    await waitFor(() => {
      expect(screen.getByText('Session locked, amrap in progress.')).toBeTruthy();
    });
    expect(screen.queryByRole('link', { name: /Join/ })).toBeNull();
  });

  it('shows locked ended copy and hides join after the amrap completes', async () => {
    fetchCurrentFeaturedWodMock.mockResolvedValue({
      data: featured({ state: 'finished', attendeeCount: 2 }),
      error: null,
    });

    renderCard();

    await waitFor(() => {
      expect(screen.getByText('Session locked, AMRAP ended.')).toBeTruthy();
    });
    expect(screen.queryByRole('link', { name: /Join/ })).toBeNull();
  });

  it('shows a no-join message and no attendee count before the session is generated', async () => {
    fetchCurrentFeaturedWodMock.mockResolvedValue({
      data: featured({ sessionId: null, state: null, attendeeCount: null }),
      error: null,
    });

    renderCard();

    await waitFor(() => {
      expect(screen.getByText('Sunrise AMRAP')).toBeTruthy();
    });
    expect(screen.queryByRole('link', { name: /Join/ })).toBeNull();
    expect(screen.getByText('Lobby opens shortly before start.')).toBeTruthy();
    expect(screen.queryByText(/joining/)).toBeNull();
  });

  it('tracks featured_wod_joined when the join link is clicked', async () => {
    fetchCurrentFeaturedWodMock.mockResolvedValue({ data: featured(), error: null });

    renderCard();

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Join lobby' })).toBeTruthy();
    });

    screen.getByRole('link', { name: 'Join lobby' }).click();

    expect(trackMock).toHaveBeenCalledWith(
      'featured_wod_joined',
      { state: 'waiting' },
      { sessionId: '22222222-2222-4222-8222-222222222222' }
    );
  });

  it('re-polls every 20s and reflects an updated attendee count', async () => {
    vi.useFakeTimers();
    fetchCurrentFeaturedWodMock
      .mockResolvedValueOnce({ data: featured({ attendeeCount: 3 }), error: null })
      .mockResolvedValueOnce({ data: featured({ attendeeCount: 5 }), error: null });

    renderCard();

    await vi.waitFor(() => {
      expect(screen.getByText(/3 joining/)).toBeTruthy();
    });

    await vi.advanceTimersByTimeAsync(20_000);

    await vi.waitFor(() => {
      expect(screen.getByText(/5 joining/)).toBeTruthy();
    });
    expect(fetchCurrentFeaturedWodMock).toHaveBeenCalledTimes(2);
  });

  it('does not re-track a view on a poll tick that only refreshes attendee count', async () => {
    vi.useFakeTimers();
    fetchCurrentFeaturedWodMock
      .mockResolvedValueOnce({ data: featured({ attendeeCount: 3 }), error: null })
      .mockResolvedValueOnce({ data: featured({ attendeeCount: 5 }), error: null });

    renderCard();

    await vi.waitFor(() => {
      expect(screen.getByText(/3 joining/)).toBeTruthy();
    });
    expect(trackMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(20_000);

    await vi.waitFor(() => {
      expect(screen.getByText(/5 joining/)).toBeTruthy();
    });
    expect(trackMock).toHaveBeenCalledTimes(1);
  });

  it('tracks a new view when a session gets generated between poll ticks', async () => {
    vi.useFakeTimers();
    fetchCurrentFeaturedWodMock
      .mockResolvedValueOnce({
        data: featured({ sessionId: null, state: null, attendeeCount: null }),
        error: null,
      })
      .mockResolvedValueOnce({ data: featured({ sessionId: 'new-session-id' }), error: null });

    renderCard();

    await vi.waitFor(() => {
      expect(screen.getByText('Lobby opens shortly before start.')).toBeTruthy();
    });
    expect(trackMock).toHaveBeenCalledWith('featured_wod_viewed', {
      joinable: false,
      state: null,
    });

    await vi.advanceTimersByTimeAsync(20_000);

    await vi.waitFor(() => {
      expect(screen.getByRole('link', { name: 'Join lobby' })).toBeTruthy();
    });
    expect(trackMock).toHaveBeenCalledWith('featured_wod_viewed', {
      joinable: true,
      state: 'waiting',
    });
  });

  it('shows calendar links even before the session is generated, with a stable non-session UID', async () => {
    fetchCurrentFeaturedWodMock.mockResolvedValue({
      data: featured({ sessionId: null, state: null, attendeeCount: null }),
      error: null,
    });

    renderCard();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Download calendar invite' })).toBeTruthy();
    });
    const googleLink = screen.getByRole('link', { name: 'Add to Google Calendar' }) as HTMLAnchorElement;
    expect(googleLink.href).toContain('calendar.google.com/calendar/render');
    expect(googleLink.href).toContain('Sunrise+AMRAP');
  });

  it('downloads an .ics file and tracks featured_wod_calendar_saved when clicked', async () => {
    fetchCurrentFeaturedWodMock.mockResolvedValue({ data: featured(), error: null });
    const createObjectURL = vi.fn().mockReturnValue('blob:fake-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderCard();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Download calendar invite' })).toBeTruthy();
    });
    screen.getByRole('button', { name: 'Download calendar invite' }).click();

    expect(createObjectURL).toHaveBeenCalled();
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/calendar;charset=utf-8');
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
    expect(trackMock).toHaveBeenCalledWith(
      'featured_wod_calendar_saved',
      { method: 'ics' },
      { sessionId: '22222222-2222-4222-8222-222222222222' }
    );

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('tracks featured_wod_calendar_saved with method google when the Google Calendar link is clicked', async () => {
    fetchCurrentFeaturedWodMock.mockResolvedValue({ data: featured(), error: null });

    renderCard();

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Add to Google Calendar' })).toBeTruthy();
    });
    screen.getByRole('link', { name: 'Add to Google Calendar' }).click();

    expect(trackMock).toHaveBeenCalledWith(
      'featured_wod_calendar_saved',
      { method: 'google' },
      { sessionId: '22222222-2222-4222-8222-222222222222' }
    );
  });

  it('stops polling after unmount', async () => {
    vi.useFakeTimers();
    fetchCurrentFeaturedWodMock.mockResolvedValue({ data: featured(), error: null });

    const { unmount } = renderCard();

    await vi.waitFor(() => {
      expect(fetchCurrentFeaturedWodMock).toHaveBeenCalledTimes(1);
    });

    unmount();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchCurrentFeaturedWodMock).toHaveBeenCalledTimes(1);
  });
});
