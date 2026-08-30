import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CopyInviteLink } from './CopyInviteLink';
import { buildRallyInviteUrl } from '@/lib/session/buildRallyInviteUrl';

vi.mock('@/hooks/useAthleteProfile', () => ({
  useAthleteProfile: () => ({
    profile: null,
    missing: false,
    loading: false,
    error: null,
  }),
}));

const SESSION_ID = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('buildRallyInviteUrl', () => {
  it('builds /join?s= with origin, session id, and default female card', () => {
    expect(buildRallyInviteUrl(SESSION_ID, 'https://amrap.example')).toBe(
      `https://amrap.example/join?s=${SESSION_ID}&card=f`
    );
  });

  it('bakes a male card when requested', () => {
    expect(buildRallyInviteUrl(SESSION_ID, 'https://amrap.example', 'm')).toBe(
      `https://amrap.example/join?s=${SESSION_ID}&card=m`
    );
  });
});

describe('CopyInviteLink', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { origin: 'https://amrap.example' },
    });
  });

  it('copies the rally URL and flashes LINK COPIED', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<CopyInviteLink sessionId={SESSION_ID} />);
    const button = screen.getByRole('button', { name: 'COPY RALLY LINK' });
    await act(async () => {
      fireEvent.click(button);
    });

    expect(writeText).toHaveBeenCalledWith(
      `https://amrap.example/join?s=${SESSION_ID}&card=f`
    );
    expect(screen.getByRole('button', { name: 'LINK COPIED' })).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole('button', { name: 'COPY RALLY LINK' })).toBeTruthy();
  });

  it('shows an error when clipboard write fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('denied')),
      },
    });

    render(<CopyInviteLink sessionId={SESSION_ID} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'COPY RALLY LINK' }));
    });

    expect(screen.getByText(/Could not copy link/i)).toBeTruthy();
  });
});
