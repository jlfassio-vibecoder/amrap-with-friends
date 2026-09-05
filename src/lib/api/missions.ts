import { supabase } from '@/lib/supabase';
import { persistMissionIdentity } from '@/lib/missionIdentity';
import { callRpc } from '@/lib/api/callRpc';
import { track } from '@/lib/analytics/track';
import type {
  CreateMissionInput,
  CreateMissionResult,
  JoinMissionInput,
  JoinMissionResult,
} from '@/lib/api/missionTypes';

export type MissionApiError = {
  message: string;
};

export const MISSION_LOCKED_OR_INVALID = 'MISSION LOCKED OR INVALID.';
export const MISSION_RALLY_DEPARTED = 'MISSION LOCKED. THE RALLY HAS DEPARTED.';

const MISSION_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isMissionIdUuid(value: string): boolean {
  return MISSION_ID_UUID_RE.test(value);
}

function mapRpcError(message: string | undefined): string {
  if (!message) {
    return 'Something went wrong. Please try again.';
  }
  if (message.includes('Mission locked')) {
    return MISSION_RALLY_DEPARTED;
  }
  if (
    message.includes('invalid input syntax for type uuid') ||
    message.toLowerCase().includes('invalid uuid')
  ) {
    return 'Enter a valid mission ID (UUID format).';
  }
  if (message.includes('Mission is full')) {
    return 'This mission is full.';
  }
  if (message.includes('Mission not found')) {
    return 'Mission not found. Check the mission ID and try again.';
  }
  if (message.includes('nickname')) {
    return 'Enter your name or a nickname (max 50 characters).';
  }
  if (message.includes('Duration')) {
    return 'Choose a duration between 1 and 60 minutes.';
  }
  if (message.includes('workout')) {
    return 'Check your workout list and try again.';
  }
  if (message.includes('Authentication required')) {
    return 'Sign in to create a mission.';
  }
  if (message.includes('Sign in to schedule a mission')) {
    return 'Sign in to schedule a mission.';
  }
  if (message.includes('Intake required')) {
    return 'Complete intake before creating a mission.';
  }
  if (message.includes('Rally time must be in the future')) {
    return 'Rally time must be in the future.';
  }
  if (message.includes('Rally time must be today or tomorrow')) {
    return 'Rally time must be today or tomorrow.';
  }
  if (message.includes('Host mission limit reached')) {
    return 'You already have 3 active missions.';
  }
  if (message.includes('invalid_timezone')) {
    return 'Could not determine your timezone.';
  }
  if (message.includes('Only the host can update rally time')) {
    return 'Only the host can update rally time.';
  }
  if (message.includes('Mission is not waiting')) {
    return 'Rally time can only be changed while waiting at the rally point.';
  }
  if (message.includes('Mission has no scheduled rally time')) {
    return 'This mission does not have a scheduled rally time.';
  }
  return message;
}

