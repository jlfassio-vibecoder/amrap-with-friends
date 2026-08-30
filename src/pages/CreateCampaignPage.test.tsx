import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import CreateCampaignPage from './CreateCampaignPage';

const createCampaignMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('@/lib/api/campaigns', () => ({
  createCampaign: (...args: unknown[]) => createCampaignMock(...args),
}));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));
vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: () => ({
    isAuthenticated: true,
    isAuthLoading: false,
    user: { id: 'user-1', email: 'host@example.com' },
    signOut: vi.fn(),
  }),
}));
vi.mock('@/hooks/useAthleteProfile', () => ({
  useAthleteProfile: () => ({
    profile: { username: 'maya' },
    missing: false,
    loading: false,
    error: null,
  }),
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <CreateCampaignPage />
      </ThemeProvider>
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  createCampaignMock.mockReset();
  navigateMock.mockReset();
  createCampaignMock.mockResolvedValue({
    data: { campaignId: 'c1', inviteCode: 'ABC', totalSessions: 24, sessionsPerWeek: 3 },
    error: null,
  });
});

describe('CreateCampaignPage', () => {
  it('previews the default plan before anything is typed', () => {
    renderPage();
    // 8 weeks x the 3 suggested days.
    expect(screen.getByText(/24 sessions · 3 a week · 8 weeks/)).toBeTruthy();
  });

  it('re-previews when the campaign length changes', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '4 weeks' }));
    expect(screen.getByText(/12 sessions · 3 a week · 4 weeks/)).toBeTruthy();
  });

  it('re-previews when a training day is removed', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Wed' }));
    expect(screen.getByText(/16 sessions · 2 a week · 8 weeks/)).toBeTruthy();
  });

  it('will not let the host schedule more than five days a week', () => {
    renderPage();
    // Suggested pattern is Mon/Wed/Fri; add Tue and Thu to reach five.
    fireEvent.click(screen.getByRole('button', { name: 'Tue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thu' }));
    expect(screen.getByText(/40 sessions · 5 a week · 8 weeks/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sat' }).hasAttribute('disabled')).toBe(true);
  });

  it('asks for a training day rather than previewing an impossible plan', () => {
    renderPage();
    for (const day of ['Mon', 'Wed', 'Fri']) {
      fireEvent.click(screen.getByRole('button', { name: day }));
    }
    expect(screen.getByText('Pick at least one training day.')).toBeTruthy();
    expect(screen.queryByText(/sessions ·/)).toBeNull();
  });

  it('keeps submit disabled until the campaign is named', () => {
    renderPage();
    const submit = screen.getByRole('button', { name: 'Create campaign' });
    expect(submit.hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByRole('textbox', { name: /Campaign name/i }), {
      target: { value: 'Winter Engine Build' },
    });
    expect(submit.hasAttribute('disabled')).toBe(false);
  });

  it('sends the previewed plan and navigates to the new campaign', async () => {
    renderPage();
    fireEvent.change(screen.getByRole('textbox', { name: /Campaign name/i }), {
      target: { value: 'Winter Engine Build' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create campaign' }));

    await waitFor(() => expect(createCampaignMock).toHaveBeenCalledTimes(1));
    const [input] = createCampaignMock.mock.calls[0];
    expect(input.name).toBe('Winter Engine Build');
    expect(input.weekCount).toBe(8);
    expect(input.occurrences).toHaveLength(24);
    // Every occurrence must carry its own resolved workout for the generator.
    expect(input.occurrences.every((o: { workout: unknown[] }) => o.workout.length > 0)).toBe(
      true
    );

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/campaign/c1'));
  });

  it('surfaces a server error and stays on the page', async () => {
    createCampaignMock.mockResolvedValue({
      data: null,
      error: { message: 'You already have three campaigns running. Finish one first.' },
    });
    renderPage();
    fireEvent.change(screen.getByRole('textbox', { name: /Campaign name/i }), {
      target: { value: 'Fourth' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create campaign' }));

    await waitFor(() =>
      expect(
        screen.getByText('You already have three campaigns running. Finish one first.')
      ).toBeTruthy()
    );
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
