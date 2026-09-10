import { callRpc } from '@/lib/api/callRpc';
import { persistMissionIdentity } from '@/lib/missionIdentity';

export type ResumeMissionIdentityResult = {
  participantId: string;
  nickname: string;
  role: string;
  hostToken: string | null;
};

export type ResumeMissionIdentityError = {
  message: string;
};

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapRpcError(message: string | undefined): string {
  if (!message) {
    return 'Something went wrong. Please try again.';
  }
  if (message.includes('Authentication required')) {
    return 'Sign in to reopen this mission.';
  }
  return message;
}

export async function resumeMissionIdentity(missionId: string): Promise<{
  data: ResumeMissionIdentityResult | null;
  missing: boolean;
  error: ResumeMissionIdentityError | null;
}> {
  const { data, error } = await callRpc('resume_mission_identity', {
    p_mission_id: missionId,
  });

  if (error) {
    return {
      data: null,
      missing: false,
      error: { message: mapRpcError(error.message) },
    };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

  if (raw.ok === false) {
    return { data: null, missing: true, error: null };
  }

  if (raw.ok !== true) {
    return {
      data: null,
      missing: false,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  const participantId = readString(raw.participantId);
  const nickname = readString(raw.nickname);
  const role = readString(raw.role) ?? 'joiner';
  const hostToken = role === 'host' ? readString(raw.hostToken) : null;

  if (!participantId || !nickname) {
    return {
      data: null,
      missing: false,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  persistMissionIdentity(missionId, {
    participantId,
    nickname,
    ...(hostToken ? { hostToken } : {}),
  });

  return {
    data: { participantId, nickname, role, hostToken },
    missing: false,
    error: null,
  };
}
