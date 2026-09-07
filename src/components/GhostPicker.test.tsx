import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GhostPicker } from './GhostPicker';

const fetchAvailableGhostsMock = vi.fn();
const setStoredGhostSelectionMock = vi.fn();
const onChange = vi.fn();

vi.mock('@/lib/api/ghost', () => ({
  fetchAvailableGhosts: (...args: unknown[]) => fetchAvailableGhostsMock(...args),
}));
vi.mock('@/lib/missionIdentity', () => ({
  setStoredGhostSelection: (...args: unknown[]) => setStoredGhostSelectionMock(...args),
}));
vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: () => ({
    isAuthenticated: true,
    isAuthLoading: false,
  }),
}));

afterEach(() => {
  cleanup();
  fetchAvailableGhostsMock.mockReset();
  setStoredGhostSelectionMock.mockReset();
  onChange.mockReset();
});

describe('GhostPicker', () => {
  it('lists crew runs from the missed mission and writes a selection', async () => {
    fetchAvailableGhostsMock.mockResolvedValue({
      data: {
        personalBest: null,
        friends: [
          {
            missionId: 'live-1',
            participantId: 'crew-1',
            nickname: 'Maya',
            finalScore: 120,
            baseScore: 100,
            createdAt: '2026-10-05T12:00:00.000Z',
          },
        ],
      },
      error: null,
    });

    render(
      <GhostPicker
        missionId="makeup-1"
        templateId="the-valve"
        durationMinutes={10}
        value={null}
        onChange={onChange}
      />
    );

    await waitFor(() => {
      expect(fetchAvailableGhostsMock).toHaveBeenCalledWith('the-valve', 10, 'makeup-1', '');
    });

    await waitFor(() => {
      expect(screen.getByText(/Race a crewmate from the mission you missed/)).toBeTruthy();
    });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'crew:crew-1' } });

    expect(setStoredGhostSelectionMock).toHaveBeenCalledWith(
      'makeup-1',
      expect.objectContaining({
        participantId: 'crew-1',
        nickname: 'Maya',
        finalScore: 120,
      })
    );
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ participantId: 'crew-1', nickname: 'Maya' })
    );
  });

  const STANDARD_BEST = {
    missionId: 'std-1',
    participantId: 'std-p',
    nickname: 'Justin',
    finalScore: 62,
    baseScore: 62,
    createdAt: '2026-03-03T12:00:00.000Z',
  };

  const KNEE_BEST = {
    missionId: 'knees-1',
    participantId: 'knees-p',
    nickname: 'Justin',
    finalScore: 48,
    baseScore: 48,
    createdAt: '2026-02-20T12:00:00.000Z',
  };

  const KNEE_KEY = 'Diamond Push-ups#push-up--knees';

  it('sends the planned version key so the server can find the matching run', async () => {
    fetchAvailableGhostsMock.mockResolvedValue({
      data: { personalBest: null, variantBest: null, friends: [] },
      error: null,
    });

    render(
      <GhostPicker
        missionId="m1"
        templateId="the-valve"
        durationMinutes={10}
        value={null}
        onChange={onChange}
        versionKey={KNEE_KEY}
        versionLabel="Diamond Push-ups: from the knees"
      />
    );

    await waitFor(() => {
      expect(fetchAvailableGhostsMock).toHaveBeenCalledWith('the-valve', 10, 'm1', KNEE_KEY);
    });
  });

  it('offers the same-variant best alongside the standard best, named', async () => {
    fetchAvailableGhostsMock.mockResolvedValue({
      data: { personalBest: STANDARD_BEST, variantBest: KNEE_BEST, friends: [] },
      error: null,
    });

    render(
      <GhostPicker
        missionId="m1"
        templateId="the-valve"
        durationMinutes={10}
        value={null}
        onChange={onChange}
        versionKey={KNEE_KEY}
        versionLabel="Diamond Push-ups: from the knees"
      />
    );

    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: /Diamond Push-ups: from the knees · 48 reps/ })
      ).toBeTruthy();
    });
    // Their own standard best is not hidden from them.
    expect(screen.getByRole('option', { name: /Personal Best · 62 reps/ })).toBeTruthy();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'variant-best' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ missionId: 'knees-1', finalScore: 48 })
    );
  });

  it('says so the first time an athlete scales this workout', async () => {
    fetchAvailableGhostsMock.mockResolvedValue({
      data: { personalBest: STANDARD_BEST, variantBest: null, friends: [] },
      error: null,
    });

    render(
      <GhostPicker
        missionId="m1"
        templateId="the-valve"
        durationMinutes={10}
        value={null}
        onChange={onChange}
        versionKey={KNEE_KEY}
        versionLabel="Diamond Push-ups: from the knees"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/First time doing it this way/)).toBeTruthy();
    });
  });

  it('offers no variant option for a mission performed as programmed', async () => {
    fetchAvailableGhostsMock.mockResolvedValue({
      data: { personalBest: STANDARD_BEST, variantBest: null, friends: [] },
      error: null,
    });

    render(
      <GhostPicker
        missionId="m1"
        templateId="the-valve"
        durationMinutes={10}
        value={null}
        onChange={onChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Personal Best/ })).toBeTruthy();
    });
    expect(screen.queryByText(/First time doing it this way/)).toBeNull();
    expect(screen.queryByRole('option', { name: /from the knees/ })).toBeNull();
  });

  it('keeps a selected variant ghost selected in the dropdown', async () => {
    fetchAvailableGhostsMock.mockResolvedValue({
      data: { personalBest: STANDARD_BEST, variantBest: KNEE_BEST, friends: [] },
      error: null,
    });

    render(
      <GhostPicker
        missionId="m1"
        templateId="the-valve"
        durationMinutes={10}
        value={{
          missionId: 'knees-1',
          participantId: 'knees-p',
          // Deliberately not the label the component would generate: the match
          // is by run, so display copy can change without losing the selection.
          label: 'something else entirely',
          nickname: 'Justin',
          finalScore: 48,
          baseScore: 48,
          createdAt: '2026-02-20T12:00:00.000Z',
        }}
        onChange={onChange}
        versionKey={KNEE_KEY}
        versionLabel="Diamond Push-ups: from the knees"
      />
    );

    await waitFor(() => {
      expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('variant-best');
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('drops a ghost the athlete can no longer race after changing their scaling', async () => {
    // They picked the knee ghost, then unticked the scaling. The server now
    // offers only the standard best, and the stale selection would otherwise
    // keep pacing them against a version they said they are not doing.
    fetchAvailableGhostsMock.mockResolvedValue({
      data: { personalBest: STANDARD_BEST, variantBest: null, friends: [] },
      error: null,
    });

    render(
      <GhostPicker
        missionId="m1"
        templateId="the-valve"
        durationMinutes={10}
        value={{
          missionId: 'knees-1',
          participantId: 'knees-p',
          label: 'Diamond Push-ups: from the knees · 48 reps',
          nickname: 'Justin',
          finalScore: 48,
          baseScore: 48,
          createdAt: '2026-02-20T12:00:00.000Z',
        }}
        onChange={onChange}
      />
    );

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(null);
    });
    expect(setStoredGhostSelectionMock).toHaveBeenCalledWith('m1', null);
  });
});
