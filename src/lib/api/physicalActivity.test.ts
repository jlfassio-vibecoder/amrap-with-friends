import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deletePhysicalActivity,
  fetchPhysicalActivityList,
  logPhysicalActivity,
  updatePhysicalActivity,
} from './physicalActivity';

const callRpcMock = vi.fn();

vi.mock('@/lib/api/callRpc', () => ({
  callRpc: (...args: unknown[]) => callRpcMock(...args),
}));

beforeEach(() => {
  callRpcMock.mockReset();
});

const VALID_ENTRY = {
  id: '11111111-1111-4111-8111-111111111111',
  activityType: 'road_bike',
  activityCategory: 'cycling',
  activityLabel: 'Road Bike',
  durationMinutes: 45,
  intensityTier: 3,
  occurredAt: '2026-08-26T12:00:00.000Z',
  notes: 'Morning ride',
  createdAt: '2026-08-26T12:00:01.000Z',
};

describe('logPhysicalActivity', () => {
  it('wires RPC params and parses the created entry', async () => {
    callRpcMock.mockResolvedValue({
      data: { ok: true, entry: VALID_ENTRY },
      error: null,
    });

    const result = await logPhysicalActivity({
      activityType: 'road_bike',
      durationMinutes: 45,
      intensityTier: 3,
      occurredAt: '2026-08-26T12:00:00.000Z',
      notes: 'Morning ride',
    });

    expect(callRpcMock).toHaveBeenCalledWith('log_physical_activity', {
      p_activity_type: 'road_bike',
      p_duration_minutes: 45,
      p_intensity_tier: 3,
      p_occurred_at: '2026-08-26T12:00:00.000Z',
      p_notes: 'Morning ride',
    });
    expect(result.error).toBeNull();
    expect(result.data?.activityLabel).toBe('Road Bike');
  });

  it('maps an unknown-activity-type error', async () => {
    callRpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Unknown activity type' },
    });

    const result = await logPhysicalActivity({
      activityType: 'not_real',
      durationMinutes: 30,
      intensityTier: 2,
      occurredAt: '2026-08-26T12:00:00.000Z',
    });

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Select a valid activity type.');
  });

  it('maps an authentication error', async () => {
    callRpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Authentication required' },
    });

    const result = await logPhysicalActivity({
      activityType: 'run',
      durationMinutes: 30,
      intensityTier: 2,
      occurredAt: '2026-08-26T12:00:00.000Z',
    });

    expect(result.error?.message).toBe('Sign in to log physical activity.');
  });
});

describe('updatePhysicalActivity', () => {
  it('returns a not-found error when the RPC reports ok: false', async () => {
    callRpcMock.mockResolvedValue({
      data: { ok: false, reason: 'not_found' },
      error: null,
    });

    const result = await updatePhysicalActivity(VALID_ENTRY.id, {
      activityType: 'run',
      durationMinutes: 30,
      intensityTier: 2,
      occurredAt: '2026-08-26T12:00:00.000Z',
    });

    expect(result.data).toBeNull();
    expect(result.error?.message).toContain('not found');
  });
});

describe('deletePhysicalActivity', () => {
  it('wires the id param and returns success', async () => {
    callRpcMock.mockResolvedValue({ data: { ok: true }, error: null });

    const result = await deletePhysicalActivity(VALID_ENTRY.id);

    expect(callRpcMock).toHaveBeenCalledWith('delete_physical_activity', {
      p_id: VALID_ENTRY.id,
    });
    expect(result.data).toBe(true);
    expect(result.error).toBeNull();
  });
});

describe('fetchPhysicalActivityList', () => {
  it('parses a list of entries and drops malformed rows', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        entries: [VALID_ENTRY, { id: 'bad-row', activityType: null }],
      },
      error: null,
    });

    const result = await fetchPhysicalActivityList(50);

    expect(callRpcMock).toHaveBeenCalledWith('list_physical_activity', { p_limit: 50 });
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0].id).toBe(VALID_ENTRY.id);
  });
});
