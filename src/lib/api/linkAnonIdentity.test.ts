import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getOrCreateAnonIdMock = vi.fn();
const callRpcMock = vi.fn();

vi.mock('@/lib/analytics/identity', () => ({
  getOrCreateAnonId: (...args: unknown[]) => getOrCreateAnonIdMock(...args),
}));

vi.mock('@/lib/api/callRpc', () => ({
  callRpc: (...args: unknown[]) => callRpcMock(...args),
}));

import { isLinkableAnonId, linkCurrentAnonIdentity } from '@/lib/api/linkAnonIdentity';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('isLinkableAnonId', () => {
  it('rejects null, empty, unknown, and non-UUID values', () => {
    expect(isLinkableAnonId(null)).toBe(false);
    expect(isLinkableAnonId(undefined)).toBe(false);
    expect(isLinkableAnonId('')).toBe(false);
    expect(isLinkableAnonId('   ')).toBe(false);
    expect(isLinkableAnonId('unknown')).toBe(false);
    expect(isLinkableAnonId('not-a-uuid')).toBe(false);
    expect(isLinkableAnonId('aaaaaaaa-bbbb-cccc-dddd')).toBe(false);
  });

  it('accepts a UUID (case-insensitive)', () => {
    expect(isLinkableAnonId(UUID)).toBe(true);
    expect(isLinkableAnonId(UUID.toUpperCase())).toBe(true);
    expect(isLinkableAnonId(`  ${UUID}  `)).toBe(true);
  });
});

describe('linkCurrentAnonIdentity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callRpcMock.mockResolvedValue({ data: { ok: true }, error: null });
  });

  it('does not call the RPC for unknown anon ids', async () => {
    getOrCreateAnonIdMock.mockReturnValue('unknown');
    await linkCurrentAnonIdentity();
    expect(callRpcMock).not.toHaveBeenCalled();
  });

  it('calls link_anon_identity with a UUID anon id', async () => {
    getOrCreateAnonIdMock.mockReturnValue(UUID);
    await linkCurrentAnonIdentity();
    expect(callRpcMock).toHaveBeenCalledWith('link_anon_identity', { p_anon_id: UUID });
  });

  it('does not throw when callRpc rejects', async () => {
    getOrCreateAnonIdMock.mockReturnValue(UUID);
    callRpcMock.mockRejectedValue(new Error('network'));
    await expect(linkCurrentAnonIdentity()).resolves.toBeUndefined();
  });
});

describe('analytics_identity_links migration contract', () => {
  it('locks the table and stitches with ON CONFLICT DO NOTHING', () => {
    const sql = readFileSync(
      join(root, 'supabase/migrations/20260903180000_analytics_identity_links.sql'),
      'utf8'
    );

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.analytics_identity_links');
    expect(sql).toContain('PRIMARY KEY (anon_id, user_id)');
    expect(sql).toContain('link_anon_identity');
    expect(sql).toContain('ON CONFLICT (anon_id, user_id) DO NOTHING');
    expect(sql).toContain(
      'REVOKE ALL ON TABLE public.analytics_identity_links FROM PUBLIC, anon, authenticated'
    );
    expect(sql).toContain(
      'REVOKE EXECUTE ON FUNCTION public.link_anon_identity(text) FROM PUBLIC, anon'
    );
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.link_anon_identity(text) TO authenticated'
    );
  });
});
