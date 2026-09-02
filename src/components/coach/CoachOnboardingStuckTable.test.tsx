import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CoachOnboardingStuckTable } from './CoachOnboardingStuckTable';

const fetchMock = vi.fn();

vi.mock('@/lib/api/coach', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/coach')>('@/lib/api/coach');
  return {
    ...actual,
    fetchCoachOnboardingStuckList: (...args: unknown[]) => fetchMock(...args),
  };
});

beforeEach(() => {
  fetchMock.mockReset();
});

describe('CoachOnboardingStuckTable', () => {
  it('renders stuck rows with plain-English status labels', async () => {
    fetchMock.mockResolvedValue({
      data: [
        {
          userId: '22222222-2222-4222-8222-222222222222',
          email: 'stuck@example.com',
          status: 'needs_profile',
          accountCreatedAt: '2026-09-01T10:00:00.000Z',
          lastSignInAt: '2026-09-01T10:05:00.000Z',
          providers: ['email'],
        },
      ],
      error: null,
    });

    render(<CoachOnboardingStuckTable />);

    await waitFor(() => {
      expect(screen.getByText('stuck@example.com')).toBeTruthy();
    });
    expect(screen.getByText('Signed up — profile not started')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Incomplete sign-ups' })).toBeTruthy();
  });

  it('shows empty copy when nobody is stuck', async () => {
    fetchMock.mockResolvedValue({ data: [], error: null });

    render(<CoachOnboardingStuckTable />);

    await waitFor(() => {
      expect(
        screen.getByText('Everyone who signed up has finished their profile.'),
      ).toBeTruthy();
    });
  });
});
