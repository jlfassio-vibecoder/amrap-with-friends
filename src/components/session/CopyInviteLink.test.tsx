import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  buildRallyInviteUrl,
  CopyInviteLink,
} from './CopyInviteLink';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('buildRallyInviteUrl', () => {
  it('builds /join?s= with origin and session id', () => {
    expect(buildRallyInviteUrl(SESSION_ID, 'https://amrap.example')).toBe(
      `https://amrap.example/join?s=${SESSION_ID}`
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

  it('copies the rally URL and flashes LINK SECURED', async () => {
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
      `https://amrap.example/join?s=${SESSION_ID}`
    );
    expect(screen.getByRole('button', { name: 'LINK SECURED' })).toBeTruthy();

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
