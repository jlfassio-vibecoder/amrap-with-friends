import { describe, it, expect, vi, beforeEach } from 'vitest';

const callRpcMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/callRpc', () => ({
  callRpc: (...args: unknown[]) => callRpcMock(...args),
}));

const { getMissionRoundCounts } = await import('./getMissionRoundCounts');

const INPUT = {
  missionId: 'mission-1',
  participantId: 'participant-1',
  claimToken: 'claim',
  hostToken: null,
};

describe('getMissionRoundCounts', () => {
  beforeEach(() => {
    callRpcMock.mockReset();
  });

  it('reads the counts', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        counts: [{ participant_id: 'a', round_count: 3 }],
      },
      error: null,
    });
    await expect(getMissionRoundCounts(INPUT)).resolves.toEqual({
      ok: true,
      counts: [{ participantId: 'a', roundCount: 3 }],
    });
  });

  // A body without ok:true used to read as an empty mission -- counts parsed to
  // [] and the reconcile drew a conclusion from a response it never got.
  it('refuses a body that never said ok', async () => {
    callRpcMock.mockResolvedValue({ data: { counts: [] }, error: null });
    await expect(getMissionRoundCounts(INPUT)).resolves.toEqual({
      ok: false,
      reason: 'unknown',
    });
  });

  it('refuses ok:true with counts that are not a list', async () => {
    callRpcMock.mockResolvedValue({ data: { ok: true, counts: null }, error: null });
    await expect(getMissionRoundCounts(INPUT)).resolves.toEqual({
      ok: false,
      reason: 'invalid_response',
    });
  });

  it('passes the RPC reason through', async () => {
    callRpcMock.mockResolvedValue({
      data: { ok: false, reason: 'invalid_claim_token' },
      error: null,
    });
    await expect(getMissionRoundCounts(INPUT)).resolves.toEqual({
      ok: false,
      reason: 'invalid_claim_token',
    });
  });

  it('reports a transport error', async () => {
    callRpcMock.mockResolvedValue({ data: null, error: { message: 'network down' } });
    await expect(getMissionRoundCounts(INPUT)).resolves.toEqual({
      ok: false,
      reason: 'network down',
    });
  });

  it('skips rows that are missing their fields', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        counts: [{ participant_id: 'a', round_count: 3 }, { participant_id: 'b' }, null],
      },
      error: null,
    });
    await expect(getMissionRoundCounts(INPUT)).resolves.toEqual({
      ok: true,
      counts: [{ participantId: 'a', roundCount: 3 }],
    });
  });
});
