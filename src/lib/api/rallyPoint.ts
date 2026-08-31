import { callRpc } from '@/lib/api/callRpc';
import type { WorkoutExercise } from '@/lib/api/missionTypes';
import {
  getStoredRallyPointMemberId,
  getStoredRallyPointNickname,
  getStoredRallyPointSeatClaim,
  persistRallyPointIdentity,
} from '@/lib/rallyPointIdentity';
import { clearStoredHostToken, persistMissionIdentity } from '@/lib/missionIdentity';
import { track } from '@/lib/analytics/track';

export type RallyPointApiError = { message: string };

export type RallyPointMember = {
  id: string;
  userId: string | null;
  nickname: string;
  status: 'active' | 'left';
  lastSeenAt: string;
  joinedAt: string;
};

export type RallyPointMissionState = 'waiting' | 'setup' | 'work' | 'finished';

export type RallyPointSnapshot = {
  rallyPointId: string;
  /** Null for anonymous get_rally_point responses (auth UUIDs redacted). */
  hostUserId: string | null;
  activeMissionId: string | null;
  activeMissionState: RallyPointMissionState | null;
  status: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
  /** Host announced Daisy-chain; crew should hang on for the next mission. */
  nextMissionPendingAt: string | null;
  members: RallyPointMember[];
};

export type CreateRallyPointMissionResult = {
  rallyPointId: string;
  rallyPointMemberId: string;
  missionId: string;
  hostToken: string;
  participantId: string;
  claimToken: string;
};

export type JoinRallyPointResult = {
  rallyPointId: string;
  rallyPointMemberId: string;
  hostUserId: string;
  status: string;
  activeMissionId: string | null;
  missionId: string | null;
  missionState: RallyPointMissionState | null;
  participantId: string | null;
  nickname: string;
  role: 'host' | 'joiner' | null;
  claimToken: string | null;
  hostToken: string | null;
};

export function isLiveRallyPointMissionState(
  state: string | null | undefined
): state is 'waiting' | 'setup' | 'work' {
  return state === 'waiting' || state === 'setup' || state === 'work';
}

function parseRallyPointMissionState(value: unknown): RallyPointMissionState | null {
  if (value === 'waiting' || value === 'setup' || value === 'work' || value === 'finished') {
    return value;
  }
  return null;
}

const RALLY_POINT_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isRallyPointIdUuid(value: string): boolean {
  return RALLY_POINT_ID_UUID_RE.test(value);
}

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
  if (message.includes('Rally point not found')) {
    return 'Rally point not found.';
  }
  if (message.includes('Rally point closed')) {
    return 'This rally point is closed.';
  }
  if (message.includes('Rally point is full') || message.includes('Mission is full')) {
    return 'This rally point is full.';
  }
  if (message.includes('Only the host can pass command')) {
    return 'Only the host can pass command.';
  }
  if (message.includes('Only the host can start the next mission')) {
    return 'Only the host can start the next mission.';
  }
  if (message.includes('Only the host can close')) {
    return 'Only the host can close the rally point.';
  }
  if (message.includes('Target is not an active crew member')) {
    return 'That athlete is not at the rally point.';
  }
  if (message.includes('Cannot pass command to yourself')) {
    return 'Pick someone else to pass command to.';
  }
  if (
    message.includes('Cannot pass command during a live mission') ||
    message.includes('Cannot claim command during a live mission')
  ) {
    return 'Cannot change host during a live mission.';
  }
  if (message.includes('Current mission is still active')) {
    return 'Finish the current mission before starting the next one.';
  }
  if (message.includes('Host mission limit reached')) {
    return 'You already have 3 active missions.';
  }
  if (message.includes('Authentication required')) {
    return 'Sign in to continue.';
  }
  if (message.includes('Intake required')) {
    return 'Complete your profile before continuing.';
  }
  if (message.includes('No successor available')) {
    return 'No one else can take command right now.';
  }
  if (message.includes('Not a rally point member')) {
    return 'Join the rally point first.';
  }
  if (message.includes('nickname')) {
    return 'Enter your name or a nickname (max 50 characters).';
  }
  return message;
}

