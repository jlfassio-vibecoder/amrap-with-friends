import { beforeEach, describe, expect, it, vi } from 'vitest';

const getOrCreateAnonIdMock = vi.fn();
const insertMock = vi.fn();
const sendBeaconMock = vi.fn();

vi.mock('@/lib/analytics/identity', () => ({
  getOrCreateAnonId: (...args: unknown[]) => getOrCreateAnonIdMock(...args),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: (...args: unknown[]) => insertMock(...args),
    }),
  },
}));

import { track, trackBeacon } from '@/lib/analytics/track';

const UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

class JsonBlob {
  readonly type: string;
  readonly json: string;
  constructor(parts: BlobPart[], options?: BlobPropertyBag) {
    this.json = String(parts[0] ?? '');
    this.type = options?.type ?? '';
  }
}

function beaconPayload(): Record<string, unknown> {
  const blob = sendBeaconMock.mock.calls[0]?.[1] as JsonBlob;
  return JSON.parse(blob.json) as Record<string, unknown>;
}

describe('track payload anon_id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertMock.mockReturnValue(Promise.resolve({ error: null }));
    sendBeaconMock.mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: sendBeaconMock,
    });
    vi.stubGlobal('Blob', JsonBlob);
  });

  it('includes anon_id when the browser has a persistable id', () => {
    getOrCreateAnonIdMock.mockReturnValue(UUID);
    track('page_viewed');
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ anon_id: UUID }));
  });

  it('omits anon_id when identity is null', () => {
    getOrCreateAnonIdMock.mockReturnValue(null);
    track('page_viewed');
    const payload = insertMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toBeDefined();
    expect(payload).not.toHaveProperty('anon_id');
  });

  it('omits anon_id from trackBeacon when identity is null', () => {
    getOrCreateAnonIdMock.mockReturnValue(null);
    expect(trackBeacon('page_unloaded')).toBe(true);
    expect(beaconPayload()).not.toHaveProperty('anon_id');
  });

  it('includes anon_id on trackBeacon when the browser has a persistable id', () => {
    getOrCreateAnonIdMock.mockReturnValue(UUID);
    expect(trackBeacon('page_unloaded')).toBe(true);
    expect(beaconPayload().anon_id).toBe(UUID);
  });
});
