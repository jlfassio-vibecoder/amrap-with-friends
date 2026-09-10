import { callRpc } from '@/lib/api/callRpc';
import type { RemoteRoundCount } from '@/lib/realtime/roundCountDrift';

export type GetMissionRoundCountsResult =
  { ok: true; counts: RemoteRoundCount[] } | { ok: false; reason: string };

function parseCounts(value: unknown): RemoteRoundCount[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const counts: RemoteRoundCount[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const record = row as Record<string, unknown>;
    const participantId = record.participant_id;
    const roundCount = record.round_count;
    if (typeof participantId === 'string' && typeof roundCount === 'number') {
      counts.push({ participantId, roundCount });
    }
  }
  return counts;
}

/**
 * One integer per seat, for the reconcile to compare against what it holds.
 * Cheap enough to run every interval; the full snapshot follows only on a
 * disagreement.
 */
export async function getMissionRoundCounts(input: {
  missionId: string;
  participantId: string;
  claimToken: string | null;
  hostToken: string | null;
}): Promise<GetMissionRoundCountsResult> {
  const { data, error } = await callRpc<unknown>('get_mission_round_counts', {
    p_mission_id: input.missionId,
    p_participant_id: input.participantId,
    p_claim_token: input.claimToken,
    p_host_token: input.hostToken,
  });

  if (error) {
    return { ok: false, reason: error.message };
  }
  if (!data || typeof data !== 'object') {
    return { ok: false, reason: 'invalid_response' };
  }

  const record = data as Record<string, unknown>;
  if (record.ok !== true) {
    return { ok: false, reason: typeof record.reason === 'string' ? record.reason : 'unknown' };
  }
  // A malformed body must not read as an empty mission: counts would parse to
  // [] and the reconcile would draw a conclusion from a response it never got.
  if (!Array.isArray(record.counts)) {
    return { ok: false, reason: 'invalid_response' };
  }

  return { ok: true, counts: parseCounts(record.counts) };
}