function parseMember(raw: Record<string, unknown>): RallyPointMember | null {
  const id = readString(raw.id);
  const nickname = readString(raw.nickname);
  const status = readString(raw.status);
  const lastSeenAt = readString(raw.last_seen_at);
  const joinedAt = readString(raw.joined_at);
  if (!id || !nickname || (status !== 'active' && status !== 'left') || !lastSeenAt || !joinedAt) {
    return null;
  }
  return {
    id,
    userId: readString(raw.user_id),
    nickname,
    status,
    lastSeenAt,
    joinedAt,
  };
}

export async function createRallyPointMission(input: {
  nickname: string;
  durationMinutes: number;
  workout: WorkoutExercise[];
  templateId?: string | null;
  intensityTier?: number | null;
  scheduledAt?: string | null;
}): Promise<{ data: CreateRallyPointMissionResult | null; error: RallyPointApiError | null }> {
  const nickname = input.nickname.trim();
  if (!nickname) {
    return { data: null, error: { message: 'Enter your name or a nickname.' } };
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data, error } = await callRpc('create_rally_point_mission', {
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
  const rallyPointId = readString(raw.rally_point_id);
  const rallyPointMemberId = readString(raw.rally_point_member_id);
  const missionId = readString(raw.mission_id);
  const hostToken = readString(raw.host_token);
  const participantId = readString(raw.participant_id);
  const claimToken = readString(raw.claim_token);

  if (
    !rallyPointId ||
    !rallyPointMemberId ||
    !missionId ||
    !hostToken ||
    !participantId ||
    !claimToken
  ) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  persistRallyPointIdentity(rallyPointId, { memberId: rallyPointMemberId, nickname, missionId });
  persistMissionIdentity(missionId, {
    nickname,
    participantId,
    hostToken,
    claimToken,
  });

  track('rally_point_created', { mission_id: missionId }, { missionId, participantId });

  return {
    data: { rallyPointId, rallyPointMemberId, missionId, hostToken, participantId, claimToken },
    error: null,
  };
}

export async function joinRallyPoint(input: {
  rallyPointId: string;
  nickname: string;
  /** Overrides the stored member id; tests and explicit re-joins use it. */
  rallyPointMemberId?: string | null;
}): Promise<{ data: JoinRallyPointResult | null; error: RallyPointApiError | null }> {
  const nickname = input.nickname.trim();
  if (!nickname) {
    return { data: null, error: { message: 'Enter your name or a nickname.' } };
  }
  const requestRallyPointId = input.rallyPointId.trim();
  if (!isRallyPointIdUuid(requestRallyPointId)) {
    return { data: null, error: { message: 'Rally point not found.' } };
  }

  // A guest has no user_id for the server to match on, so hand back the member
  // id + seat_claim we were given the first time. Without the member id every
  // re-join minted a new seat, and start_next_rally_point_mission makes the force-nav
  // hook re-join on every chained mission. Member ids alone are visible in
  // get_rally_point and are not proof of ownership — seat_claim is the secret.
  const knownMemberId =
    input.rallyPointMemberId === undefined
      ? getStoredRallyPointMemberId(requestRallyPointId)
      : input.rallyPointMemberId;
  const seatClaim = knownMemberId ? getStoredRallyPointSeatClaim(requestRallyPointId) : null;

  const { data, error } = await callRpc('join_rally_point', {
    p_rally_point_id: requestRallyPointId,
    p_nickname: nickname,
    p_rally_point_member_id: knownMemberId,
    p_seat_claim: seatClaim,
  });

  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const rallyPointId = readString(raw.rally_point_id);
  const rallyPointMemberId = readString(raw.rally_point_member_id);
  const hostUserId = readString(raw.host_user_id);
  const status = readString(raw.status) ?? 'open';
  const activeMissionId = readString(raw.active_mission_id);
  const missionId = readString(raw.mission_id);
  const participantId = readString(raw.participant_id);
  const roleRaw = readString(raw.role);
  const role = roleRaw === 'host' || roleRaw === 'joiner' ? roleRaw : null;
  const claimToken = readString(raw.claim_token);
  const hostToken = readString(raw.host_token);
  const seatClaimOut = readString(raw.seat_claim);
  const missionState = parseRallyPointMissionState(raw.mission_state);

  if (!rallyPointId || !rallyPointMemberId || !hostUserId) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  persistRallyPointIdentity(rallyPointId, {
    memberId: rallyPointMemberId,
    nickname: readString(raw.nickname) ?? nickname,
    missionId,
    seatClaim: seatClaimOut,
  });

  if (missionId && participantId) {
    persistMissionIdentity(missionId, {
      nickname: readString(raw.nickname) ?? nickname,
      participantId,
      ...(hostToken ? { hostToken } : {}),
      ...(claimToken ? { claimToken } : {}),
    });
  }

  track(
    'rally_point_joined',
    { has_mission: Boolean(missionId), role },
    { missionId, participantId }
  );

  return {
    data: {
      rallyPointId,
      rallyPointMemberId,
      hostUserId,
      status,
      activeMissionId,
      missionId,
      missionState,
      participantId,
      nickname: readString(raw.nickname) ?? nickname,
      role,
      claimToken,
      hostToken,
    },
    error: null,
  };
}

export async function getRallyPoint(
  rallyPointId: string
): Promise<{ data: RallyPointSnapshot | null; error: RallyPointApiError | null }> {
  const { data, error } = await callRpc('get_rally_point', { p_rally_point_id: rallyPointId });
  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const id = readString(raw.rally_point_id);
  const hostUserId = readString(raw.host_user_id);
  const status = readString(raw.status);
  const createdAt = readString(raw.created_at);
  const updatedAt = readString(raw.updated_at);
  if (!id || (status !== 'open' && status !== 'closed') || !createdAt || !updatedAt) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const membersRaw = Array.isArray(raw.members) ? raw.members : [];
  const members = membersRaw
    .map((entry) =>
      entry && typeof entry === 'object' ? parseMember(entry as Record<string, unknown>) : null
    )
    .filter((m): m is RallyPointMember => m !== null);

  return {
    data: {
      rallyPointId: id,
      hostUserId,
      activeMissionId: readString(raw.active_mission_id),
      activeMissionState: parseRallyPointMissionState(raw.active_mission_state),
      status,
      createdAt,
      updatedAt,
      nextMissionPendingAt: readString(raw.next_mission_pending_at),
      members,
    },
    error: null,
  };
}

export async function announceNextMission(rallyPointId: string): Promise<{
  data: { ok: boolean; nextMissionPendingAt: string | null } | null;
  error: RallyPointApiError | null;
}> {
  const { data, error } = await callRpc('announce_next_mission', {
    p_rally_point_id: rallyPointId,
  });
  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }
  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }
  return {
    data: {
      ok: true,
      nextMissionPendingAt: readString(raw.next_mission_pending_at),
    },
    error: null,
  };
}

