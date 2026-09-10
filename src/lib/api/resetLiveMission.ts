import { callRpc } from '@/lib/api/callRpc';

export type ResetLiveMissionApiError = {
  message: string;
};

export type ResetLiveMissionResult = {
  missionId: string;
  hostToken: string;
  participantId: string;
  claimToken: string;
  rallyPointId: string | null;
};

export function mapResetLiveMissionError(message: string | undefined): string {
  if (!message) {
    return 'Something went wrong. Please try again.';
  }
  if (message.includes('Featured missions cannot be reset')) {
    return 'Featured missions cannot be reset.';
  }
  if (message.includes('Campaign missions cannot be reset')) {
    return 'Campaign missions cannot be reset.';
  }
  if (message.includes('Completed missions cannot be reset')) {
    return 'This mission already has a locked score and cannot be reset.';
  }
  if (message.includes('Mission cannot be reset in this state')) {
    return 'This mission cannot be reset right now.';
  }
  if (message.includes('Invalid host token')) {
    return 'Only the host can reset this mission.';
  }
  if (message.includes('Mission not found')) {
    return 'Mission not found.';
  }
  return message;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function resetLiveMission(input: {
  missionId: string;
  hostToken: string;
}): Promise<{ data: ResetLiveMissionResult | null; error: ResetLiveMissionApiError | null }> {
  const { data, error } = await callRpc('reset_live_mission', {
    p_mission_id: input.missionId,
    p_host_token: input.hostToken,
  });

  if (error) {
    return { data: null, error: { message: mapResetLiveMissionError(error.message) } };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  if (raw.ok !== true) {
    return {
      data: null,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  const missionId = readString(raw.mission_id);
  const hostToken = readString(raw.host_token);
  const participantId = readString(raw.participant_id);
  const claimToken = readString(raw.claim_token);
  const rallyPointId =
    raw.rally_point_id === null || raw.rally_point_id === undefined
      ? null
      : readString(raw.rally_point_id);

  if (!missionId || !hostToken || !participantId || !claimToken) {
    return {
      data: null,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  return {
    data: {
      missionId,
      hostToken,
      participantId,
      claimToken,
      rallyPointId,
    },
    error: null,
  };
}
