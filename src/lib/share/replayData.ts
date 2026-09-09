import { callRpc } from '@/lib/api/callRpc';
import type { ReplayData, ReplayParticipant, ReplayRound } from '@/lib/share/types';

/**
 * Hand-written validation rather than a schema library: the repo has no
 * runtime validator and this is one shape. A malformed payload throws here,
 * where the message can say what was wrong, instead of surfacing as a blank
 * canvas three layers down.
 */
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function num(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function str(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

function strOrNull(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' ? value : null;
}

export function parseReplayData(payload: unknown): ReplayData {
  const raw = asRecord(payload);
  if (raw.ok !== true) {
    throw new Error(`replay data unavailable: ${str(raw, 'reason') || 'unknown'}`);
  }

  const mission = asRecord(raw.mission);
  const missionId = str(mission, 'id');
  if (!missionId) {
    throw new Error('replay data has no mission id');
  }

  const capSeconds = num(mission, 'capSeconds');
  if (capSeconds <= 0) {
    throw new Error('replay data has a non-positive cap');
  }

  const participants: ReplayParticipant[] = (
    Array.isArray(raw.participants) ? raw.participants : []
  ).map((entry) => {
    const row = asRecord(entry);
    return {
      participantId: str(row, 'participantId'),
      userId: strOrNull(row, 'userId'),
      displayName: str(row, 'displayName') || 'Athlete',
      isMe: row.isMe === true,
      finalRounds: num(row, 'finalRounds'),
      finalReps: num(row, 'finalReps'),
      role: str(row, 'role') || 'joiner',
    };
  });

  if (participants.length === 0) {
    throw new Error('replay data has no participants');
  }

  const rounds: ReplayRound[] = (Array.isArray(raw.rounds) ? raw.rounds : []).map((entry) => {
    const row = asRecord(entry);
    return {
      participantId: str(row, 'participantId'),
      n: num(row, 'n'),
      // Clamped again on the client: the RPC clamps, but this module is also
      // the entry point for fixtures and, later, a cached payload.
      atSeconds: Math.max(0, Math.min(capSeconds, num(row, 'atSeconds'))),
    };
  });

  return {
    mission: {
      id: missionId,
      templateId: strOrNull(mission, 'templateId'),
      workout: mission.workout ?? null,
      capSeconds,
      durationMinutes: num(mission, 'durationMinutes'),
      intensityTier: typeof mission.intensityTier === 'number' ? mission.intensityTier : null,
      state: str(mission, 'state'),
      startedAt: strOrNull(mission, 'startedAt'),
      segmentIndex: num(mission, 'segmentIndex'),
    },
    participants,
    rounds,
  };
}

export async function fetchReplayData(input: {
  missionId: string;
  participantId?: string | null;
  claimToken?: string | null;
  hostToken?: string | null;
}): Promise<{ data: ReplayData | null; error: { message: string } | null }> {
  const { data, error } = await callRpc('get_mission_replay', {
    p_mission_id: input.missionId,
    p_participant_id: input.participantId ?? null,
    p_claim_token: input.claimToken ?? null,
    p_host_token: input.hostToken ?? null,
  });

  if (error) {
    return { data: null, error: { message: error.message } };
  }

  try {
    return { data: parseReplayData(data), error: null };
  } catch (cause) {
    return {
      data: null,
      error: { message: cause instanceof Error ? cause.message : 'replay data unavailable' },
    };
  }
}