export async function passRallyPointCommand(input: {
  rallyPointId: string;
  toUserId: string;
}): Promise<{
  data: { hostUserId: string; hostToken: string | null; activeMissionId: string | null } | null;
  error: RallyPointApiError | null;
}> {
  const { data, error } = await callRpc('pass_rally_point_command', {
    p_rally_point_id: input.rallyPointId,
    p_to_user_id: input.toUserId,
  });
  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }
  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const hostUserId = readString(raw.host_user_id);
  if (!hostUserId) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }
  const activeMissionId = readString(raw.active_mission_id);
  // Rotated token is never returned to the outgoing host; clear any stale local copy.
  if (activeMissionId) {
    clearStoredHostToken(activeMissionId);
  }
  track('command_passed', { to_user_id: input.toUserId });
  return {
    data: {
      hostUserId,
      hostToken: readString(raw.host_token),
      activeMissionId,
    },
    error: null,
  };
}

export async function startNextRallyPointMission(input: {
  rallyPointId: string;
  durationMinutes: number;
  workout: WorkoutExercise[];
  templateId?: string | null;
  intensityTier?: number | null;
}): Promise<{
  data: { missionId: string; hostToken: string; participantId: string; claimToken: string } | null;
  error: RallyPointApiError | null;
}> {
  const { data, error } = await callRpc('start_next_rally_point_mission', {
    p_rally_point_id: input.rallyPointId,
    p_duration_minutes: input.durationMinutes,
    p_workout: input.workout,
    p_template_id: input.templateId ?? null,
    p_intensity_tier: input.intensityTier ?? null,
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

  const nickname = getStoredRallyPointNickname(input.rallyPointId) ?? 'Athlete';
  const memberId = getStoredRallyPointMemberId(input.rallyPointId);
  persistMissionIdentity(missionId, {
    nickname,
    participantId,
    hostToken,
    claimToken,
  });
  if (memberId) {
    persistRallyPointIdentity(input.rallyPointId, {
      memberId,
      nickname,
      missionId,
    });
  }

  track('rally_point_next_mission', {}, { missionId, participantId });

  return { data: { missionId, hostToken, participantId, claimToken }, error: null };
}

export async function leaveRallyPoint(
  rallyPointId: string,
  options?: { rallyPointMemberId?: string | null }
): Promise<{ data: { left: boolean; closed?: boolean } | null; error: RallyPointApiError | null }> {
  // As with joinRallyPoint: a guest leaves with the member id + seat_claim it was
  // handed. Member id alone is not proof — it is visible in get_rally_point.
  const rallyPointMemberId =
    options?.rallyPointMemberId === undefined
      ? getStoredRallyPointMemberId(rallyPointId)
      : options.rallyPointMemberId;
  const seatClaim = rallyPointMemberId ? getStoredRallyPointSeatClaim(rallyPointId) : null;

  const { data, error } = await callRpc('leave_rally_point', {
    p_rally_point_id: rallyPointId,
    p_rally_point_member_id: rallyPointMemberId,
    p_seat_claim: seatClaim,
  });
  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }
  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const closed = raw.closed === true;
  const wasHost = raw.was_host === true;
  if (closed) {
    track('rally_point_closed', {});
  } else if (wasHost) {
    track('rally_point_host_reassigned', {});
  }
  return {
    data: { left: raw.left === true, closed },
    error: null,
  };
}

export async function closeRallyPoint(
  rallyPointId: string
): Promise<{ data: { ok: boolean } | null; error: RallyPointApiError | null }> {
  const { error } = await callRpc('close_rally_point', { p_rally_point_id: rallyPointId });
  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }
  track('rally_point_closed', {});
  return { data: { ok: true }, error: null };
}

export async function touchRallyPointPresence(
  rallyPointId: string
): Promise<{ data: { ok: boolean } | null; error: RallyPointApiError | null }> {
  const { data, error } = await callRpc('touch_rally_point_presence', {
    p_rally_point_id: rallyPointId,
  });
  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }
  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  return { data: { ok: raw.ok === true }, error: null };
}

export async function claimRallyPointCommandIfStale(rallyPointId: string): Promise<{
  data: {
    claimed: boolean;
    hostUserId: string | null;
    hostToken: string | null;
    activeMissionId: string | null;
    reason: string | null;
  } | null;
  error: RallyPointApiError | null;
}> {
  const { data, error } = await callRpc('claim_rally_point_command_if_stale', {
    p_rally_point_id: rallyPointId,
  });
  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }
  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  if (raw.claimed === true) {
    track('rally_point_host_reassigned', {});
  }
  return {
    data: {
      claimed: raw.claimed === true,
      hostUserId: readString(raw.host_user_id),
      hostToken: readString(raw.host_token),
      activeMissionId: readString(raw.active_mission_id),
      reason: readString(raw.reason),
    },
    error: null,
  };
}