/** Stark copy for invite-link (`?s=`) join failures. */
export function mapDeepLinkJoinError(message: string | undefined): string {
  if (!message) {
    return MISSION_LOCKED_OR_INVALID;
  }
  if (message.includes('Mission locked') || message.includes(MISSION_RALLY_DEPARTED)) {
    return MISSION_RALLY_DEPARTED;
  }
  if (
    message.includes('Mission not found') ||
    message.includes('invalid input syntax for type uuid') ||
    message.toLowerCase().includes('invalid uuid') ||
    message.includes(MISSION_LOCKED_OR_INVALID)
  ) {
    return MISSION_LOCKED_OR_INVALID;
  }
  return mapRpcError(message);
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function createMission(
  input: CreateMissionInput
): Promise<{ data: CreateMissionResult | null; error: MissionApiError | null }> {
  const nickname = input.nickname.trim();
  if (!nickname) {
    return { data: null, error: { message: 'Enter your name or a nickname.' } };
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data, error } = await callRpc('create_mission', {
    p_duration_minutes: input.durationMinutes,
    p_nickname: nickname,
    p_workout: input.workout,
    p_template_id: input.templateId ?? null,
    p_intensity_tier: input.intensityTier ?? null,
    p_scheduled_at: input.scheduledAt ?? null,
    p_timezone: timeZone,
  });

  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const missionId = readString(raw.mission_id);
  const hostToken = readString(raw.host_token);
  const participantId = readString(raw.participant_id);
  const claimToken = readString(raw.claim_token);

  if (!missionId || !hostToken || !participantId || !claimToken) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  persistMissionIdentity(missionId, {
    nickname,
    participantId,
    hostToken,
    claimToken,
  });

  let userId: string | null = null;
  try {
    const { data: authData } = await supabase.auth.getSession();
    userId = authData.session?.user.id ?? null;
  } catch {
    /* analytics enrichment only — never block mission creation on it */
  }

  track(
    'mission_created',
    {
      duration_minutes: input.durationMinutes,
      template_id: input.templateId ?? null,
      intensity_tier: input.intensityTier ?? null,
      scheduled: Boolean(input.scheduledAt),
    },
    { userId, missionId, participantId }
  );

  return {
    data: { missionId, hostToken, participantId, claimToken },
    error: null,
  };
}

export async function joinMission(
  input: JoinMissionInput
): Promise<{ data: JoinMissionResult | null; error: MissionApiError | null }> {
  const missionId = input.missionId.trim();
  const nickname = input.nickname.trim();

  if (!missionId) {
    return { data: null, error: { message: 'Enter a mission ID.' } };
  }
  if (!isMissionIdUuid(missionId)) {
    return {
      data: null,
      error: { message: 'Enter a valid mission ID (UUID format).' },
    };
  }
  if (!nickname) {
    return { data: null, error: { message: 'Enter your name or a nickname.' } };
  }

  const { data, error } = await callRpc('join_mission', {
    p_mission_id: missionId,
    p_nickname: nickname,
  });

  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const participantId = readString(raw.participant_id);
  const claimToken = readString(raw.claim_token);
  const hostToken = readString(raw.host_token);
  const returnedNickname = readString(raw.nickname) ?? nickname;
  const role = readString(raw.role) ?? (hostToken ? 'host' : 'joiner');

  if (!participantId) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  // New joiners need a claim token; host reclaim may only return host_token
  // (Featured WOD host rows are created without a claim_token_hash).
  if (!claimToken && !hostToken) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  persistMissionIdentity(missionId, {
    nickname: returnedNickname,
    participantId,
    ...(hostToken ? { hostToken } : {}),
    ...(claimToken ? { claimToken } : {}),
  });

  return {
    data: {
      participantId,
      claimToken,
      hostToken,
      nickname: returnedNickname,
      role,
    },
    error: null,
  };
}

export async function fetchHostActiveMissionCount(): Promise<{
  data: number | null;
  error: MissionApiError | null;
}> {
  const { data, error } = await callRpc('host_active_mission_count');

  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  if (raw.ok !== true || typeof raw.count !== 'number') {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  return { data: raw.count, error: null };
}

export async function updateMissionScheduledAt(input: {
  missionId: string;
  scheduledAt: string;
}): Promise<{
  data: { scheduledAt: string } | null;
  error: MissionApiError | null;
}> {
  const missionId = input.missionId.trim();
  if (!missionId) {
    return { data: null, error: { message: 'Mission id is required.' } };
  }
  if (!isMissionIdUuid(missionId)) {
    return {
      data: null,
      error: { message: 'Enter a valid mission ID (UUID format).' },
    };
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data, error } = await callRpc('update_mission_scheduled_at', {
    p_mission_id: missionId,
    p_scheduled_at: input.scheduledAt,
    p_timezone: timeZone,
  });

  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const scheduledAt = readString(raw.scheduled_at);
  if (!scheduledAt) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  return { data: { scheduledAt }, error: null };
}
