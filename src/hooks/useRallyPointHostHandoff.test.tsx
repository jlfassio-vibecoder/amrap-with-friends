import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useRallyPointHostHandoff } from './useRallyPointHostHandoff';

const resumeMock = vi.fn();
const getStoredHostTokenMock = vi.fn();
const setStoredHostTokenMock = vi.fn();
const clearStoredHostTokenMock = vi.fn();

vi.mock('@/lib/api/resumeMissionIdentity', () => ({
  resumeMissionIdentity: (...args: unknown[]) => resumeMock(...args),
}));

vi.mock('@/lib/missionIdentity', () => ({
  getStoredHostToken: (...args: unknown[]) => getStoredHostTokenMock(...args),
  setStoredHostToken: (...args: unknown[]) => setStoredHostTokenMock(...args),
  clearStoredHostToken: (...args: unknown[]) => clearStoredHostTokenMock(...args),
}));

const MISSION_ID = '11111111-1111-4111-8111-111111111111';

describe('useRallyPointHostHandoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resumes and stores host token when the viewer becomes host', async () => {
    getStoredHostTokenMock.mockReturnValue(null);
    resumeMock.mockResolvedValue({
      data: {
        participantId: 'p1',
        nickname: 'Jules',
        role: 'host',
        hostToken: 'new-host-token',
      },
      missing: false,
      error: null,
    });
    const onHostAuthorityChange = vi.fn();

    renderHook(() =>
      useRallyPointHostHandoff({
        hostUserId: 'user-b',
        activeMissionId: MISSION_ID,
        userId: 'user-b',
        enabled: true,
        onHostAuthorityChange,
      })
    );

    await waitFor(() => {
      expect(resumeMock).toHaveBeenCalledWith(MISSION_ID);
      expect(setStoredHostTokenMock).toHaveBeenCalledWith(MISSION_ID, 'new-host-token');
      expect(onHostAuthorityChange).toHaveBeenCalled();
    });
  });

  it('clears the host token when the viewer is demoted', async () => {
    getStoredHostTokenMock.mockReturnValue('old-token');
    const onHostAuthorityChange = vi.fn();

    renderHook(() =>
      useRallyPointHostHandoff({
        hostUserId: 'user-b',
        activeMissionId: MISSION_ID,
        userId: 'user-a',
        enabled: true,
        onHostAuthorityChange,
      })
    );

    await waitFor(() => {
      expect(clearStoredHostTokenMock).toHaveBeenCalledWith(MISSION_ID);
      expect(onHostAuthorityChange).toHaveBeenCalled();
    });
    expect(resumeMock).not.toHaveBeenCalled();
  });

  it('does not clear again when demoted user already has no token', async () => {
    getStoredHostTokenMock.mockReturnValue(null);
    const onHostAuthorityChange = vi.fn();

    renderHook(() =>
      useRallyPointHostHandoff({
        hostUserId: 'user-b',
        activeMissionId: MISSION_ID,
        userId: 'user-a',
        enabled: true,
        onHostAuthorityChange,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(clearStoredHostTokenMock).not.toHaveBeenCalled();
    expect(onHostAuthorityChange).not.toHaveBeenCalled();
  });
});
