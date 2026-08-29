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

  it('shows "Live now" and "Join now" for a session in progress', async () => {
    fetchCurrentFeaturedWodMock.mockResolvedValue({
      data: featured({ state: 'work' }),
      error: null,
    });

    renderCard();

    await waitFor(() => {
      expect(screen.getByText(/Live now/)).toBeTruthy();
    });
    expect(screen.getByRole('link', { name: 'Join now' })).toBeTruthy();
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
});
