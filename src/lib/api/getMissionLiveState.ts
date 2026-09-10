import { callRpc } from '@/lib/api/callRpc';
import {
  parseMessageRow,
  parseMissionClockFields,
  parseMissionRow,
  parseParticipantRow,
  parseRoundRow,
  parseSegmentResultRow,
  type MissionClockFields,
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
  missionClock: MissionClockFields | null;
  participants: ParticipantRow[];
  participantIds: string[] | null;
  rounds: RoundRow[];
  messages: MessageRow[];
  segmentResults: ParticipantSegmentResultRow[];
  incremental: boolean;
  snapshotAt: string | null;
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

function parseParticipantIds(value: unknown): string[] | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Array.isArray(value)) {
    return null;
  }
  const ids = value.filter((id): id is string => typeof id === 'string' && id.length > 0);
  return ids;
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
  const missionClock =
    mission === null && missionRecord ? parseMissionClockFields(missionRecord) : null;

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

  const snapshotAtRaw = record.snapshot_at;
  const snapshotAt =
    snapshotAtRaw === null || snapshotAtRaw === undefined
      ? null
      : typeof snapshotAtRaw === 'string' && snapshotAtRaw.length > 0
        ? snapshotAtRaw
        : null;

  return {
    ok: true,
    data: {
      mission,
      missionClock,
      participants,
      participantIds: parseParticipantIds(record.participant_ids),
      rounds,
      messages,
      segmentResults,
      incremental: record.incremental === true,
      snapshotAt,
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
