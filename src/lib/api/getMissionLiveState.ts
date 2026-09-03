import { callRpc } from '@/lib/api/callRpc';
import {
  parseMessageRow,
  parseMissionRow,
  parseParticipantRow,
  parseRoundRow,
  parseSegmentResultRow,
} from '@/lib/realtime/missionChannelUtils';
import type {
  MessageRow,
  MissionRow,
  ParticipantRow,
  ParticipantSegmentResultRow,
  RoundRow,
} from '@/lib/missionSync/types';

export type MissionLiveStateSnapshot = {
  mission: MissionRow | null;
  participants: ParticipantRow[];
  rounds: RoundRow[];
  messages: MessageRow[];
  segmentResults: ParticipantSegmentResultRow[];
  incremental: boolean;
};

export type GetMissionLiveStateResult =
  { ok: true; data: MissionLiveStateSnapshot } | { ok: false; reason: string; error?: string };

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (row): row is Record<string, unknown> => row !== null && typeof row === 'object'
  );
}

export function parseMissionLiveStatePayload(payload: unknown): GetMissionLiveStateResult {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, reason: 'invalid_response' };
  }

  const record = payload as Record<string, unknown>;
  if (record.ok === false) {
    const reason = typeof record.reason === 'string' ? record.reason : 'invalid_claim_token';
    return { ok: false, reason };
  }

  if (record.ok !== true) {
    return { ok: false, reason: 'invalid_response' };
  }

  const missionRecord =
    record.mission !== null && typeof record.mission === 'object'
      ? (record.mission as Record<string, unknown>)
      : null;
  const mission = missionRecord ? parseMissionRow(missionRecord) : null;

  const participants = asRecordArray(record.participants)
    .map((row) => parseParticipantRow(row))
    .filter((row): row is ParticipantRow => row !== null);

  const rounds = asRecordArray(record.rounds)
    .map((row) => parseRoundRow(row))
    .filter((row): row is RoundRow => row !== null);

  const messages = asRecordArray(record.messages)
    .map((row) => parseMessageRow(row))
    .filter((row): row is MessageRow => row !== null);

  const segmentResults = asRecordArray(record.segment_results)
    .map((row) => parseSegmentResultRow(row))
    .filter((row): row is ParticipantSegmentResultRow => row !== null);

  return {
    ok: true,
    data: {
      mission,
      participants,
      rounds,
      messages,
      segmentResults,
      incremental: record.incremental === true,
    },
  };
}

export async function getMissionLiveState(input: {
  missionId: string;
  participantId: string;
  claimToken: string | null;
  hostToken: string | null;
  since?: string | null;
}): Promise<GetMissionLiveStateResult> {
  const { data, error } = await callRpc<unknown>('get_mission_live_state', {
    p_mission_id: input.missionId,
    p_participant_id: input.participantId,
    p_claim_token: input.claimToken,
    p_host_token: input.hostToken,
    p_since: input.since ?? null,
  });

  if (error) {
    return { ok: false, reason: 'rpc_error', error: error.message };
  }

  return parseMissionLiveStatePayload(data);
}
